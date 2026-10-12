const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { init } = require('../src/shared/sockets');
const Game = require('../src/modules/games/game.model');
const Round = require('../src/modules/rounds/round.model');
const User = require('../src/modules/users/user.model');
const Transaction = require('../src/modules/ledger/transaction.model');
const Invitation = require('../src/modules/invitations/invitation.model');

jest.setTimeout(120000);
let database, players, tokens, game;
const emit = jest.fn();
const fakeIO = { use: jest.fn(), on: jest.fn(), to: jest.fn(() => ({ emit })) };
const post = (path, player = 0, body = {}) => request(app).post(`/api${path}`).set('Authorization', `Bearer ${tokens[player]}`).send(body);
const get = (path, player = 0) => request(app).get(`/api${path}`).set('Authorization', `Bearer ${tokens[player]}`);
const patch = (path, player = 0, body = {}) => request(app).patch(`/api${path}`).set('Authorization', `Bearer ${tokens[player]}`).send(body);
const cards = (...codes) => codes.map(code => ({ rank: Number(code.slice(0,-1)), suit: code.slice(-1) }));
async function deal() {
  const response = await post(`/games/${game._id}/rounds`);
  expect(response.status).toBe(201);
  return response.body;
}
async function stored(round) { return Round.findById(round._id).select('+players.cards').lean(); }
async function forceHands(round, hands) {
  const updates = {};
  hands.forEach((hand,index) => { updates[`players.${index}.cards`] = hand; });
  await Round.updateOne({ _id:round._id }, { $set:updates });
}
async function expectBalanced(roundId) {
  const tx = await Transaction.find({ roundId });
  const sum = tx.reduce((total, transaction) => total + transaction.amount, 0);
  expect(sum).toBe(0);
  const currentGame = await Game.findById(game._id);
  expect(currentGame.participants.reduce((sum,p) => sum+p.balance,0)).toBe(0);
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count:1 }, binary: { downloadDir: '/tmp/teen-patti-mongodb' } });
  await mongoose.connect(database.getUri());
  init(fakeIO);
  await Promise.all([Round.init(), Game.init(), User.init(), Invitation.init()]);
});
afterAll(async () => { await mongoose.disconnect(); if (database) await database.stop(); });
beforeEach(async () => {
  await Promise.all([Game.deleteMany({}),Round.deleteMany({}),User.deleteMany({}),Transaction.deleteMany({}),Invitation.deleteMany({})]);
  players = await User.create(Array.from({length:4}, (_,i) => ({ name:`Player ${i+1}`,email:`player${i}@example.test`,username:`player${i}`,passwordHash:'test-only-hash',globalBalance:1000 })));
  tokens = players.map(user => jwt.sign({id:String(user._id)},process.env.JWT_SECRET || 'secret'));
  game = await Game.create({ name:'Integration table',createdBy:players[0]._id,mode:'CLASSIC',bootAmount:10,maxBetMultiplier:5,status:'ACTIVE',participants:players.slice(0,3).map(user=>({userId:user._id})),turnOrder:players.slice(0,3).map(user=>user._id) });
  emit.mockClear();
});

test('deal stores unique cards, takes boot exactly once, keeps blind hands off HTTP and sockets', async () => {
  const round = await deal();
  expect(round.potAmount).toBe(30);
  expect(round.potLimit).toBe(1000);
  expect(round.players.every(p=>!p.cards && !p.handRank && !p.seenCards)).toBe(true);
  const raw = await stored(round);
  expect(new Set(raw.players.flatMap(p=>p.cards).map(c=>`${c.rank}${c.suit}`)).size).toBe(9);
  expect(await Transaction.countDocuments({type:'BOOT'})).toBe(3);
  expect(emit.mock.calls.every(([,payload]) => !payload.round && !payload.players)).toBe(true);
  expect((await post(`/games/${game._id}/rounds`)).status).toBe(400);
});

test.each([2, 6])('dealing to %i players groups wallet checks and boot writes', async count => {
  const extra = count > players.length ? await User.create(Array.from({ length: count - players.length }, (_, i) => ({
    name: `Extra ${i}`, email: `boot-extra${i}@example.test`, username: `boot-extra${i}`, passwordHash: 'test-only', globalBalance: 1000,
  }))) : [];
  const seated = [...players, ...extra].slice(0, count);
  await Game.updateOne({ _id: game._id }, { $set: {
    participants: seated.map(user => ({ userId: user._id, balance: 0 })), turnOrder: seated.map(user => user._id),
  } });
  const calls = [], previousDebug = mongoose.get('debug');
  mongoose.set('debug', (collection, method) => calls.push({ collection, method }));
  let round;
  try {
    round = await deal();
    const writes = calls.filter(call => call.collection === 'users' && ['updateOne', 'updateMany', 'bulkWrite'].includes(call.method));
    const ledgerWrites = calls.filter(call => call.collection === 'transactions' && ['insertOne', 'insertMany'].includes(call.method));
    const balanceReads = calls.filter(call => call.collection === 'games' && call.method === 'find');
    expect(writes).toHaveLength(1);
    expect(ledgerWrites).toHaveLength(1);
    expect(balanceReads).toHaveLength(1); // The response reuses the grouped boot check.
  } finally { mongoose.set('debug', previousDebug); }
  expect(round.potAmount).toBe(count * 10);
  expect(round.players.every(player => player.totalContribution === 10)).toBe(true);
  expect(await Transaction.countDocuments({ roundId: round._id, type: 'BOOT' })).toBe(count);
  const storedGame = await Game.findById(game._id);
  expect(storedGame.participants.map(player => player.balance)).toEqual(Array(count).fill(-10));
});

