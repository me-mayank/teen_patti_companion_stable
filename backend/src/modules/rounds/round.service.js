const mongoose = require('mongoose');
const Round = require('./round.model');
const Game = require('../games/game.model');
const User = require('../users/user.model');
const { recordTransaction, recordTransactions } = require('../ledger/ledger.service');
const turns = require('./turnManager.service');
const { getIO } = require('../../shared/sockets');
const { dealCards, compareHands } = require('../cards/cards.service');
const { roundForViewer, idOf } = require('./round.view');
const { fail, canAccessGame, requireGameAccess } = require('../../shared/middleware/gameAccess.middleware');

const publicPlayerFields = 'name username profilePicture';
const playerPopulation = [
  { path: 'players.userId', select: publicPlayerFields },
  { path: 'winnerId', select: publicPlayerFields },
];
const privateRoundFields = '+players.cards +players.sideShowViewers';
const readRound = query => query.select(privateRoundFields).populate(playerPopulation).lean();

// Notifications only invalidate state. Private hands are fetched through authenticated HTTP.
function notify(round) {
  try { getIO().to(`game:${round.gameId}`).emit('round:update', {
    gameId: idOf(round.gameId), roundId: idOf(round._id), roundNumber: round.roundNumber, revision: round.revision,
  }); }
  catch (error) { console.error('Round notification failed:', error.message); }
}

async function availableBalance(userId, session) {
  const userQuery = User.findById(userId).select('globalBalance').session(session).lean();
  const gamesQuery = Game.find({ 'participants.userId': userId, status: { $nin: ['ENDED', 'ARCHIVED'] } })
    .select('participants.userId participants.balance').session(session).lean();
  // Parallel reads are safe outside a transaction. Session reads stay sequential.
  const [user, games] = session ? [await userQuery, await gamesQuery] : await Promise.all([userQuery, gamesQuery]);
  if (!user) throw fail('Player not found', 404);
  return user.globalBalance + games.reduce((sum, game) => sum + (game.participants.find(p => idOf(p.userId) === idOf(userId))?.balance || 0), 0);
}

async function chargeBoots(session, game, round) {
  const amount = game.bootAmount;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail('Invalid bet amount');
  const userIds = round.players.map(player => player.userId);
  // Lock every wallet before reading it. Concurrent spending at other tables
  // conflicts on these same user records and retries the entire transaction.
  await User.updateMany({ _id: { $in: userIds } }, { $inc: { __v: 1 } }, { session });
  const users = await User.find({ _id: { $in: userIds } }).select('globalBalance').session(session).lean();
  if (users.length !== userIds.length) throw fail('Player not found', 404);
  const balances = new Map(users.map(user => [idOf(user._id), user.globalBalance]));
  const games = await Game.find({ 'participants.userId': { $in: userIds }, status: { $nin: ['ENDED', 'ARCHIVED'] } })
    .select('participants.userId participants.balance').session(session).lean();
  for (const table of games) for (const player of table.participants) {
    const id = idOf(player.userId);
    if (balances.has(id)) balances.set(id, balances.get(id) + (player.balance || 0));
  }
  for (const player of round.players) {
    const balance = balances.get(idOf(player.userId));
    if (balance < amount) throw fail(`Insufficient balance. Required: ₹${amount}, available: ₹${balance}`);
  }
  await recordTransactions(session, round.players.map(player => ({
    userId: player.userId, gameId: game._id, roundId: round._id, type: 'BOOT', amount: -amount,
  })));
  for (const player of round.players) player.totalContribution = amount;
  round.potAmount = amount * round.players.length;
  round.$locals.balances = new Map([...balances].map(([id, balance]) => [id, balance - amount]));
}

