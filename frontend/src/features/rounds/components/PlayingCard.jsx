import sheet from '../../../assets/cards/bicycle-sheet-enhanced.png';
import back from '../../../assets/cards/bicycle-back-enhanced.png';

const suits = { S: ['♠', 'spades'], H: ['♥', 'hearts'], D: ['♦', 'diamonds'], C: ['♣', 'clubs'] };
export const rankLabel = rank => ({ 0: 'Joker', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank);
// Windows into the restored Bicycle sheet. Shared images load once per table.
const rows = [
  ['J-0', 'J-grey', 'S-A', 'S-2', 'S-3', 'S-4', 'S-5', 'S-6'],
  ['S-7', 'S-8', 'S-9', 'S-10', 'S-J', 'S-Q', 'S-K', 'D-A'],
  ['D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-9'],
  ['D-10', 'D-J', 'D-Q', 'D-K', 'C-K', 'C-Q', 'C-J', 'C-10'],
  ['C-9', 'C-8', 'C-7', 'C-6', 'C-5', 'C-4', 'C-3', 'C-2'],
  ['C-A', 'H-K', 'H-Q', 'H-J', 'H-10', 'H-9', 'H-8', 'H-7'],
  ['H-6', 'H-5', 'H-4', 'H-3', 'H-2', 'H-A'],
];
// Logical coordinates match the original 1440×1800 sheet. The enhanced scan
// is mapped to that same canvas, independent of its bitmap resolution.
// Each boundary includes white space around both indices and all printed pips;
// the photographed sheet is slightly uneven, so cells aren't a fixed width.
const columnEdges = [40, 210, 380, 550, 720, 890, 1060, 1232, 1404];
const rowEdges = [96, 328, 560, 792, 1024, 1258, 1492, 1720];
const windows = Object.fromEntries(rows.flatMap((row, y) => row.map((code, x) => [code,
  // The restored indices sit a few pixels further left in some cells. Extend
  // only that white margin; keep the right edge clear of the neighboring card.
  [columnEdges[x] - 3, rowEdges[y], columnEdges[x + 1] - columnEdges[x] + 3, rowEdges[y + 1] - rowEdges[y]].join(' '),
])));

export default function PlayingCard({ card, jokerRank, small = false, index = 0 }) {
  const printedJoker = card?.suit === 'J';
  const wild = card && (printedJoker || card.rank === jokerRank);
  const code = card && `${card.suit}-${printedJoker ? 0 : rankLabel(card.rank)}`;
  const label = !card ? 'Face-down card' : printedJoker ? 'Printed joker, wild card' : `${rankLabel(card.rank)} of ${suits[card.suit][1]}${wild ? ', joker' : ''}`;
  return <div className={`playing-card ${small ? 'card-small' : ''} ${!card ? 'card-back' : ''} ${wild ? 'card-wild' : ''}`}
    style={{ '--card-index': index }} role="img" aria-label={label}>
    {card ? <svg className="card-art" viewBox={windows[code]} preserveAspectRatio="none" aria-hidden="true" focusable="false"><image href={sheet} width="1440" height="1800" preserveAspectRatio="none" /></svg>
      : <svg className="card-art" viewBox="0 0 240 336" preserveAspectRatio="none" aria-hidden="true" focusable="false"><image href={back} width="240" height="336" preserveAspectRatio="none" /></svg>}
    {wild && <span className="wild-label">WILD</span>}
  </div>;
}
export function CardHand({ cards, jokerRank, small = false }) {
  return <div className={`card-hand ${small ? 'hand-small' : ''}`}>{[0, 1, 2].map(i => <PlayingCard key={i} card={cards?.[i]} jokerRank={jokerRank} small={small} index={i} />)}</div>;
}

export function CardArtworkPreload() {
  return <><link rel="preload" as="image" href={sheet} /><link rel="preload" as="image" href={back} /></>;
}