test('full game refresh uses its authorized game without a second game read', async () => {
  const calls = [], previousDebug = mongoose.get('debug');
  mongoose.set('debug', (collection, method) => { if (collection === 'games' && method === 'findOne') calls.push(method); });
  try {
    const response = await get(`/games/${game._id}`);
    expect(response.status).toBe(200);
    expect(response.body.createdBy.name).toBe('Player 1');
    expect(response.body.participants[1].userId.name).toBe('Player 2');
    expect(response.body.turnOrder[2].name).toBe('Player 3');
    expect(calls).toHaveLength(1);
  } finally { mongoose.set('debug', previousDebug); }
});

test('a turn response reuses its checked wallet balance and includes a show payout', async () => {
  const round = await deal();
  const calls = [], previousDebug = mongoose.get('debug');
  mongoose.set('debug', (collection, method) => { if (collection === 'games' && method === 'find') calls.push(method); });
  try {
    const bet = await post(`/rounds/${round._id}/bet`);
    expect(bet.status).toBe(200);
    expect(bet.body.availableBalance).toBe(980);
    expect(calls).toHaveLength(1);
  } finally { mongoose.set('debug', previousDebug); }
  await post(`/rounds/${round._id}/pack`, 1);
  await forceHands(round, [cards('14S', '14H', '14D'), cards('2S', '5H', '8D'), cards('3S', '6H', '9D')]);
  await post(`/rounds/${round._id}/bet`, 2);
  const show = await post(`/rounds/${round._id}/show/request`);
  expect(show.status).toBe(200);
  expect(show.body.winnerId._id).toBe(String(players[0]._id));
  expect(show.body.availableBalance).toBe(1030); // 1000 - boot - bet - fee + 60 pot.
  expect((await get(`/rounds/${round._id}`)).body.availableBalance).toBe(1030);
});

test('round revisions increase only after committed actions and sockets expose only the marker', async () => {
  const round = await deal();
  expect(round.revision).toBe(1);
  const seen = await post(`/rounds/${round._id}/see-cards`);
  expect(seen.body.revision).toBe(2);
  const bet = await post(`/rounds/${round._id}/bet`);
  expect(bet.body.revision).toBe(3);
  const notifications = emit.mock.calls.map(([, payload]) => payload);
  expect(notifications.map(payload => payload.revision)).toEqual([1, 2, 3]);
  expect(notifications[2]).toEqual({ gameId: String(game._id), roundId: round._id, roundNumber: 1, revision: 3 });
  expect((await post(`/rounds/${round._id}/bet`)).status).toBe(403);
  expect((await stored(round)).revision).toBe(3);
  expect(emit.mock.calls).toHaveLength(3);
});

test.each(['bet', 'bet-twice'])('%s marks Chaal only after a seen player pays', async action => {
  const round = await deal();
  expect(round.players[0].lastBet).toBeUndefined();
  const seen = await post(`/rounds/${round._id}/see-cards`, 0);
  expect(seen.body.players[0].seenCards).toBe(true);
  expect(seen.body.players[0].lastBet).toBeUndefined();
  expect((await post(`/rounds/${round._id}/${action}`, 1)).status).toBe(403);
  const result = await post(`/rounds/${round._id}/${action}`, 0);
  expect(result.status).toBe(200);
  expect(result.body.players[0].lastBet).toBe('CHAAL');
  expect(result.body.players[0].status).toBe('ACTIVE');
  expect(result.body.players[0].totalContribution).toBe(action === 'bet' ? 30 : 50);
  expect(result.body.currentTurnIndex).toBe(1);
  const blind = await post(`/rounds/${round._id}/bet`, 1);
  expect(blind.body.players[1].lastBet).toBe('BLIND');
  expect(blind.body.players[1].seenCards).toBe(false);
  expect((await get(`/rounds/${round._id}`, 2)).body.players[0].lastBet).toBe('CHAAL');
  expect((await get(`/rounds/${round._id}`, 2)).body.players[0].cards).toBeUndefined();
});

test('concurrent deals at different tables cannot spend the same shared wallets twice', async () => {
  await User.updateMany({ _id: { $in: players.slice(0, 3).map(player => player._id) } }, { $set: { globalBalance: 10 } });
  const other = await Game.create({ name: 'Second table', createdBy: players[0]._id, bootAmount: 10, status: 'ACTIVE',
    participants: players.slice(0, 3).map(player => ({ userId: player._id })), turnOrder: players.slice(0, 3).map(player => player._id),
  });
  const responses = await Promise.all([post(`/games/${game._id}/rounds`), post(`/games/${other._id}/rounds`)]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 400]);
  expect(await Round.countDocuments({})).toBe(1);
  expect(await Transaction.countDocuments({ type: 'BOOT' })).toBe(3);
  const tables = await Game.find({});
  for (const player of players.slice(0, 3)) {
    expect(tables.reduce((sum, table) => sum + table.participants.find(seat => String(seat.userId) === String(player._id)).balance, 10)).toBe(0);
  }
});