async function charge(session, game, round, player, amount, type) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail('Invalid bet amount');
  // Older physical-card rounds keep their manual flow. Digital rounds use a fixed cap.
  if (round.players.every(p => p.cards?.length === 3)) {
    round.potLimit = round.potLimit || round.startingBet * 100;
    amount = Math.min(amount, Math.max(0, round.potLimit - round.potAmount));
    if (amount === 0) return completeAtPotLimit(session, round);
  }
  // All wallet spending uses the same user write, so concurrent tables conflict and retry.
  await User.updateOne({ _id: player.userId }, { $inc: { __v: 1 } }, { session });
  const balance = await availableBalance(player.userId, session);
  if (balance < amount) throw fail(`Insufficient balance. Required: ₹${amount}, available: ₹${balance}`);
  await recordTransaction(session, { userId: player.userId, gameId: game._id, roundId: round._id, type, amount: -amount });
  round.$locals.balances ||= new Map();
  round.$locals.balances.set(idOf(player.userId), balance - amount);
  player.totalContribution += amount;
  round.potAmount += amount;
  if (round.potLimit && round.potAmount >= round.potLimit) return completeAtPotLimit(session, round);
  return false;
}

async function complete(session, round, winnerId, reason) {
  const winner = round.players.find(p => idOf(p.userId) === idOf(winnerId));
  await awardPot(session, round, [winner], reason);
}

async function awardPot(session, round, winners, reason) {
  round.status = 'COMPLETED';
  round.winnerId = winners.length === 1 ? winners[0].userId : undefined;
  round.completionReason = reason;
  round.endedAt = new Date();
  const share = Math.floor(round.potAmount / winners.length);
  const remainder = round.potAmount % winners.length;
  for (const [index, winner] of winners.entries()) {
    winner.status = 'WINNER';
    winner.winAmount = share + (index < remainder ? 1 : 0);
    await recordTransaction(session, { userId: winner.userId, gameId: round.gameId, roundId: round._id, type: 'ROUND_WIN', amount: winner.winAmount });
    const id = idOf(winner.userId);
    if (round.$locals.balances?.has(id)) round.$locals.balances.set(id, round.$locals.balances.get(id) + winner.winAmount);
  }
}

async function completeAtPotLimit(session, round) {
  const active = round.players.filter(p => p.status === 'ACTIVE');
  let winners = [];
  for (const player of active) {
    player.revealed = true;
    const comparison = winners.length ? compareHands(player.cards, winners[0].cards, round.jokerCard?.rank) : 1;
    if (comparison > 0) winners = [player];
    else if (comparison === 0) winners.push(player);
  }
  for (const player of active) if (!winners.includes(player)) player.status = 'PACKED';
  round.sideShowRequest = undefined;
  await awardPot(session, round, winners, 'POT_LIMIT');
  return true;
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
  let committedRound, committedGame;
  try {
    await session.withTransaction(async () => {
      const round = await Round.findById(roundId).select(privateRoundFields).session(session);
      if (!round) throw fail('Round not found', 404);
      const game = await Game.findById(round.gameId).session(session);
      await canAccessGame(game, userId);
      await action(session, round, game);
      round.revision = (round.revision || 0) + 1;
      await round.save({ session });
      committedRound = round;
      committedGame = game;
    });
  } finally { await session.endSession(); }
  notify(committedRound);
  return committedView(committedRound, committedGame, userId);
}

async function startRound(gameId, userId) {
  const session = await mongoose.startSession();
  let committedRound, committedGame;
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
      const round = new Round({ gameId, roundNumber: game.currentRoundNumber + 1, revision: 1, mode: game.mode || 'CLASSIC', jokerCard,
        status: 'ACTIVE', potAmount: 0, potLimit: game.bootAmount * 100, currentBet: game.bootAmount, startingBet: game.bootAmount,
        currentTurnIndex: game.currentRoundNumber % order.length, startedAt: new Date(),
        players: game.turnOrder.map((userId, index) => ({ userId, cards: hands[index], status: 'ACTIVE', totalContribution: 0, seenCards: false })) });
      await chargeBoots(session, game, round);
      await round.save({ session });
      game.currentRoundNumber = round.roundNumber;
      await game.save({ session });
      committedRound = round;
      committedGame = game;
    });
  } finally { await session.endSession(); }
  notify(committedRound);
  return committedView(committedRound, committedGame, userId);
}

async function committedView(round, game, userId) {
  // Reuse this transaction's wallet calculation, including any payout. Seeing
  // cards needs no payment; load its wallet and public player names together.
  const [populated, balance] = await Promise.all([
    Round.populate(round.toObject(), playerPopulation),
    round.$locals.balances?.get(idOf(userId)) ?? availableBalance(userId, null),
  ]);
  return roundViewWithBalance(populated, game, userId, balance);
}

