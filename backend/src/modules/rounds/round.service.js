const mongoose = require('mongoose');
const Round = require('./round.model');
const Game = require('../games/game.model');
const User = require('../users/user.model');
const { recordTransaction } = require('../ledger/ledger.service');
const turns = require('./turnManager.service');
const { getIO } = require('../../shared/sockets');
const { dealCards, compareHands } = require('../cards/cards.service');
const { roundForViewer, idOf } = require('./round.view');
const { fail, canAccessGame } = require('../../shared/middleware/gameAccess.middleware');

// Notifications only invalidate state. Private hands are fetched through authenticated HTTP.
function notify(gameId) {
  try { getIO().to(`game:${gameId}`).emit('round:update', { gameId: idOf(gameId) }); }
  catch (error) { console.error('Round notification failed:', error.message); }
}

async function availableBalance(userId, session) {
  const user = await User.findById(userId).session(session);
  if (!user) throw fail('Player not found', 404);
  const games = await Game.find({ 'participants.userId': userId, status: { $nin: ['ENDED', 'ARCHIVED'] } }).session(session);
  return user.globalBalance + games.reduce((sum, game) => sum + (game.participants.find(p => idOf(p.userId) === idOf(userId))?.balance || 0), 0);
}

async function charge(session, game, round, player, amount, type) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail('Invalid bet amount');
  // All wallet spending uses the same user write, so concurrent tables conflict and retry.
  await User.updateOne({ _id: player.userId }, { $inc: { __v: 1 } }, { session });
  const balance = await availableBalance(player.userId, session);
  if (balance < amount) throw fail(`Insufficient balance. Required: ₹${amount}, available: ₹${balance}`);
  await recordTransaction(session, { userId: player.userId, gameId: game._id, roundId: round._id, type, amount: -amount });
  player.totalContribution += amount;
  round.potAmount += amount;
}

async function complete(session, round, winnerId, reason) {
  round.status = 'COMPLETED';
  round.winnerId = winnerId;
  round.completionReason = reason;
  round.endedAt = new Date();
  const winner = round.players.find(p => idOf(p.userId) === idOf(winnerId));
  winner.status = 'WINNER';
  await recordTransaction(session, { userId: winnerId, gameId: round.gameId, roundId: round._id, type: 'ROUND_WIN', amount: round.potAmount });
}

function activeTurn(round, game, userId) {
  if (game.status !== 'ACTIVE' || round.status !== 'ACTIVE') throw fail('The round is not accepting actions');
  const player = round.players[round.currentTurnIndex];
  if (!player || idOf(player.userId) !== idOf(userId)) throw fail('It is not your turn', 403);
  if (player.status !== 'ACTIVE') throw fail('You have already packed');
  return player;
}
function advance(round) {
  const next = turns.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
  if (next === null) throw fail('No active players remain');
  round.currentTurnIndex = next;
}
const stake = (round, player) => round.currentBet * (player.seenCards ? 2 : 1);

async function mutate(roundId, userId, action) {
  const session = await mongoose.startSession();
  let gameId;
  try {
    await session.withTransaction(async () => {
      const round = await Round.findById(roundId).select('+players.cards').session(session);
      if (!round) throw fail('Round not found', 404);
      const game = await Game.findById(round.gameId).session(session);
      await canAccessGame(game, userId);
      gameId = game._id;
      await action(session, round, game);
      await round.save({ session });
    });
  } finally { await session.endSession(); }
  notify(gameId);
  return getRoundById(roundId, userId);
}

async function startRound(gameId, userId) {
  const session = await mongoose.startSession();
  let roundId;
  try {
    await session.withTransaction(async () => {
      const game = await Game.findById(gameId).session(session);
      if (!game) throw fail('Game not found', 404);
      if (idOf(game.createdBy) !== idOf(userId)) throw fail('Only the host can deal a round', 403);
      if (game.status !== 'ACTIVE') throw fail('Start the game before dealing cards');
      if (game.currentRoundNumber > 0) {
        const previous = await Round.findOne({ gameId, roundNumber: game.currentRoundNumber }).session(session);
        if (!previous || previous.status !== 'COMPLETED') throw fail('Finish the current round before dealing again');
      }
      const participantIds = game.participants.map(p => idOf(p.userId));
      const order = game.turnOrder.map(idOf);
      if (order.length < 2 || order.length > 6 || new Set(order).size !== order.length || order.length !== participantIds.length || order.some(id => !participantIds.includes(id))) throw fail('Set a valid turn order for 2 to 6 players');
      const { hands, jokerCard } = dealCards(order.length, game.mode || 'CLASSIC');
      const round = new Round({ gameId, roundNumber: game.currentRoundNumber + 1, mode: game.mode || 'CLASSIC', jokerCard,
        status: 'ACTIVE', potAmount: 0, currentBet: game.bootAmount, startingBet: game.bootAmount,
        currentTurnIndex: game.currentRoundNumber % order.length, startedAt: new Date(),
        players: game.turnOrder.map((userId, index) => ({ userId, cards: hands[index], status: 'ACTIVE', totalContribution: 0, seenCards: false })) });
      for (const player of round.players) await charge(session, game, round, player, game.bootAmount, 'BOOT');
      await round.save({ session });
      game.currentRoundNumber = round.roundNumber;
      await game.save({ session });
      roundId = round._id;
    });
  } finally { await session.endSession(); }
  notify(gameId);
  return getRoundById(roundId, userId);
}

