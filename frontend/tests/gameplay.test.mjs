import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { createTableSync } from '../src/features/rounds/tableSync.js';
import { createRefreshScheduler } from '../src/shared/hooks/refreshScheduler.js';

const entry = fileURLToPath(new URL('../src/features/rounds/GameBoard.jsx', import.meta.url));
const bundle = await rolldown({ input: entry, external: id => id !== entry, transform: { jsx: { runtime: 'classic', pragma: 'element' } } });
const { output } = await bundle.generate({ format: 'cjs' });
await bundle.close();
const compiled = output[0].code;
const panelEntry = fileURLToPath(new URL('../src/features/rounds/components/ActionPanel.jsx', import.meta.url));
const panelBundle = await rolldown({ input: panelEntry, external: id => id !== panelEntry, transform: { jsx: { runtime: 'classic', pragma: 'element' } } });
const panelOutput = await panelBundle.generate({ format: 'cjs' });
await panelBundle.close();
const panelModule = { exports: {} };
new vm.Script(panelOutput.output[0].code).runInNewContext({
  module: panelModule, exports: panelModule.exports, require: () => ({ Loader2: 'Loader2' }),
  element: (type, props, ...children) => ({ type, props: { ...props, children } }),
});
const ActionPanel = panelModule.exports.default || panelModule.exports;
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const game = { _id: 'table', status: 'ACTIVE', createdBy: 'me', bootAmount: 10, maxBetMultiplier: 5, mode: 'CLASSIC', name: 'Table' };
const initialRound = { _id: 'round', status: 'ACTIVE', roundNumber: 1, currentTurnIndex: 0, currentBet: 10, potAmount: 20, potLimit: 1000,
  players: [{ userId: { _id: 'me' }, status: 'ACTIVE', seenCards: false }, { userId: { _id: 'other' }, status: 'ACTIVE', seenCards: false }] };

// Run the real component with deterministic hooks, HTTP promises and socket events.
// No database or wall-clock timing is needed to count network waits before an update.
function board() {
  let cursor = 0, effects = [], tree;
  const hooks = [], cleanups = [], calls = [], listeners = new Map();
  const getters = { game: () => Promise.resolve(game), round: () => Promise.resolve(initialRound) };
  let action = () => Promise.resolve(initialRound);
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { current: initial };
      return hooks[i];
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!sameDeps(hooks[i]?.deps, deps)) hooks[i] = { deps, value: callback };
      return hooks[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!sameDeps(hooks[i]?.deps, deps)) {
        hooks[i] = { deps };
        effects.push(() => { cleanups[i]?.(); cleanups[i] = effect(); });
      }
    },
  };
  const socket = {
    connected: false,
    on: (event, fn) => listeners.set(event, fn),
    off: event => listeners.delete(event),
    emit: (event, id, ack) => { if (event === 'joinGame') ack?.({ ok: true }); },
  };
  const modules = {
    react,
    'react-router-dom': { useParams: () => ({ id: 'table' }), useNavigate: () => () => {}, Link: 'Link' },
    '../auth/AuthContext': { useAuth: () => ({ user: { _id: 'me' } }) },
    '../../shared/hooks/useSocket': { useSocket: () => socket },
    '../games/games.api': {
      getGameById: () => { calls.push('game'); return getters.game(); },
      getCurrentRound: () => { calls.push('round'); return getters.round(); },
    },
    './round.api': Object.fromEntries(['bet', 'betTwice', 'pack', 'requestShow', 'requestSideShow', 'seeCards', 'startRound', 'respondSideShow'].map(name => [name, () => { calls.push(name); return action(); }])),
    'lucide-react': Object.fromEntries(['Loader2', 'Crown', 'ArrowLeft', 'BookOpen', 'History', 'Wifi', 'WifiOff', 'Eye'].map(name => [name, name])),
    './components/PlayerCircle': 'PlayerCircle', './components/PotArea': 'PotArea', './components/ActionPanel': 'ActionPanel',
    './components/Dealer': 'Dealer',
    './components/PlayingCard': { __esModule: true, default: 'PlayingCard', CardHand: 'CardHand', rankLabel: String },
    './table.css': {},
    './tableSync': { createTableSync },
    '../../shared/hooks/refreshScheduler': { createRefreshScheduler: options => createRefreshScheduler({ ...options, setTimer: () => 1, clearTimer() {}, document: undefined }) },
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: name => {
    assert.ok(name in modules, `Unmocked import ${name}`);
    return modules[name];
  }, element: (type, props, ...children) => ({ type, props: { ...props, children } }), setInterval: () => 1, clearInterval() {}, console });
  new vm.Script(compiled).runInContext(context);
  function render() {
    cursor = 0;
    tree = (module.exports.default || module.exports)();
    const pending = effects; effects = [];
    pending.forEach(effect => effect());
    return tree;
  }
  function findAll(type, node) {
    if (!node || typeof node !== 'object') return [];
    return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => findAll(type, child))];
  }
  return { render, find: type => findAll(type, tree)[0], findAll: type => findAll(type, tree), calls, getters, socket, emit: (event, payload = { gameId: 'table' }) => listeners.get(event)?.(payload),
    setAction(fn) { action = fn; }, cleanup() { cleanups.forEach(fn => fn?.()); } };
}

