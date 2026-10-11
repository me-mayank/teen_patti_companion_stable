const { createDeck, dealCards, evaluateHand, compareHands } = require('../src/modules/cards/cards.service');
const { roundForViewer } = require('../src/modules/rounds/round.view');
const hand = (...codes) => codes.map(code => ({ rank: Number(code.slice(0, -1)), suit: code.slice(-1) }));

describe('Cards and joker rules', () => {
  test('every deal has three unique cards per player and excludes the indicator', () => {
    for (const mode of ['CLASSIC', 'JOKER']) {
      for (let count = 2; count <= 6; count++) {
        for (let repeat = 0; repeat < 30; repeat++) {
          const { hands, jokerCard } = dealCards(count, mode);
          expect(hands.every(h => h.length === 3)).toBe(true);
          const cards = [...hands.flat(), ...(jokerCard ? [jokerCard] : [])];
          expect(new Set(cards.map(c => `${c.rank}${c.suit}`)).size).toBe(cards.length);
          expect(Boolean(jokerCard)).toBe(mode === 'JOKER');
        }
      }
    }
  });
  test.each([0, 1, 7, 17, 2.5])('rejects invalid table size %s', count => expect(() => dealCards(count)).toThrow());
  test('ranks the six hand categories in Teen Patti order', () => {
    const hands = [hand('14S','14H','14D'),hand('14S','13S','12S'),hand('14S','13D','12H'),hand('14H','11H','8H'),hand('13S','13H','14D'),hand('14S','11D','9H')];
    for (let i = 0; i < hands.length - 1; i++) expect(compareHands(hands[i], hands[i+1])).toBe(1);
  });
  test('AKQ beats A23, which beats KQJ; 234 is lowest sequence', () => {
    const hands = [hand('14S','13H','12D'),hand('14H','3D','2S'),hand('13S','12D','11H'),hand('4H','3S','2D')];
    for (let i = 0; i < hands.length - 1; i++) expect(compareHands(hands[i], hands[i+1])).toBe(1);
  });
  test('ties ignore suits and card order; pairs compare kickers', () => {
    expect(compareHands(hand('10S','10H','14C'),hand('14D','10D','10C'))).toBe(0);
    expect(compareHands(hand('9S','9H','14C'),hand('9C','9D','13H'))).toBe(1);
  });
  test('one, two and three jokers find their best legal substitutions', () => {
    expect(evaluateHand(hand('9S','14H','14D'), 9).score).toEqual([5,14]);
    expect(evaluateHand(hand('9S','9H','13D'), 9).score).toEqual([5,13]);
    expect(evaluateHand(hand('9S','9H','9D'), 9).score).toEqual([5,14]);
    expect(evaluateHand(hand('9S','12H','13H'), 9).score).toEqual([4,14]);
  });
  test('rejects duplicate and malformed hands', () => {
    expect(() => evaluateHand(hand('14S','14S','3H'))).toThrow();
    expect(() => evaluateHand(hand('1S','2S','3H'))).toThrow();
  });
  test('all 22,100 natural hands have the expected category frequencies', () => {
    const deck = createDeck(), counts = [0,0,0,0,0,0];
    for (let a = 0; a < 50; a++) for (let b = a+1; b < 51; b++) for (let c = b+1; c < 52; c++) counts[evaluateHand([deck[a],deck[b],deck[c]]).score[0]]++;
    expect(counts).toEqual([16440,3744,1096,720,48,52]);
  });
});
describe('Private round views', () => {
  const source = { status:'ACTIVE', players:[{userId:{_id:'a'},seenCards:true,cards:hand('14S','13H','12D')},{userId:{_id:'b'},seenCards:false,cards:hand('3S','5H','8D')}] };
  test('only the viewer’s opened hand is returned and the source is preserved', () => {
    const view = roundForViewer(source, 'a');
    expect(view.players[0].cards).toHaveLength(3);
    expect(view.players[1].cards).toBeUndefined();
    expect(view.players[1].handRank).toBeUndefined();
    expect(source.players[1].cards).toHaveLength(3);
    expect(roundForViewer(source,'b').players.every(p=>!p.cards)).toBe(true);
  });
  test('completion reveals only showdown hands, not packed hands', () => {
    const round = structuredClone(source);round.status='COMPLETED';round.players[0].revealed=true;
    expect(roundForViewer(round,'spectator').players[0].cards).toHaveLength(3);
    expect(roundForViewer(round,'spectator').players[1].cards).toBeUndefined();
  });
});
