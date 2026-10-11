const mongoose = require('mongoose');
const Game = require('./game.model');
const { getIO } = require('../../shared/sockets');

const { requireGameAccess, fail } = require('../../shared/middleware/gameAccess.middleware');
const _emitUpdate = (gameId) => {
  try { getIO().to(`game:${gameId}`).emit('game:update', { gameId }); }
  catch (error) { console.error('Game notification failed:', error.message); }
};

const createGame = async (gameData) => {
  const game = await Game.create(gameData);
  return game;
};

const getActiveGamesForUser = async (userId) => {
  return await Game.find({
    $or: [{ createdBy: userId }, { 'participants.userId': userId }],
    status: { $nin: ['ENDED', 'ARCHIVED'] },
  })
    .populate('createdBy', 'name username profilePicture')
    .sort('-createdAt');
};

const getGameHistoryForUser = async (userId) => {
  return await Game.find({
    $or: [{ createdBy: userId }, { 'participants.userId': userId }],
    status: { $in: ['ENDED', 'ARCHIVED'] },
  })
    .populate('createdBy', 'name username profilePicture')
    .sort('-createdAt');
};

const getGameById = async (gameId, userId) => {
  await requireGameAccess(gameId, userId, true);
  const game = await Game.findById(gameId)
    .populate('createdBy', 'name username profilePicture')
    .populate('participants.userId', 'name username profilePicture')
    .populate('turnOrder', 'name username profilePicture');

  if (!game) {
    throw fail('Game not found');
  }

  return game;
};

const getCurrentRoundForGame = async (gameId, userId) => {
  const game = await requireGameAccess(gameId, userId);
  if (game.currentRoundNumber === 0) return null;
  const Round = require('../rounds/round.model');
  const round = await Round.findOne({ gameId, roundNumber: game.currentRoundNumber });
  if (!round) return null;
  return require('../rounds/round.service').getRoundById(round._id, userId);
};

async function configure(gameId, userId, update) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const game = await Game.findById(gameId).session(session);
      if (!game) throw fail('Game not found', 404);
      if (game.createdBy.toString() !== userId.toString()) throw fail('Only the host can configure the table', 403);
      await update(game, session);
      game.increment();
      await game.save({ session });
    });
  } finally { await session.endSession(); }
  _emitUpdate(gameId);
  return getGameById(gameId, userId);
}
const finalizePlayers = (gameId, userId) => configure(gameId, userId, async (game, session) => {
  if (!['CREATED', 'WAITING_FOR_PLAYERS'].includes(game.status)) throw fail('Players have already been finalized');
  if (game.participants.length < 2 || game.participants.length > 6) throw fail('The table needs 2 to 6 accepted players, including the host');
  game.status = 'TURN_ORDER_SETUP';
  const Invitation = require('../invitations/invitation.model');
  await Invitation.updateMany({ gameId, status: 'PENDING' }, { $set: { status: 'DECLINED', respondedAt: new Date() } }, { session });
});
const setTurnOrder = (gameId, orderedUserIds, userId) => configure(gameId, userId, game => {
  if (game.status !== 'TURN_ORDER_SETUP') throw fail('Set turn order before starting the game');
  const participants = game.participants.map(p => p.userId.toString());
  if (new Set(orderedUserIds).size !== orderedUserIds.length || orderedUserIds.length !== participants.length || orderedUserIds.some(id => !participants.includes(id))) throw fail('Turn order must contain each accepted participant exactly once');
  game.turnOrder = orderedUserIds;
});
const startGame = (gameId, userId) => configure(gameId, userId, game => {
  if (game.status !== 'TURN_ORDER_SETUP') throw fail('Finalize players and set the turn order first');
  const order = game.turnOrder.map(String), participants = game.participants.map(p => String(p.userId));
  if (order.length < 2 || order.length > 6 || new Set(order).size !== order.length || order.length !== participants.length || order.some(id => !participants.includes(id))) throw fail('Turn order is not properly set');
  game.status = 'ACTIVE';
  game.startedAt = new Date();
});

const endGame = async (gameId, userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const game = await Game.findById(gameId).session(session);
      if (!game) throw fail('Game not found', 404);
      if (game.createdBy.toString() !== userId.toString()) throw fail('Only the host can end the game', 403);
      if (game.status !== 'ACTIVE') throw fail('Game is not active');
      const Round = require('../rounds/round.model');
      if (await Round.exists({ gameId, status: { $ne: 'COMPLETED' } }).session(session)) throw fail('Finish the current round before ending the game');
      game.status = 'ENDED';
      game.endedAt = new Date();
      await game.save({ session });
      const User = require('../users/user.model');
      for (const player of game.participants) {
        await User.updateOne({ _id: player.userId }, { $inc: { globalBalance: player.balance, __v: 1 } }, { session });
      }
    });
  } finally { await session.endSession(); }
  _emitUpdate(gameId);
  return getGameById(gameId, userId);
};

module.exports = {
  createGame,
  getActiveGamesForUser,
  getGameHistoryForUser,
  getGameById,
  getCurrentRoundForGame,
  finalizePlayers,
  setTurnOrder,
  startGame,
  endGame,
};