const bet = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  const completed = await charge(session, game, round, player, stake(round, player), 'BET');
  player.lastBet = player.seenCards ? 'CHAAL' : 'BLIND';
  if (completed) return;
  advance(round);
});
const betTwice = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  const raised = round.currentBet * 2;
  if (raised > round.startingBet * game.maxBetMultiplier) throw fail('Raise exceeds the table limit');
  const completed = await charge(session, game, round, player, raised * (player.seenCards ? 2 : 1), 'BET_TWICE');
  player.lastBet = player.seenCards ? 'CHAAL' : 'BLIND';
  if (completed) return;
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
async function seeCards(roundId, userId) {
  const round = await Round.findById(roundId).select(privateRoundFields).lean();
  if (!round) throw fail('Round not found', 404);
  const game = await requireGameAccess(round.gameId, userId);
  if (game.status !== 'ACTIVE' || round.status !== 'ACTIVE') throw fail('Cards cannot be opened in this state');
  const player = round.players.find(p => idOf(p.userId) === idOf(userId));
  if (!player || player.status !== 'ACTIVE') throw fail('Only active players can open their cards', 403);
  if (player.cards?.length !== 3) throw fail('This older round has no digital cards. Finish it before dealing a new round.');
  // No money changes here. Patch only the viewer's seen flag and revision,
  // atomically rechecking eligibility so packing/completion cannot be undone.
  // Bets write this same round and retry their transaction on a conflicting reveal.
  const updated = await Round.findOneAndUpdate({ _id: roundId, status: 'ACTIVE',
    players: { $elemMatch: { userId, status: 'ACTIVE', cards: { $size: 3 } } },
  }, { $set: { 'players.$.seenCards': true }, $inc: { revision: 1 } }, { new: true }).select(privateRoundFields);
  if (!updated) throw fail('The round changed before your cards could be opened. Please retry.');
  notify(updated);
  return committedView(updated, game, userId);
}
const requestSideShow = (roundId, userId) => mutate(roundId, userId, async (session, round, game) => {
  const player = activeTurn(round, game, userId);
  if (round.players.filter(p => p.status === 'ACTIVE').length <= 2) throw fail('Side show requires at least three active players');
  const target = round.players[turns.getPreviousActivePlayerIndex(round.players, round.currentTurnIndex)];
  if (!player.seenCards || !target.seenCards) throw fail('You and the previous active player must both have seen your cards');
  if (await charge(session, game, round, player, stake(round, player), 'SHOW_FEE')) return;
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
    // Keep each accepted comparison visible to its two participants for this
    // round, even after packing or a later side show replaces the request.
    requester.sideShowViewers = [...(requester.sideShowViewers || []), target.userId];
    target.sideShowViewers = [...(target.sideShowViewers || []), requester.userId];
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
  if (await charge(session, game, round, player, stake(round, player), 'SHOW_FEE')) return;
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
  const round = await readRound(Round.findById(roundId));
  if (!round) throw fail('Round not found', 404);
  const game = await Game.findById(round.gameId).select('createdBy participants.userId').lean();
  return roundViewWithBalance(round, game, userId);
}

async function getCurrentRoundForGame(gameId, userId) {
  const game = await requireGameAccess(gameId, userId);
  if (game.currentRoundNumber === 0) return null;
  // The authorized viewer's wallet and the populated round are independent.
  // Other players receive turn updates without waiting for these reads in series.
  const [round, balance] = await Promise.all([
    readRound(Round.findOne({ gameId, roundNumber: game.currentRoundNumber })),
    availableBalance(userId, null),
  ]);
  return round ? roundViewWithBalance(round, game, userId, balance) : null;
}

async function roundViewWithBalance(round, game, userId, balance) {
  await canAccessGame(game, userId);
  const view = roundForViewer(round, userId);
  if (!view.potLimit && round.players.every(p => p.cards?.length === 3)) view.potLimit = round.startingBet * 100;
  view.availableBalance = balance ?? await availableBalance(userId, null);
  return view;
}
module.exports = { startRound, bet, betTwice, pack, seeCards, requestSideShow, respondSideShow, submitSideShowResult, requestShow, submitShowResult, getRoundById, getCurrentRoundForGame };