test('See cards, bets and Show update from the action response without waiting for more HTTP requests', async () => {
  for (const name of ['SEE', 'BET', 'SHOW_REQUEST']) {
    const table = board();
    table.render(); await tick(); table.render();
    table.calls.length = 0;
    const result = structuredClone(initialRound);
    result.potAmount = 30;
    result.players[0].seenCards = true;
    result.players[0].cards = [{ rank: 14, suit: 'S' }, { rank: 13, suit: 'H' }, { rank: 12, suit: 'D' }];
    result.players[0].handRank = 'Sequence';
    if (name === 'SHOW_REQUEST') { result.status = 'COMPLETED'; result.winnerId = { name: 'Me' }; }
    table.setAction(() => Promise.resolve(result));
    // These reads represent a slow connection. A successful action already has the round.
    table.getters.game = () => deferred().promise;
    table.getters.round = () => deferred().promise;
    table.find('ActionPanel').props.onAction(name);
    await tick(); table.render();
    assert.equal(table.calls.length, 1, `${name}: additional HTTP requests delay feedback: ${table.calls.join(', ')}`);
    assert.equal(table.find('PotArea').props.potAmount, 30, `${name}: display must update as soon as the action returns`);
    if (name !== 'SHOW_REQUEST') {
      assert.equal(table.find('CardHand').props.cards.length, 3);
      assert.equal(table.find('ActionPanel').props.isProcessing, false);
    }
    table.cleanup();
  }
});