// Grow the pot through real payments, so boundary checks also exercise the ledger.
async function nearPotLimit(round) {
  await Game.updateOne({ _id: game._id }, { $set: { maxBetMultiplier: 8 } });
  let current = round;
  for (let index = 0; index < 2; index++) {
    const response = await post(`/rounds/${round._id}/bet-twice`, current.currentTurnIndex);
    expect(response.status).toBe(200);
    current = response.body;
  }
  while (current.potAmount + current.currentBet < current.potLimit) {
    const response = await post(`/rounds/${round._id}/bet`, current.currentTurnIndex);
    expect(response.status).toBe(200);
    current = response.body;
  }
  return current;
}

test.each(['bet', 'bet-twice', 'side-show/request'])('%s stops at 100× boot, reveals active hands and pays once even with concurrent requests', async action => {
  const round = await deal();
  await forceHands(round, [cards('14S','14H','14D'), cards('13S','13H','13D'), cards('2S','5H','8D')]);
  const current = await nearPotLimit(round);
  expect(current.potAmount).toBe(970);
  if (action === 'side-show/request') {
    await post(`/rounds/${round._id}/see-cards`, current.currentTurnIndex);
    await post(`/rounds/${round._id}/see-cards`, (current.currentTurnIndex + 2) % 3);
  }
  const [a, b] = await Promise.all([post(`/rounds/${round._id}/${action}`, current.currentTurnIndex), post(`/rounds/${round._id}/${action}`, current.currentTurnIndex)]);
  expect([a.status, b.status].sort()).toEqual([200, 400]);
  const result = a.status === 200 ? a.body : b.body;
  expect(result.potAmount).toBe(1000);
  expect(result.status).toBe('COMPLETED');
  expect(result.completionReason).toBe('POT_LIMIT');
  expect(result.winnerId._id).toBe(String(players[0]._id));
  expect(result.players.every(p => p.cards?.length === 3 && p.revealed)).toBe(true);
  expect(result.sideShowRequest?.result).not.toBe('PENDING');
  const charges = await Transaction.find({ roundId: round._id, type: { $ne: 'ROUND_WIN' } }).sort({ createdAt: -1 });
  expect(charges[0].amount).toBe(-30);
  expect(await Transaction.countDocuments({ roundId: round._id, type: 'ROUND_WIN' })).toBe(1);
  await expectBalanced(round._id);
  const next = await deal();
  expect(next.potAmount).toBe(30);
  expect(next.potLimit).toBe(1000);
});

test('cap comparison uses jokers, excludes packed hands, and needs only the remaining balance for a seen payment', async () => {
  await Game.updateOne({ _id: game._id }, { $set: { mode: 'JOKER', bootAmount: 7 } });
  const round = await deal();
  await Round.updateOne({ _id: round._id }, { $set: { jokerCard: { rank: 9, suit: 'C' } } });
  await forceHands(round, [cards('14S','14H','14D'), cards('12S','12H','12D'), cards('9S','13H','13D')]);
  await post(`/rounds/${round._id}/pack`, 0);
  const current = await nearPotLimit({ ...round, currentTurnIndex: 1 });
  expect(current.potLimit).toBe(700);
  const payer = current.currentTurnIndex;
  const raw = await stored(round);
  await User.updateOne({ _id: players[payer]._id }, { $set: { globalBalance: raw.players[payer].totalContribution + 21 } });
  await post(`/rounds/${round._id}/see-cards`, payer);
  const response = await post(`/rounds/${round._id}/bet`, payer);
  expect(response.status).toBe(200);
  expect(response.body.potAmount).toBe(700);
  expect(response.body.winnerId._id).toBe(String(players[2]._id));
  expect(response.body.players[0].cards).toBeUndefined();
  expect(response.body.players[1].cards).toHaveLength(3);
  expect(response.body.players[2].handRank).toBe('Trail');
  await expectBalanced(round._id);
});

test('at the cap a heads-up show splits equal hands instead of applying the requester tie rule', async () => {
  const round = await deal();
  await forceHands(round, [cards('2S','5H','8D'), cards('14S','12H','9D'), cards('14C','12D','9S')]);
  await post(`/rounds/${round._id}/pack`, 0);
  const current = await nearPotLimit({ ...round, currentTurnIndex: 1 });
  const response = await post(`/rounds/${round._id}/show/request`, current.currentTurnIndex);
  expect(response.status).toBe(200);
  expect(response.body.completionReason).toBe('POT_LIMIT');
  expect(response.body.winnerId).toBeUndefined();
  expect(response.body.players.filter(p => p.status === 'WINNER').map(p => p.winAmount)).toEqual([500, 500]);
  expect(response.body.players[0].cards).toBeUndefined();
  await expectBalanced(round._id);
});

test('three equal best hands split the capped pot with a deterministic whole-rupee remainder', async () => {
  const round = await deal();
  await forceHands(round, [cards('14S','12H','9D'), cards('14C','12D','9S'), cards('14H','12S','9C')]);
  const current = await nearPotLimit(round);
  const response = await post(`/rounds/${round._id}/bet`, current.currentTurnIndex);
  expect(response.status).toBe(200);
  expect(response.body.players.map(p => p.winAmount)).toEqual([334, 333, 333]);
  expect(response.body.players.every(p => p.status === 'WINNER')).toBe(true);
  expect(await Transaction.countDocuments({ roundId: round._id, type: 'ROUND_WIN' })).toBe(3);
  await expectBalanced(round._id);
});

