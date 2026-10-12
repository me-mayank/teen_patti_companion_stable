const { randomInt } = require('node:crypto');

const SUITS = ['S', 'H', 'D', 'C'];
const LABELS = ['High card', 'Pair', 'Colour', 'Sequence', 'Pure sequence', 'Trail'];
const createDeck = () => SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit })));
const cardKey = card => `${card.rank}${card.suit}`;

function dealCards(playerCount, mode = 'CLASSIC') {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) throw new Error('A table needs 2 to 6 players');
  if (!['CLASSIC', 'JOKER'].includes(mode)) throw new Error('Unknown game mode');
  const deck = createDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({ length: playerCount }, () => []);
  for (let pass = 0; pass < (mode === 'JOKER' ? 2 : 3); pass++) {
    for (const hand of hands) hand.push(deck.pop());
  }
  // Each seat receives its own printed joker, rather than a random wild rank.
  if (mode === 'JOKER') for (const hand of hands) hand.push({ rank: 0, suit: 'J' });
  return { hands, jokerCard: null };
}

function scoreNatural(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const [a, b, c] = ranks;
  const flush = cards.every(card => card.suit === cards[0].suit);
  // House rule: AKQ > A23 > KQJ > ... > 234.
  const sequence = a === 14 && b === 3 && c === 2 ? 13
    : a - b === 1 && b - c === 1 ? (a === 14 ? 14 : a - 1) : 0;
  if (a === c) return [5, a];
  if (flush && sequence) return [4, sequence];
  if (sequence) return [3, sequence];
  if (flush) return [2, ...ranks];
  if (a === b) return [1, a, c];
  if (b === c) return [1, b, a];
  return [0, ...ranks];
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function evaluateHand(cards, jokerRank = null) {
  if (!Array.isArray(cards) || cards.length !== 3 || cards.some(c => !c || !(c.rank === 0 && c.suit === 'J') && (!Number.isInteger(c.rank) || c.rank < 2 || c.rank > 14 || !SUITS.includes(c.suit))) || new Set(cards.map(cardKey)).size !== 3) {
    throw new Error('A hand must contain three distinct valid cards');
  }
  // jokerRank remains supported for rounds already dealt under the older rules.
  const natural = cards.filter(c => c.suit !== 'J' && c.rank !== jokerRank);
  const wildCount = 3 - natural.length;
  let best = null;
  if (!wildCount) best = scoreNatural(cards);
  else if (wildCount === 3) best = [5, 14];
  else {
    const used = new Set(natural.map(cardKey));
    const options = createDeck().filter(c => !used.has(cardKey(c)));
    const search = (chosen, start) => {
      if (chosen.length === wildCount) {
        const score = scoreNatural([...natural, ...chosen]);
        if (!best || compareScores(score, best) > 0) best = score;
        return;
      }
      for (let i = start; i < options.length; i++) search([...chosen, options[i]], i + 1);
    };
    search([], 0);
  }
  return { score: best, label: LABELS[best[0]], jokerCount: wildCount };
}

const compareHands = (a, b, jokerRank = null) => compareScores(evaluateHand(a, jokerRank).score, evaluateHand(b, jokerRank).score);
module.exports = { createDeck, dealCards, evaluateHand, compareHands };
