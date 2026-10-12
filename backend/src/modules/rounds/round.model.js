const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
    },
    revision: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['CREATED', 'ACTIVE', 'SIDE_SHOW_PENDING', 'SHOW_PENDING', 'COMPLETED'],
      default: 'CREATED',
    },
    mode: { type: String, enum: ['CLASSIC', 'JOKER'], default: 'CLASSIC' },
    jokerCard: { rank: Number, suit: String },
    completionReason: { type: String, enum: ['LAST_PLAYER', 'SHOW', 'POT_LIMIT'] },
    potLimit: { type: Number, min: 1 },
    potAmount: {
      type: Number,
      default: 0,
    },
    currentBet: {
      type: Number,
      default: 0,
    },
    startingBet: {
      type: Number,
    },
    currentTurnIndex: {
      type: Number,
      default: 0,
    },
    players: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['ACTIVE', 'PACKED', 'WINNER'], default: 'ACTIVE' },
        totalContribution: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 },
        seenCards: { type: Boolean, default: false },
        lastBet: { type: String, enum: ['BLIND', 'CHAAL'] },
        lastBetAmount: { type: Number, min: 0 },
        lastAction: { type: String, enum: ['BLIND', 'SEEN', 'CHAAL'] },
        revealed: { type: Boolean, default: false },
        sideShowViewers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false, default: undefined },
        cards: { type: [{ _id: false, rank: { type: Number, min: 0, max: 14 }, suit: { type: String, enum: ['S', 'H', 'D', 'C', 'J'] } }], select: false, default: undefined },
      },
    ],
    sideShowRequest: {
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      targetPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      result: { type: String, enum: ['PENDING', 'ACCEPTED', 'REQUESTER_WON', 'TARGET_WON', 'DECLINED'] },
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: Date,
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

roundSchema.index({ gameId: 1, roundNumber: 1 }, { unique: true });

const Round = mongoose.model('Round', roundSchema);
module.exports = Round;