test('an exact cap payment triggers comparison and older digital rounds acquire the boot-based cap', async () => {
  await Game.updateOne({ _id: game._id }, { $set: { participants: game.participants.slice(0, 2), turnOrder: game.turnOrder.slice(0, 2) } });
  const round = await deal();
  await Round.updateOne({ _id: round._id }, { $unset: { potLimit: 1 } });
  expect((await get(`/rounds/${round._id}`)).body.potLimit).toBe(1000);
  const current = await nearPotLimit(round);
  expect(current.potAmount).toBe(960);
  const response = await post(`/rounds/${round._id}/bet`, current.currentTurnIndex);
  expect(response.body.potAmount).toBe(1000);
  expect(response.body.completionReason).toBe('POT_LIMIT');
  await expectBalanced(round._id);
});
test('only host may deal, and outsiders cannot read rounds or game history', async () => {
  expect((await post(`/games/${game._id}/rounds`,1)).status).toBe(403);
  const round = await deal();
  for (const path of [`/rounds/${round._id}`,`/games/${game._id}/rounds/current`,`/games/${game._id}`,`/games/${game._id}/transactions`,`/games/${game._id}/summary`]) expect((await get(path,3)).status).toBe(403);
});
test('seeing cards works off-turn, reveals only own cards and charges seen stake', async () => {
  const round = await deal();
  const seen = await post(`/rounds/${round._id}/see-cards`,1);
  expect(seen.status).toBe(200);
  expect(seen.body.currentTurnIndex).toBe(0);
  expect(seen.body.players[1].cards).toHaveLength(3);
  expect(seen.body.players[0].cards).toBeUndefined();
  expect((await get(`/rounds/${round._id}`,0)).body.players[1].cards).toBeUndefined();
  await post(`/rounds/${round._id}/bet`,0);
  const bet = await post(`/rounds/${round._id}/bet`,1);
  expect(bet.status).toBe(200);
  expect(bet.body.potAmount).toBe(60);
  expect(bet.body.players[1].totalContribution).toBe(30);
  expect(bet.body.availableBalance).toBe(970);
});

test('seeing cards uses an atomic round patch without starting a financial transaction', async () => {
  const round = await deal();
  const sessions = jest.spyOn(mongoose, 'startSession');
  try {
    const seen = await post(`/rounds/${round._id}/see-cards`, 1);
    expect(seen.status).toBe(200);
    expect(seen.body.players[1].cards).toHaveLength(3);
    expect(seen.body.availableBalance).toBe(990);
    expect(sessions).not.toHaveBeenCalled();
    expect(seen.body.revision).toBe(2);
    expect(await Transaction.countDocuments({ type: { $ne: 'BOOT' } })).toBe(0);
  } finally { sessions.mockRestore(); }
});

test('simultaneous card reveals and bets preserve seen state, revision and stake', async () => {
  const round = await deal();
  const [seen, bet] = await Promise.all([post(`/rounds/${round._id}/see-cards`, 0), post(`/rounds/${round._id}/bet`, 0)]);
  expect(seen.status).toBe(200); expect(bet.status).toBe(200);
  const current = await stored(round);
  expect(current.players[0].seenCards).toBe(true);
  expect(current.revision).toBe(3);
  expect(current.currentTurnIndex).toBe(1);
  const fee = await Transaction.findOne({ roundId: round._id, type: 'BET' });
  // Either valid serialization is allowed: blind before reveal or Chaal after it.
  expect([-10, -20]).toContain(fee.amount);
  expect(current.players[0].lastBet).toBe(fee.amount === -20 ? 'CHAAL' : 'BLIND');
  expect(current.potAmount).toBe(30 - fee.amount);
  expect(current.players[0].totalContribution).toBe(10 - fee.amount);
});