test('accepted side shows display the compared hand for both participants, including the packed player', async () => {
  const own = [{ rank: 14, suit: 'S' }, { rank: 12, suit: 'H' }, { rank: 9, suit: 'D' }];
  const other = [{ rank: 14, suit: 'C' }, { rank: 12, suit: 'D' }, { rank: 9, suit: 'S' }];
  for (const role of ['requester', 'target', 'bystander']) {
    const table = board();
    const result = { ...initialRound, currentTurnIndex: 1, sideShowRequest: {
      requestedBy: role === 'requester' ? 'me' : 'other', targetPlayer: role === 'target' ? 'me' : 'target', result: 'TARGET_WON',
    }, players: [
      { userId: { _id: 'me', name: 'Me' }, status: role === 'requester' ? 'PACKED' : 'ACTIVE', seenCards: true, cards: own, handRank: 'High card' },
      { userId: { _id: 'other', name: 'Opponent' }, status: role === 'target' ? 'PACKED' : 'ACTIVE', seenCards: true,
        ...(role !== 'bystander' ? { cards: other, handRank: 'High card' } : {}) },
      { userId: { _id: 'target', name: 'Third player' }, status: 'ACTIVE', seenCards: false },
    ] };
    table.getters.round = () => Promise.resolve(initialRound);
    table.render(); await tick(); table.render();
    table.getters.round = () => Promise.resolve(result);
    table.emit('round:update'); await tick(); table.render();
    const hands = table.findAll('CardHand');
    assert.equal(hands.length, role === 'bystander' ? 1 : 2);
    assert.deepEqual(hands[0].props.cards, own);
    if (role !== 'bystander') assert.deepEqual(hands[1].props.cards, other);
    const seats = table.findAll('PlayerCircle');
    assert.equal(Boolean(seats.find(seat => seat.props.player.userId._id === 'other').props.player.cards), role !== 'bystander');
    assert.equal(seats.find(seat => seat.props.player.userId._id === 'target').props.player.cards, undefined);
    table.cleanup();
  }
});

test('a completed show retains the viewer\'s full-size hand and the server-revealed opponent cards', async () => {
  const table = board();
  const own = [{ rank: 10, suit: 'C' }, { rank: 6, suit: 'S' }, { rank: 11, suit: 'S' }];
  const other = [{ rank: 3, suit: 'S' }, { rank: 10, suit: 'H' }, { rank: 12, suit: 'S' }];
  const result = { ...initialRound, status: 'COMPLETED', completionReason: 'SHOW', winnerId: { _id: 'other', name: 'Opponent' },
    players: [{ ...initialRound.players[0], cards: own, revealed: true, seenCards: true, handRank: 'High card' },
      { ...initialRound.players[1], status: 'WINNER', cards: other, revealed: true, handRank: 'High card' }] };
  table.getters.round = () => Promise.resolve(result);
  table.render(); await tick(); table.render();
  assert.deepEqual(table.find('CardHand').props.cards, own);
  assert.deepEqual(table.findAll('PlayerCircle')[1].props.player.cards, other);
  assert.equal(table.find('ActionPanel'), undefined);
  table.cleanup();
});

test('socket bursts refresh only the round and combine duplicate notifications', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  table.getters.round = () => Promise.resolve({ ...initialRound, potAmount: 40 });
  table.emit('round:update'); table.emit('round:completed'); table.emit('round:update');
  await tick(); table.render();
  assert.deepEqual(table.calls, ['round']);
  assert.equal(table.find('PotArea').props.potAmount, 40);
  table.cleanup();
});

test('events during an action refresh in the background after controls are enabled', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  const action = deferred(), read = deferred();
  table.setAction(() => action.promise);
  table.getters.round = () => read.promise;
  table.find('ActionPanel').props.onAction('BET');
  table.emit('round:update'); table.emit('round:update');
  await tick(); table.render();
  assert.deepEqual(table.calls, ['bet']);
  assert.equal(table.find('ActionPanel').props.isProcessing, true);
  action.resolve({ ...initialRound, potAmount: 30 });
  await tick(); table.render();
  assert.deepEqual(table.calls, ['bet', 'round']);
  assert.equal(table.find('ActionPanel').props.isProcessing, false);
  assert.equal(table.find('PotArea').props.potAmount, 30);
  read.resolve({ ...initialRound, potAmount: 40 });
  await tick(); table.render();
  assert.equal(table.find('PotArea').props.potAmount, 40);
  table.cleanup();
});

