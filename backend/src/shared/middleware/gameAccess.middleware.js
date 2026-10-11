const mongoose = require('mongoose');
const Game = require('../../modules/games/game.model');
const Invitation = require('../../modules/invitations/invitation.model');
const { idOf } = require('../../modules/rounds/round.view');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
async function canAccessGame(game, userId, allowInvited = false) {
  if (!game) throw fail('Game not found', 404);
  if (idOf(game.createdBy) === idOf(userId) || game.participants.some(p => idOf(p.userId) === idOf(userId))) return;
  if (allowInvited && await Invitation.exists({ gameId: game._id, invitedUserId: userId })) return;
  throw fail('You are not a participant at this table', 403);
}
async function requireGameAccess(gameId, userId, allowInvited = false) {
  if (!mongoose.isValidObjectId(gameId)) throw fail('Game not found', 404);
  const game = await Game.findById(gameId);
  await canAccessGame(game, userId, allowInvited);
  return game;
}
module.exports = { fail, canAccessGame, requireGameAccess };