test('card reveal and table refresh avoid re-reading rounds and games already loaded', async () => {
  const round = await deal();
  const queries = [];
  const previousDebug = mongoose.get('debug');
  mongoose.set('debug', (collection, method) => { if (method === 'findOne') queries.push(collection); });
  try {
    const seen = await post(`/rounds/${round._id}/see-cards`, 1);
    expect(seen.status).toBe(200);
    expect(seen.body.players[1].cards).toHaveLength(3);
    expect(seen.body.players[0].cards).toBeUndefined();
    expect(queries.filter(name => name === 'rounds')).toHaveLength(1);
    expect(queries.filter(name => name === 'games')).toHaveLength(1);
    queries.length = 0;
    const refreshed = await get(`/games/${game._id}/rounds/current`, 1);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.players[1].cards).toHaveLength(3);
    expect(refreshed.body.availableBalance).toBe(990);
    expect(queries.filter(name => name === 'rounds')).toHaveLength(1);
    expect(queries.filter(name => name === 'games')).toHaveLength(1);
  } finally { mongoose.set('debug', previousDebug); }
});
test('turn enforcement and raise cap do not alter the ledger on rejection', async () => {
  const round = await deal();
  expect((await post(`/rounds/${round._id}/bet`,1)).status).toBe(403);
  expect((await post(`/rounds/${round._id}/bet-twice`,0)).body.currentBet).toBe(20);
  expect((await post(`/rounds/${round._id}/bet-twice`,1)).body.currentBet).toBe(40);
  expect((await post(`/rounds/${round._id}/bet-twice`,2)).status).toBe(400);
  expect((await stored(round)).potAmount).toBe(90);
});
test('packing awards the pot once, conserves balances and rotates the next dealer', async () => {
  const round = await deal();
  await post(`/rounds/${round._id}/pack`,0);
  const result = await post(`/rounds/${round._id}/pack`,1);
  expect(result.body.status).toBe('COMPLETED');
  expect(String(result.body.winnerId._id)).toBe(String(players[2]._id));
  expect(result.body.players.every(p=>!p.cards)).toBe(true);
  expect((await post(`/rounds/${round._id}/pack`,1)).status).toBe(400);
  expect(await Transaction.countDocuments({roundId:round._id,type:'ROUND_WIN'})).toBe(1);
  await expectBalanced(round._id);
  expect((await deal()).currentTurnIndex).toBe(1);
});
test('show compares actual hands, reveals contenders only and rejects client-selected results', async () => {
  const round = await deal();
  await forceHands(round,[cards('2S','5H','8D'),cards('14S','14H','14D'),cards('13S','13H','13D')]);
  await post(`/rounds/${round._id}/pack`,0);
  const result = await post(`/rounds/${round._id}/show/request`,1);
  expect(result.status).toBe(200);
  expect(result.body.winnerId._id).toBe(String(players[1]._id));
  expect(result.body.potAmount).toBe(40);
  expect(result.body.players[0].cards).toBeUndefined();
  expect(result.body.players[1].handRank).toBe('Trail');
  expect(result.body.players[2].cards).toHaveLength(3);
  expect((await post(`/rounds/${round._id}/show/result`,2,{winnerUserId:String(players[2]._id)})).status).toBe(403);
  await expectBalanced(round._id);
});
test('equal hands award a show to the non-requester when both players are seen', async () => {
  const round = await deal();
  await forceHands(round,[cards('2S','5H','8D'),cards('14S','12H','9D'),cards('14C','12D','9S')]);
  await post(`/rounds/${round._id}/pack`,0);
  await post(`/rounds/${round._id}/see-cards`,1);
  await post(`/rounds/${round._id}/see-cards`,2);
  const show = await post(`/rounds/${round._id}/show/request`,1);
  expect(show.body.winnerId._id).toBe(String(players[2]._id));
  expect(show.body.potAmount).toBe(50);
});

test.each(['CLASSIC', 'JOKER'])('a seen player can force a show against a blind opponent in %s', async mode => {
  await Game.updateOne({ _id: game._id }, { $set: { mode } });
  const round = await deal();
  if (mode === 'JOKER') await Round.updateOne({ _id: round._id }, { $set: { jokerCard: { rank: 9, suit: 'C' } } });
  await forceHands(round, [cards('2S','5H','8D'), mode === 'JOKER' ? cards('9S','14H','14D') : cards('14S','14H','14D'), cards('13S','13H','13D')]);
  expect((await post(`/rounds/${round._id}/show/request`, 0)).status).toBe(400);
  expect(await Transaction.countDocuments({ roundId: round._id, type: 'SHOW_FEE' })).toBe(0);
  await post(`/rounds/${round._id}/pack`, 0);
  const seen = await post(`/rounds/${round._id}/see-cards`, 1);
  expect(seen.body.players[2].seenCards).toBe(false);
  expect(seen.body.players[2].cards).toBeUndefined();
  expect((await post(`/rounds/${round._id}/show/request`, 2)).status).toBe(403);
  const show = await post(`/rounds/${round._id}/show/request`, 1);
  expect(show.status).toBe(200);
  expect(show.body.status).toBe('COMPLETED');
  expect(show.body.completionReason).toBe('SHOW');
  expect(show.body.winnerId._id).toBe(String(players[1]._id));
  expect(show.body.potAmount).toBe(50);
  expect(show.body.players[0].cards).toBeUndefined();
  expect(show.body.players[1].handRank).toBe('Trail');
  expect(show.body.players[2].cards).toHaveLength(3);
  expect(show.body.players[2].seenCards).toBe(false);
  const fees = await Transaction.find({ roundId: round._id, type: 'SHOW_FEE' });
  expect(fees).toHaveLength(1);
  expect(fees[0].amount).toBe(-20);
  await expectBalanced(round._id);
});
test('accepted side show compares hands privately, charges once and packs the requester on ties', async () => {
  const round = await deal();
  await forceHands(round,[cards('14S','12H','9D'),cards('13S','10H','8D'),cards('14C','12D','9S')]);
  expect((await post(`/rounds/${round._id}/side-show/request`,0)).status).toBe(400);
  await post(`/rounds/${round._id}/see-cards`,0);
  await post(`/rounds/${round._id}/see-cards`,2);
  const asked = await post(`/rounds/${round._id}/side-show/request`,0);
  expect(asked.body.potAmount).toBe(50);
  expect(asked.body.players[0].totalContribution).toBe(30);
  expect(asked.body.players[2].cards).toBeUndefined();
  expect((await get(`/rounds/${round._id}`, 2)).body.players[0].cards).toBeUndefined();
  expect((await post(`/rounds/${round._id}/bet`,0)).status).toBe(400);
  expect((await post(`/rounds/${round._id}/side-show/respond`,1,{accept:true})).status).toBe(403);
  const accepted = await post(`/rounds/${round._id}/side-show/respond`,2,{accept:true});
  expect(accepted.body.players[0].status).toBe('PACKED');
  expect(accepted.body.players[0].cards).toEqual(cards('14S','12H','9D'));
  expect(accepted.body.players[0].handRank).toBe('High card');
  expect(accepted.body.players[2].cards).toEqual(cards('14C','12D','9S'));
  expect(accepted.body.players[1].cards).toBeUndefined();
  for (const viewer of [0, 1, 2]) {
    for (const path of [`/rounds/${round._id}`, `/games/${game._id}/rounds/current`]) {
      const response = await get(path, viewer);
      expect(response.status).toBe(200);
      for (const [index, player] of response.body.players.entries()) {
        if (viewer !== 1 && index !== 1) expect(player.cards).toHaveLength(3);
        else { expect(player.cards).toBeUndefined(); expect(player.handRank).toBeUndefined(); }
        expect(player.sideShowViewers).toBeUndefined();
        expect(player.revealed).toBe(false);
      }
    }
  }
  expect((await get(`/rounds/${round._id}`, 3)).status).toBe(403);
  expect(emit.mock.calls.every(([, payload]) => !payload.players && !payload.cards)).toBe(true);
  expect(await Transaction.countDocuments({ roundId: round._id, type: 'SHOW_FEE' })).toBe(1);
  expect(accepted.body.currentTurnIndex).toBe(1);
  expect(accepted.body.status).toBe('ACTIVE');
  expect((await post(`/rounds/${round._id}/side-show/respond`,2,{accept:true})).status).toBe(400);
});
test('declined side show keeps the fee in the pot and advances play', async () => {
  const round = await deal();
  await post(`/rounds/${round._id}/see-cards`,0);await post(`/rounds/${round._id}/see-cards`,2);
  await post(`/rounds/${round._id}/side-show/request`,0);
  const result = await post(`/rounds/${round._id}/side-show/respond`,2,{accept:false});
  expect(result.body.currentTurnIndex).toBe(1);
  expect(result.body.potAmount).toBe(50);
  expect(result.body.players.every(p=>p.status==='ACTIVE')).toBe(true);
  expect(result.body.players[0].cards).toBeUndefined();
  expect((await get(`/rounds/${round._id}`, 0)).body.players[2].cards).toBeUndefined();
});