test('a slow refresh cannot overwrite a confirmed action and queues one fresh read', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  const oldRead = deferred(), freshRead = deferred();
  let reads = 0;
  table.getters.round = () => ++reads === 1 ? oldRead.promise : freshRead.promise;
  table.emit('round:update'); await tick();
  table.setAction(() => Promise.resolve({ ...initialRound, potAmount: 30 }));
  table.find('ActionPanel').props.onAction('BET');
  await tick(); table.render();
  assert.equal(table.find('PotArea').props.potAmount, 30);
  oldRead.resolve(initialRound);
  await tick(); table.render();
  assert.equal(table.find('PotArea').props.potAmount, 30);
  assert.equal(reads, 2);
  freshRead.resolve({ ...initialRound, potAmount: 40 });
  await tick(); table.render();
  assert.equal(table.find('PotArea').props.potAmount, 40);
  table.cleanup();
});

test('failed and double-clicked actions leave confirmed cards and pot unchanged', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  const action = deferred();
  table.setAction(() => action.promise);
  const panel = table.find('ActionPanel');
  panel.props.onAction('SEE'); panel.props.onAction('SEE');
  action.reject({ response: { data: { message: 'The round is not accepting actions' } } });
  await tick(); table.render();
  assert.deepEqual(table.calls, ['seeCards']);
  assert.equal(table.find('PotArea').props.potAmount, 20);
  assert.equal(table.find('CardHand').props.cards, undefined);
  assert.equal(table.find('ActionPanel').props.isProcessing, false);
  table.cleanup();
});

test('refresh notifications during a read queue only one follow-up', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  const read = deferred();
  let reads = 0;
  table.getters.round = () => ++reads === 1 ? read.promise : Promise.resolve({ ...initialRound, potAmount: 40 });
  table.emit('round:update'); await tick();
  for (let i = 0; i < 20; i++) table.emit('round:update');
  await tick();
  assert.equal(reads, 1);
  read.resolve({ ...initialRound, potAmount: 30 });
  await tick(); table.render();
  assert.deepEqual(table.calls, ['round', 'round']);
  assert.equal(table.find('PotArea').props.potAmount, 40);
  table.cleanup();
});

test('initial table reads run together and setup tables tolerate missing round access', async () => {
  const gameRead = deferred(), roundRead = deferred();
  const states = [], errors = [], calls = [];
  const sync = createTableSync({
    loadGame: () => { calls.push('game'); return gameRead.promise; },
    loadRound: () => { calls.push('round'); return roundRead.promise; },
    onState: state => states.push(state), onError: error => errors.push(error), onLoaded() {},
  });
  const loading = sync.refresh(); await tick();
  assert.deepEqual(calls, ['game', 'round']);
  roundRead.reject(new Error('You are not a participant at this table'));
  gameRead.resolve({ ...game, status: 'WAITING_FOR_PLAYERS' });
  await loading;
  assert.equal(states[0].round, null);
  assert.deepEqual(errors, [null]);
  sync.dispose();
});

test('game notifications still refresh game status and reconnect reloads the table', async () => {
  const table = board();
  table.render(); await tick(); table.render(); table.calls.length = 0;
  table.emit('connect'); await tick(); table.render();
  assert.deepEqual(table.calls, ['game', 'round']);
  table.calls.length = 0;
  table.getters.game = () => Promise.resolve({ ...game, status: 'ENDED' });
  table.emit('game:update'); await tick(); table.render();
  assert.deepEqual(table.calls, ['game', 'round']);
  assert.equal(table.find('PotArea'), undefined);
  table.cleanup();
});

test('disposed tables ignore late reads and late action responses', async () => {
  const gameRead = deferred(), roundRead = deferred(), states = [];
  const sync = createTableSync({ loadGame: () => gameRead.promise, loadRound: () => roundRead.promise,
    onState: state => states.push(state), onError() {}, onLoaded() {} });
  const loading = sync.refresh(); await tick();
  sync.pause(); sync.dispose(); sync.resume(initialRound);
  gameRead.resolve(game); roundRead.resolve(initialRound);
  await loading;
  assert.equal(states.length, 0);
});