const bet = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  await charge(session, game, round, player, stake(round, player), 'BET');
  advance(round);
});
const betTwice = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  const raised = round.currentBet * 2;
  if (raised > round.startingBet * game.maxBetMultiplier) throw fail('Raise exceeds the table limit');
  await charge(session, game, round, player, raised * (player.seenCards ? 2 : 1), 'BET_TWICE');
  round.currentBet = raised;
  advance(round);
});
const pack = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  player.status = 'PACKED';
  const remaining = turns.checkOnePlayerRemaining(round.players);
  if (remaining) await complete(session, round, remaining.userId, 'LAST_PLAYER');
  else advance(round);
});
const seeCards = (roundId, userId) => mutate(roundId, userId, async (_, round, game) => {
  if (game.status !== 'ACTIVE' || round.status !== 'ACTIVE') throw fail('Cards cannot be opened in this state');
  const player = round.players.find(p => idOf(p.userId) === idOf(userId));
  if (!player || player.status !== 'ACTIVE') throw fail('Only active players can open their cards', 403);
  if (player.cards?.length !== 3) throw fail('This older round has no digital cards. Finish it before dealing a new round.');
  player.seenCards = true;
});
const requestSideShow = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  if (round.players.filter(p => p.status === 'ACTIVE').length <= 2) throw fail('Side show requires at least three active players');
  const target = round.players[turns.getPreviousActivePlayerIndex(round.players, round.currentTurnIndex)];
  if (!player.seenCards || !target.seenCards) throw fail('You and the previous active player must both have seen your cards');
  await charge(session, game, round, player, stake(round, player), 'SHOW_FEE');
  round.status = 'SIDE_SHOW_PENDING';
  round.sideShowRequest = { requestedBy: userId, targetPlayer: target.userId, result: 'PENDING' };
});
const respondSideShow = (roundId, userId, accept) => mutate(roundId, userId, async (_, round, game) => {
  if (game.status !== 'ACTIVE' || round.status !== 'SIDE_SHOW_PENDING' || round.sideShowRequest?.result !== 'PENDING') throw fail('No side show is waiting for a response');
  const request = round.sideShowRequest;
  if (idOf(request.targetPlayer) !== idOf(userId)) throw fail('Only the requested player can respond', 403);
  if (accept) {
    const requester = round.players.find(p => idOf(p.userId) === idOf(request.requestedBy));
    const target = round.players.find(p => idOf(p.userId) === idOf(request.targetPlayer));
    if (requester.cards?.length !== 3 || target.cards?.length !== 3) {
      request.result = 'ACCEPTED'; // Compatibility for rounds dealt before this release.
      return;
    }
    const loser = compareHands(requester.cards, target.cards, round.jokerCard?.rank) > 0 ? target : requester;
    loser.status = 'PACKED'; // Equal hands: the requesting player loses.
    request.result = loser === target ? 'REQUESTER_WON' : 'TARGET_WON';
  } else request.result = 'DECLINED';
  round.status = 'ACTIVE';
  advance(round);
});
const requestShow = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  const active = round.players.filter(p => p.status === 'ACTIVE');
  if (active.length !== 2) throw fail('Show requires exactly two active players');
  const other = active.find(p => idOf(p.userId) !== idOf(userId));
  if (player.seenCards && !other.seenCards) throw fail('A seen player cannot request a show against a blind player');
  await charge(session, game, round, player, stake(round, player), 'SHOW_FEE');
  if (active.some(p => p.cards?.length !== 3)) { round.status = 'SHOW_PENDING'; return; }
  active.forEach(p => { p.revealed = true; });
  const winner = compareHands(player.cards, other.cards, round.jokerCard?.rank) > 0 ? player : other;
  const loser = winner === player ? other : player;
  loser.status = 'PACKED';
  await complete(session, round, winner.userId, 'SHOW');
});

// Manual results are restricted to legacy physical-card rounds.
const submitShowResult = (roundId, userId, winnerId) => mutate(roundId, userId, async (session, round, game) => {
  if (idOf(game.createdBy) !== idOf(userId)) throw fail('Only the host can resolve a legacy show', 403);
  if (round.status !== 'SHOW_PENDING' || round.players.some(p => p.cards?.length)) throw fail('Digital hands are compared automatically');
  const active = round.players.filter(p => p.status === 'ACTIVE');
  if (!active.some(p => idOf(p.userId) === idOf(winnerId))) throw fail('Choose an active player');
  active.forEach(p => { if (idOf(p.userId) !== idOf(winnerId)) p.status = 'PACKED'; });
  await complete(session, round, winnerId, 'SHOW');
});
const submitSideShowResult = (roundId, userId, loserId) => mutate(roundId, userId, async (_, round) => {
  const request = round.sideShowRequest;
  if (round.status !== 'SIDE_SHOW_PENDING' || request?.result !== 'ACCEPTED' || round.players.some(p => p.cards?.length)) throw fail('Digital hands are compared automatically');
  const involved = [idOf(request.requestedBy), idOf(request.targetPlayer)];
  if (!involved.includes(idOf(userId))) throw fail('Only side show participants can resolve this legacy round', 403);
  if (!involved.includes(idOf(loserId))) throw fail('Choose a side show participant');
  round.players.find(p => idOf(p.userId) === idOf(loserId)).status = 'PACKED';
  round.sideShowRequest = null;
  round.status = 'ACTIVE';
  advance(round);
});
async function getRoundById(roundId, userId) {
  const round = await Round.findById(roundId).select('+players.cards')
    .populate('players.userId', 'name username profilePicture').populate('winnerId', 'name username profilePicture');
  if (!round) throw fail('Round not found', 404);
  const game = await Game.findById(round.gameId);
  await canAccessGame(game, userId);
  const view = roundForViewer(round, userId);
  view.availableBalance = await availableBalance(userId, null);
  return view;
}
module.exports = { startRound, bet, betTwice, pack, seeCards, requestSideShow, respondSideShow, submitSideShowResult, requestShow, submitShowResult, getRoundById };
