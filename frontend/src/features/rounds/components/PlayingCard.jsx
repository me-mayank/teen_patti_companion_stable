import { useId } from 'react';
import artwork from '../../../assets/card-artwork.json';

const suits = { S: ['♠', 'spades'], H: ['♥', 'hearts'], D: ['♦', 'diamonds'], C: ['♣', 'clubs'] };
export const rankLabel = rank => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank);

export default function PlayingCard({ card, jokerRank, small = false, index = 0 }) {
  const instance = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const wild = card && card.rank === jokerRank;
  const suit = card && suits[card.suit];
  const code = card ? `${card.suit}-${rankLabel(card.rank)}` : 'B-1';
  // Scope every fragment to this SVG, including simultaneous copies of a hand.
  // Artwork ships with the component, so revealing a card needs no asset request.
  const markup = artwork[code].replace(/id="([^"]+)"/g, `id="${instance}-$1"`)
    .replace(/(href="#|url\(#)([^")]+)/g, `$1${instance}-$2`);
  return <div className={`playing-card ${small ? 'card-small' : ''} ${!card ? 'card-back' : ''} ${wild ? 'card-wild' : ''} ${card && ['H', 'D'].includes(card.suit) ? 'card-red' : ''}`}
    style={{ '--card-index': index }} role="img" aria-label={card ? `${rankLabel(card.rank)} of ${suit[1]}${wild ? ', joker' : ''}` : 'Face-down card'}>
    <svg className="card-art" viewBox="-120 -168 240 336" xmlnsXlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: markup }} />
    {wild && <span className="wild-label">WILD</span>}
  </div>;
}
export function CardHand({ cards, jokerRank, small = false }) {
  return <div className={`card-hand ${small ? 'hand-small' : ''}`}>{[0, 1, 2].map(i => <PlayingCard key={i} card={cards?.[i]} jokerRank={jokerRank} small={small} index={i} />)}</div>;
}