test.each(['CLASSIC', 'JOKER'])('accepted side show shares both hands when the requester wins in %s', async mode => {
  await Game.updateOne({ _id: game._id }, { $set: { mode } });
  const round = await deal();
  if (mode === 'JOKER') await Round.updateOne({ _id: round._id }, { $set: { jokerCard: { rank: 9, suit: 'C' } } });
  const hand = mode === 'JOKER' ? cards('9S','14H','14D') : cards('14S','14H','14D');
  await forceHands(round, [hand, cards('2S','5H','8D'), cards('13S','13H','13D')]);
  await post(`/rounds/${round._id}/see-cards`, 0);
  await post(`/rounds/${round._id}/see-cards`, 2);
  await post(`/rounds/${round._id}/side-show/request`, 0);
  const accepted = await post(`/rounds/${round._id}/side-show/respond`, 2, { accept: true });
  expect(accepted.status).toBe(200);
  expect(accepted.body.sideShowRequest.result).toBe('REQUESTER_WON');
  expect(accepted.body.players[2].status).toBe('PACKED');
  expect(accepted.body.players[0].cards).toEqual(hand);
  expect(accepted.body.players[0].handRank).toBe('Trail');
  const requester = await get(`/rounds/${round._id}`, 0);
  expect(requester.body.players[2].cards).toEqual(cards('13S','13H','13D'));
  const bystander = await post(`/rounds/${round._id}/see-cards`, 1);
  expect(bystander.body.players[1].cards).toHaveLength(3);
  expect(bystander.body.players[0].cards).toBeUndefined();
  expect(bystander.body.players[2].cards).toBeUndefined();
});

