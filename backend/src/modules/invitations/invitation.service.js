const Invitation = require('./invitation.model');
const Game = require('../games/game.model');
const { getIO } = require('../../shared/sockets');
const mongoose = require('mongoose');
const { fail } = require('../../shared/middleware/gameAccess.middleware');

const inviteUsers = async (gameId, userIds, inviterId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');
  if (game.createdBy.toString() !== inviterId.toString()) {
    throw new Error('Only the creator can invite players');
  }

  if (!['CREATED', 'WAITING_FOR_PLAYERS'].includes(game.status)) throw fail('The table is closed to new invitations');
  if (userIds.some(id => id.toString() === inviterId.toString())) throw fail('You already have a seat at this table');
  const invitations = [...new Set(userIds)].map((userId) => ({
    gameId,
    invitedUserId: userId,
    invitedBy: inviterId,
  }));

  // Ignore duplicates using insertMany with ordered: false, or do upserts
  // We'll filter existing ones to avoid MongoBulkWriteError
  const existingInvites = await Invitation.find({
    gameId,
    invitedUserId: { $in: userIds },
  });
  
  const existingUserIds = existingInvites.map((inv) =>
    inv.invitedUserId.toString()
  );
  
  const newInvitations = invitations.filter(
    (inv) => !existingUserIds.includes(inv.invitedUserId.toString())
  );

  if (newInvitations.length > 0) {
    await Invitation.insertMany(newInvitations);
    
    // Update game status if it was CREATED
    if (game.status === 'CREATED') {
      game.status = 'WAITING_FOR_PLAYERS';
      await game.save();
    }
  }

  // Emit socket event to game room so central board updates
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  
  return await getInvitationsByGameId(gameId);
};

const getInvitationsByGameId = async (gameId) => {
  return await Invitation.find({ gameId }).populate('invitedUserId', 'name username');
};

const respondToInvitation = async (invitationId, userId, status) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const invitation = await Invitation.findOne({ _id: invitationId, invitedUserId: userId }).session(session);
      if (!invitation) throw fail('Invitation not found', 404);
      if (invitation.status !== 'PENDING') throw fail('Invitation already responded to');
      const game = await Game.findById(invitation.gameId).session(session);
      if (!game || !['CREATED', 'WAITING_FOR_PLAYERS'].includes(game.status)) throw fail('The table is closed to new players');
      if (status === 'ACCEPTED') {
        const User = require('../users/user.model');
        const user = await User.findById(userId).session(session);
        if (!user || user.globalBalance < game.bootAmount) throw fail(`Insufficient balance to join. Required: ₹${game.bootAmount}`);
        if (!game.participants.some(p => p.userId.toString() === userId.toString())) {
          if (game.participants.length >= 6) throw fail('This table is full (six players)');
          game.participants.push({ userId, balance: 0 });
          await game.save({ session });
        }
      }
      invitation.status = status;
      invitation.respondedAt = new Date();
      await invitation.save({ session });
      result = invitation;
    });
  } finally { await session.endSession(); }
  getIO().to(`game:${result.gameId}`).emit('game:update', { gameId: result.gameId });
  return result;
};

const getPendingInvitationsForUser = async (userId) => {
  return await Invitation.find({ invitedUserId: userId, status: 'PENDING' })
    .populate('gameId', 'name bootAmount')
    .populate('invitedBy', 'name username');
};

const resendInvitation = async (invitationId, inviterId) => {
  const invitation = await Invitation.findById(invitationId).populate('gameId');
  if (!invitation) throw new Error('Invitation not found');
  
  if (invitation.invitedBy.toString() !== inviterId.toString()) {
    throw new Error('Only the inviter can resend this invitation');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Cannot resend invitation because it is not pending');
  }

  invitation.updatedAt = new Date();
  await invitation.save();

  return invitation;
};

module.exports = {
  inviteUsers,
  getInvitationsByGameId,
  respondToInvitation,
  getPendingInvitationsForUser,
  resendInvitation,
};