test('Show stays enabled for a seen player facing a blind opponent with two players left', async () => {
  const table = board();
  table.getters.round = () => Promise.resolve({ ...initialRound, startingBet: 10,
    players: [{ ...initialRound.players[0], seenCards: true }, initialRound.players[1]] });
  table.render(); await tick(); table.render();
  const panel = ActionPanel(table.find('ActionPanel').props);
  const show = panel.props.children[1].props.children.find(node => node?.props?.children[0] === 'Show');
  assert.ok(show);
  assert.equal(show.props.disabled, false);
  assert.equal(show.props.children[1].props.children.join(''), '₹20');
  table.cleanup();
});

test('the acting player does not refetch their own confirmed round revision', async () => {
  const states = [], calls = [];
  const sync = createTableSync({
    loadGame: () => Promise.resolve(game),
    loadRound: () => { calls.push('round'); return Promise.resolve({ ...initialRound, revision: 1 }); },
    onState: state => states.push(state), onError() {}, onLoaded() {},
  });
  await sync.refresh(); calls.length = 0;
  const notification = { gameId: 'table', roundId: 'round', roundNumber: 1, revision: 2 };
  sync.pause();
  sync.refresh(true, notification);
  sync.resume({ ...initialRound, revision: 2, potAmount: 30 });
  await tick();
  assert.deepEqual(calls, [], 'The action response already covers this notification');
  sync.refresh(true, notification); await tick();
  assert.deepEqual(calls, [], 'A late duplicate notification is covered too');
  assert.equal(states.at(-1).round.potAmount, 30);
  sync.dispose();
});

test('a newer peer action and a new deal are not discarded with the actor notification', async () => {
  const states = [], calls = [];
  let loaded = { ...initialRound, revision: 1 };
  const sync = createTableSync({ loadGame: () => Promise.resolve(game), loadRound: () => { calls.push('round'); return Promise.resolve(loaded); },
    onState: state => states.push(state), onError() {}, onLoaded() {} });
  await sync.refresh(); calls.length = 0;
  sync.pause();
  sync.refresh(true, { roundId: 'round', roundNumber: 1, revision: 2 });
  sync.refresh(true, { roundId: 'round', roundNumber: 1, revision: 3 });
  loaded = { ...initialRound, revision: 3, potAmount: 40 };
  sync.resume({ ...initialRound, revision: 2, potAmount: 30 });
  await tick();
  assert.deepEqual(calls, ['round']);
  assert.equal(states.at(-1).round.potAmount, 40);
  loaded = { ...initialRound, _id: 'next-round', roundNumber: 2, revision: 1 };
  await sync.refresh(true, { roundId: 'next-round', roundNumber: 2, revision: 1 });
  assert.equal(states.at(-1).round._id, 'next-round');
  calls.length = 0;
  await sync.refresh(true, { roundId: 'round', roundNumber: 1, revision: 99 });
  assert.deepEqual(calls, [], 'An old round notification cannot invalidate a newer deal');
  sync.dispose();
});

test('full and legacy refreshes still update balances even when the round revision is unchanged', async () => {
  const states = [];
  let balance = 990;
  const sync = createTableSync({ loadGame: () => Promise.resolve(game), loadRound: () => Promise.resolve({ ...initialRound, revision: 1, availableBalance: balance }),
    onState: state => states.push(state), onError() {}, onLoaded() {} });
  await sync.refresh();
  balance = 970;
  await sync.refresh(true); // Old server notifications carry no revision.
  assert.equal(states.at(-1).round.availableBalance, 970);
  balance = 950;
  await sync.refresh(); // A payment at another table can change the wallet only.
  assert.equal(states.at(-1).round.availableBalance, 950);
  sync.dispose();
});

test('a delayed lower round revision cannot roll back a confirmed action', async () => {
  const states = [];
  const sync = createTableSync({ loadGame: () => Promise.resolve(game), loadRound: () => Promise.resolve({ ...initialRound, revision: 1, potAmount: 20 }),
    onState: state => states.push(state), onError() {}, onLoaded() {} });
  await sync.refresh();
  sync.pause(); sync.resume({ ...initialRound, revision: 2, potAmount: 30 });
  await sync.refresh();
  assert.equal(states.at(-1).round.potAmount, 30);
  sync.dispose();
});