test('side show access survives later comparisons and completion, then resets on the next deal', async () => {
  await Game.updateOne({ _id: game._id }, { $set: {
    participants: players.map(user => ({ userId: user._id })), turnOrder: players.map(user => user._id),
  } });
  const round = await deal();
  await forceHands(round, [cards('2S','5H','8D'), cards('3S','6H','10D'), cards('4S','7H','11D'), cards('14S','14H','14D')]);
  await post(`/rounds/${round._id}/see-cards`, 0);
  await post(`/rounds/${round._id}/see-cards`, 3);
  await post(`/rounds/${round._id}/side-show/request`, 0);
  expect((await post(`/rounds/${round._id}/side-show/respond`, 3, { accept: true })).status).toBe(200);
  await post(`/rounds/${round._id}/see-cards`, 1);
  await post(`/rounds/${round._id}/side-show/request`, 1);
  const pending = await get(`/rounds/${round._id}`, 0);
  expect(pending.body.players[3].cards).toHaveLength(3);
  expect(pending.body.players[1].cards).toBeUndefined();
  expect((await post(`/rounds/${round._id}/side-show/respond`, 3, { accept: true })).status).toBe(200);
  const visibleHands = [[0, 3], [1, 3], [], [0, 1, 3]];
  for (const viewer of [0, 1, 2, 3]) {
    const response = await get(`/games/${game._id}/rounds/current`, viewer);
    expect(response.status).toBe(200);
    response.body.players.forEach((player, index) => {
      expect(Boolean(player.cards)).toBe(visibleHands[viewer].includes(index));
      expect(player.sideShowViewers).toBeUndefined();
    });
  }
  const completed = await post(`/rounds/${round._id}/pack`, 2);
  expect(completed.body.completionReason).toBe('LAST_PLAYER');
  expect(completed.body.players.every(player => !player.cards)).toBe(true);
  const earlierLoser = await get(`/rounds/${round._id}`, 0);
  expect(earlierLoser.body.players[3].cards).toHaveLength(3);
  expect(earlierLoser.body.players[1].cards).toBeUndefined();
  const next = await deal();
  expect(next.players.every(player => !player.cards && !player.sideShowViewers)).toBe(true);
  const target = await get(`/rounds/${next._id}`, 3);
  expect(target.body.players.every(player => !player.cards)).toBe(true);
});
test('joker indicator is public, excluded from hands, and wild rank changes the winner', async () => {
  await Game.updateOne({_id:game._id},{$set:{mode:'JOKER'}});
  const round = await deal();
  expect(round.mode).toBe('JOKER');expect(round.jokerCard.rank).toBeGreaterThanOrEqual(2);
  const raw = await stored(round);
  expect(raw.players.flatMap(p=>p.cards).some(c=>c.rank===round.jokerCard.rank && c.suit===round.jokerCard.suit)).toBe(false);
  await Round.updateOne({_id:round._id},{$set:{jokerCard:{rank:9,suit:'C'}}});
  await forceHands(round,[cards('2S','5H','8D'),cards('9S','14H','14D'),cards('13S','13H','13D')]);
  await post(`/rounds/${round._id}/pack`,0);
  const result = await post(`/rounds/${round._id}/show/request`,1);
  expect(result.body.winnerId._id).toBe(String(players[1]._id));
});
test('insufficient funds roll back the whole deal and a rejected bet', async () => {
  await User.updateOne({_id:players[2]._id},{$set:{globalBalance:9}});
  expect((await post(`/games/${game._id}/rounds`)).status).toBe(400);
  expect(await Round.countDocuments({})).toBe(0);expect(await Transaction.countDocuments({})).toBe(0);
  expect((await Game.findById(game._id)).currentRoundNumber).toBe(0);
  await User.updateOne({_id:players[2]._id},{$set:{globalBalance:1000}});
  const round = await deal();
  await User.updateOne({_id:players[0]._id},{$set:{globalBalance:10}});
  expect((await post(`/rounds/${round._id}/bet`,0)).status).toBe(400);
  expect((await stored(round)).potAmount).toBe(30);
});
test('simultaneous deals and duplicate bets charge only once', async () => {
  const deals = await Promise.all([post(`/games/${game._id}/rounds`),post(`/games/${game._id}/rounds`)]);
  expect(deals.map(r=>r.status).sort()).toEqual([201,400]);
  const round = deals.find(r=>r.status===201).body;
  const bets = await Promise.all([post(`/rounds/${round._id}/bet`),post(`/rounds/${round._id}/bet`)]);
  expect(bets.map(r=>r.status).sort()).toEqual([200,403]);
  expect((await stored(round)).potAmount).toBe(40);
});
test('wallet availability includes losses at other tables', async () => {
  await Game.create({name:'Other active table',createdBy:players[0]._id,bootAmount:10,status:'ACTIVE',participants:[{userId:players[0]._id,balance:-995},{userId:players[3]._id,balance:995}]});
  expect((await post(`/games/${game._id}/rounds`)).status).toBe(400);
  expect(await Transaction.countDocuments({})).toBe(0);
});
test('ending requires completed rounds, settles once and rejects duplicate turn orders', async () => {
  const round = await deal();
  expect((await patch(`/games/${game._id}/end`)).status).toBe(400);
  await post(`/rounds/${round._id}/pack`,0);await post(`/rounds/${round._id}/pack`,1);
  const before = await Game.findById(game._id);
  expect((await patch(`/games/${game._id}/end`)).status).toBe(200);
  for (let i=0;i<3;i++) expect((await User.findById(players[i]._id)).globalBalance).toBe(1000+before.participants[i].balance);
  expect((await patch(`/games/${game._id}/end`)).status).toBe(400);
  await Game.updateOne({_id:game._id},{$set:{status:'TURN_ORDER_SETUP'}});
  expect((await patch(`/games/${game._id}/turn-order`,0,{orderedUserIds:[String(players[0]._id),String(players[0]._id),String(players[2]._id)]})).status).toBe(400);
});
test('invalid settings receive useful validation errors and joker selection persists', async () => {
  const bad = await post('/games',0,{name:'Invalid',bootAmount:-1,mode:'UNKNOWN'});
  expect(bad.status).toBe(400);expect(bad.body.message).toMatch(/Boot amount|Invalid option/);
  const result = await post('/games',0,{name:'Joker table',bootAmount:10,mode:'JOKER'});
  expect(result.status).toBe(201);expect(result.body.mode).toBe('JOKER');expect(result.body.maxBetMultiplier).toBe(5);
});

