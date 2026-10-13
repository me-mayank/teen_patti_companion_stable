import { useId } from 'react';
import sheet from '../../../assets/cards/bicycle-sheet.png';
import back from '../../../assets/cards/bicycle-back-reference.png';

const suits = { S: ['♠', 'spades'], H: ['♥', 'hearts'], D: ['♦', 'diamonds'], C: ['♣', 'clubs'] };
export const rankLabel = rank => ({ 0: 'Joker', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank);
// Windows into the exact supplied Bicycle sheet. Shared images load once per table.
const rows = [
  ['J-0', 'J-grey', 'S-A', 'S-2', 'S-3', 'S-4', 'S-5', 'S-6'],
  ['S-7', 'S-8', 'S-9', 'S-10', 'S-J', 'S-Q', 'S-K', 'D-A'],
  ['D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-9'],
  ['D-10', 'D-J', 'D-Q', 'D-K', 'C-K', 'C-Q', 'C-J', 'C-10'],
  ['C-9', 'C-8', 'C-7', 'C-6', 'C-5', 'C-4', 'C-3', 'C-2'],
  ['C-A', 'H-K', 'H-Q', 'H-J', 'H-10', 'H-9', 'H-8', 'H-7'],
  ['H-6', 'H-5', 'H-4', 'H-3', 'H-2', 'H-A'],
];
// Calibrated against the original 1440×1800 PNG, not its resized chat preview.
// Each boundary includes white space around both indices and all printed pips;
// the photographed sheet is slightly uneven, so cells aren't a fixed width.
const columnEdges = [40, 210, 380, 550, 720, 890, 1060, 1232, 1404];
const rowEdges = [96, 328, 560, 792, 1024, 1258, 1492, 1720];
const windows = Object.fromEntries(rows.flatMap((row, y) => row.map((code, x) => [code,
  [columnEdges[x], rowEdges[y], columnEdges[x + 1] - columnEdges[x], rowEdges[y + 1] - rowEdges[y]].join(' '),
])));

export default function PlayingCard({ card, jokerRank, small = false, index = 0 }) {
  const instance = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const printedJoker = card?.suit === 'J';
  const wild = card && (printedJoker || card.rank === jokerRank);
  const code = card && `${card.suit}-${printedJoker ? 0 : rankLabel(card.rank)}`;
  const label = !card ? 'Face-down card' : printedJoker ? 'Printed joker, wild card' : `${rankLabel(card.rank)} of ${suits[card.suit][1]}${wild ? ', joker' : ''}`;
  return <div className={`playing-card ${small ? 'card-small' : ''} ${!card ? 'card-back' : ''} ${wild ? 'card-wild' : ''}`}
    style={{ '--card-index': index }} role="img" aria-label={label}>
    {card ? <svg className="card-art" viewBox={windows[code]} preserveAspectRatio="none" aria-hidden="true" focusable="false"><image href={sheet} width="1440" height="1800" /></svg>
      : <svg className="card-art" viewBox="-10 -10 260 356" aria-hidden="true" focusable="false">
        <defs><clipPath id={`${instance}-back-half`}><rect x="120" y="0" width="120" height="336" /></clipPath></defs>
        <rect x="-10" y="-10" width="260" height="356" rx="10" fill="#fff" />
        {[false, true].map(mirror => <g key={String(mirror)} transform={mirror ? 'translate(240 0) scale(-1 1)' : undefined} clipPath={`url(#${instance}-back-half)`}><image href={back} width="860" height="573" transform="matrix(.749 -.129 .109 .728 -385.7 35.79)" /></g>)}
      </svg>}
    {wild && <span className="wild-label">WILD</span>}
  </div>;
}
export function CardHand({ cards, jokerRank, small = false }) {
  return <div className={`card-hand ${small ? 'hand-small' : ''}`}>{[0, 1, 2].map(i => <PlayingCard key={i} card={cards?.[i]} jokerRank={jokerRank} small={small} index={i} />)}</div>;
}

export function CardArtworkPreload() {
  return <><link rel="preload" as="image" href={sheet} /><link rel="preload" as="image" href={back} /></>;
}
