import { Crown } from 'lucide-react';
import { CardHand } from './PlayingCard';

export default function PlayerCircle({ player, isCurrentTurn, isMe, jokerRank }) {
  const name = player.userId?.name || player.userId?.username || 'Player';
  return <div className={`player-seat ${isMe ? 'seat-me' : ''} ${player.cards?.length === 3 ? 'seat-revealed' : ''} ${isCurrentTurn ? 'seat-current' : ''} ${player.status === 'PACKED' ? 'seat-packed' : ''}`}>
    {!isMe && <CardHand cards={player.cards} jokerRank={jokerRank} small />}
    <div className="seat-avatar" aria-hidden="true">{player.userId?.profilePicture ? <img src={player.userId.profilePicture} alt="" /> : name.charAt(0).toUpperCase()}{player.status === 'WINNER' && <Crown size={18} />}</div>
    <strong className="seat-name" title={name}>{isMe ? `${name} · You` : name}</strong>
    <span className="seat-status">{player.status === 'PACKED' ? 'Packed' : player.status === 'WINNER' ? 'Winner' : isCurrentTurn ? (isMe ? 'Your turn' : 'Playing') : player.lastBet === 'CHAAL' ? 'Chaal' : player.seenCards ? 'Seen' : 'Blind'}</span>
    <span className="seat-contribution">In pot · ₹{(player.totalContribution || 0).toLocaleString('en-IN')}</span>
  </div>;
}