test('create, invite, accept, finalize, order and start reaches a playable digital table', async () => {
  const created = await post('/games',0,{name:'Friends table',bootAmount:10,mode:'JOKER'});
  const gameId = created.body._id;
  const invitations = await post(`/games/${gameId}/invitations`,0,{userIds:[String(players[1]._id),String(players[2]._id)]});
  expect(invitations.status).toBe(201);
  for (let i=0;i<2;i++) expect((await post(`/invitations/${invitations.body[i]._id}/respond`,i+1,{status:'ACCEPTED'})).status).toBe(200);
  const pending = await Invitation.create({gameId,invitedUserId:players[3]._id,invitedBy:players[0]._id});
  expect((await patch(`/games/${gameId}/finalize-players`)).status).toBe(200);
  expect((await Invitation.findById(pending._id)).status).toBe('DECLINED');
  expect((await patch(`/games/${gameId}/turn-order`,0,{orderedUserIds:players.slice(0,3).map(p=>String(p._id))})).status).toBe(200);
  expect((await patch(`/games/${gameId}/start`)).status).toBe(200);
  const round = await post(`/games/${gameId}/rounds`);
  expect(round.status).toBe(201);expect(round.body.mode).toBe('JOKER');expect(round.body.players).toHaveLength(3);
});
test('failed invitation acceptance remains pending and cannot join a finalized table', async () => {
  const waiting = await Game.create({name:'Waiting',createdBy:players[0]._id,bootAmount:10,status:'WAITING_FOR_PLAYERS',participants:[{userId:players[0]._id}]});
  const invite = await Invitation.create({gameId:waiting._id,invitedUserId:players[1]._id,invitedBy:players[0]._id});
  await User.updateOne({_id:players[1]._id},{$set:{globalBalance:9}});
  expect((await post(`/invitations/${invite._id}/respond`,1,{status:'ACCEPTED'})).status).toBe(400);
  expect((await Invitation.findById(invite._id)).status).toBe('PENDING');
  await User.updateOne({_id:players[1]._id},{$set:{globalBalance:1000}});
  await Game.updateOne({_id:waiting._id},{$set:{status:'TURN_ORDER_SETUP'}});
  expect((await post(`/invitations/${invite._id}/respond`,1,{status:'ACCEPTED'})).status).toBe(400);
});
test('six-player capacity and malformed IDs are rejected', async () => {
  const extra = await User.create(Array.from({length:3},(_,i)=>({name:`Extra ${i}`,email:`extra${i}@example.test`,username:`extra${i}`,passwordHash:'test-only',globalBalance:1000})));
  await Game.updateOne({_id:game._id},{$set:{status:'WAITING_FOR_PLAYERS',participants:[...players.slice(0,3),...extra].map(p=>({userId:p._id}))}});
  const invite = await Invitation.create({gameId:game._id,invitedUserId:players[3]._id,invitedBy:players[0]._id});
  expect((await post(`/invitations/${invite._id}/respond`,3,{status:'ACCEPTED'})).status).toBe(400);
  expect((await get('/rounds/not-an-id')).status).toBe(404);
});
test('legacy physical-card show stays usable, but only the host can select its winner', async () => {
  await Game.updateOne({_id:game._id},{$set:{currentRoundNumber:1}});
  const legacy = await Round.create({gameId:game._id,roundNumber:1,status:'SHOW_PENDING',potAmount:30,currentBet:10,players:players.slice(0,3).map((p,i)=>({userId:p._id,status:i===0?'PACKED':'ACTIVE'}))});
  expect((await post(`/rounds/${legacy._id}/show/result`,1,{winnerUserId:String(players[1]._id)})).status).toBe(403);
  expect((await post(`/rounds/${legacy._id}/show/result`,0,{winnerUserId:String(players[1]._id)})).body.status).toBe('COMPLETED');
});
test('socket connections authenticate players, reject unauthorized rooms and send no hands', async () => {
  const { Server } = require('socket.io');
  const { io: client } = require('socket.io-client');
  const server = require('node:http').createServer(app);
  const io = new Server(server);
  init(io);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  const connect = token => new Promise((resolve,reject)=>{
    const socket = client(url,{auth:{token},transports:['websocket'],reconnection:false,timeout:3000});sockets.push(socket);
    socket.once('connect',()=>resolve(socket));socket.once('connect_error',reject);
  });
  try {
    await expect(connect('invalid')).rejects.toThrow('Sign in');
    const member = await connect(tokens[0]);
    const stranger = await connect(tokens[3]);
    const join = socket => new Promise(resolve=>socket.emit('joinGame',String(game._id),resolve));
    expect(await join(member)).toEqual({ok:true});
    expect((await join(stranger)).ok).toBe(false);
    const update = new Promise(resolve=>member.once('round:update',resolve));
    await deal();
    const payload = await update;
    expect(Object.keys(payload)).toEqual(['gameId', 'roundId', 'roundNumber', 'revision']);
    expect(payload.gameId).toBe(String(game._id));
  } finally {
    sockets.forEach(socket=>socket.disconnect());
    await new Promise(resolve=>io.close(resolve));
    init(fakeIO);
  }
});
test('profile username fee uses global balance, rejects overspending and search exposes only public player data', async () => {
  const result = await request(app).put('/api/users/username').set('Authorization',`Bearer ${tokens[0]}`).send({username:'newplayer'});
  expect(result.status).toBe(200);expect(result.body.globalBalance).toBe(0);
  expect((await Transaction.findOne({type:'FEE'})).amount).toBe(-1000);
  const second = await request(app).put('/api/users/username').set('Authorization',`Bearer ${tokens[0]}`).send({username:'anothername'});
  expect(second.status).toBe(400);
  const users = await get('/users');
  expect(users.status).toBe(200);expect(users.body).toHaveLength(3);
  expect(users.body.every(user=>!user.email && user.globalBalance===undefined && !user.passwordHash)).toBe(true);
  expect((await get('/users?search=%5B')).status).toBe(200);
});
