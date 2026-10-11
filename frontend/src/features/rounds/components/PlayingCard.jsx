const suits = { S: ['♠', 'spades'], H: ['♥', 'hearts'], D: ['♦', 'diamonds'], C: ['♣', 'clubs'] };
export const rankLabel = rank => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank);

export default function PlayingCard({ card, jokerRank, small = false, index = 0 }) {
  const wild = card && card.rank === jokerRank;
  const suit = card && suits[card.suit];
  return <div className={`playing-card ${small ? 'card-small' : ''} ${!card ? 'card-back' : ''} ${wild ? 'card-wild' : ''} ${card && ['H', 'D'].includes(card.suit) ? 'card-red' : ''}`}
    style={{ '--card-index': index }} role="img" aria-label={card ? `${rankLabel(card.rank)} of ${suit[1]}${wild ? ', joker' : ''}` : 'Face-down card'}>
    {card ? <><span className="card-corner">{rankLabel(card.rank)}<span>{suit[0]}</span></span><span className="card-suit" aria-hidden="true">{suit[0]}</span><span className="card-bottom" aria-hidden="true">{rankLabel(card.rank)}</span>{wild && <span className="wild-label">WILD</span>}</>
      : <span className="card-back-mark" aria-hidden="true">TP</span>}
  </div>;
}
export function CardHand({ cards, jokerRank, small = false }) {
  return <div className={`card-hand ${small ? 'hand-small' : ''}`}>{[0, 1, 2].map(i => <PlayingCard key={i} card={cards?.[i]} jokerRank={jokerRank} small={small} index={i} />)}</div>;
}