function fakeClock() {
  let now = 0, serial = 0;
  const timers = new Map(), listeners = new Set();
  const page = { hidden: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  return {
    page, timers,
    setTimer(fn, delay) { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await tick();
      }
      now = target;
    },
    visibility(hidden) { page.hidden = hidden; listeners.forEach(fn => fn()); },
  };
}

test('polling slows on a healthy live connection and restores the ten-second fallback', async () => {
  const clock = fakeClock();
  let connected = true, calls = 0;
  const polling = createRefreshScheduler({ refresh: () => calls++, isConnected: () => connected,
    document: clock.page, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  await clock.advance(60000);
  assert.equal(calls, 1);
  connected = false; polling.reschedule();
  await clock.advance(30000);
  assert.equal(calls, 4);
  polling.dispose();
  await clock.advance(60000);
  assert.equal(calls, 4);
});

test('hidden tables queue socket updates without reading and refresh immediately when visible', async () => {
  const clock = fakeClock(), calls = [];
  const sync = createTableSync({ loadGame: () => { calls.push('game'); return Promise.resolve(game); },
    loadRound: () => { calls.push('round'); return Promise.resolve(initialRound); }, onState() {}, onError() {}, onLoaded() {} });
  const polling = createRefreshScheduler({ refresh: () => sync.refresh(), onVisibility: sync.setVisible,
    document: clock.page, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  await sync.refresh(); calls.length = 0;
  clock.visibility(true);
  sync.refresh(true); sync.refresh(true);
  await clock.advance(120000);
  assert.deepEqual(calls, []);
  clock.visibility(false); await tick();
  assert.deepEqual(calls, ['game', 'round']);
  polling.dispose(); sync.dispose();
});

test('polling never overlaps slow requests or restarts after leaving the screen', async () => {
  const clock = fakeClock(), read = deferred();
  let calls = 0;
  const polling = createRefreshScheduler({ refresh: () => { calls++; return read.promise; },
    document: clock.page, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  await clock.advance(100000);
  assert.equal(calls, 1);
  polling.dispose(); read.resolve(); await tick();
  assert.equal(clock.timers.size, 0);
});

test('GameBoard forwards revision markers so live See, bet and Show add no extra read', async () => {
  for (const action of ['SEE', 'BET', 'SHOW_REQUEST']) {
    const table = board(), response = deferred();
    table.getters.round = () => Promise.resolve({ ...initialRound, revision: 1 });
    table.render(); await tick(); table.render(); table.calls.length = 0;
    table.setAction(() => response.promise);
    table.find('ActionPanel').props.onAction(action);
    table.emit('round:update', { gameId: 'table', roundId: 'round', roundNumber: 1, revision: 2 });
    response.resolve({ ...initialRound, revision: 2, potAmount: 30 });
    await tick(); table.render();
    assert.equal(table.calls.length, 1, `${action}: a confirmed live action needs only its POST`);
    assert.equal(table.find('ActionPanel').props.isProcessing, false);
    assert.equal(table.find('PotArea').props.potAmount, 30);
    table.cleanup();
  }
});

test('a late room acknowledgement cannot mark a disconnected table as live', async () => {
  const table = board();
  let acknowledge;
  table.socket.emit = (event, id, ack) => { if (event === 'joinGame') acknowledge = ack; };
  table.render(); await tick(); table.render(); table.calls.length = 0;
  table.emit('connect'); table.emit('disconnect');
  acknowledge({ ok: true }); await tick(); table.render();
  assert.deepEqual(table.calls, []);
  assert.ok(table.find('WifiOff'));
  table.cleanup();
});
