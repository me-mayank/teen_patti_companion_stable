import { Crown } from 'lucide-react';
import { CardHand } from './PlayingCard';

export default function PlayerCircle({ player, isCurrentTurn, isMe, jokerRank, bootAmount }) {
  const name = player.userId?.name || player.userId?.username || 'Player';
  const action = player.lastAction || (player.lastBet === 'CHAAL' ? 'CHAAL' : player.seenCards ? 'SEEN' : 'BLIND');
  const actionLabel = { BLIND: 'Blind', SEEN: 'Seen', CHAAL: 'Chaal' }[action];
  return <div className={`player-seat ${isMe ? 'seat-me' : ''} ${player.cards?.length === 3 ? 'seat-revealed' : ''} ${isCurrentTurn ? 'seat-current' : ''} ${player.status === 'PACKED' ? 'seat-packed' : ''}`}>
    {!isMe && <CardHand cards={player.cards} jokerRank={jokerRank} small />}
    <div className="seat-avatar" aria-hidden="true">{player.userId?.profilePicture ? <img src={player.userId.profilePicture} alt="" /> : name.charAt(0).toUpperCase()}{player.status === 'WINNER' && <Crown size={18} />}</div>
    <strong className="seat-name" title={name}>{isMe ? `${name} · You` : name}</strong>
    <span className="seat-status">{player.status === 'PACKED' ? 'Packed' : player.status === 'WINNER' ? 'Winner' : actionLabel}</span>
    {isCurrentTurn && <span className="seat-turn">{isMe ? 'Your turn' : 'Turn'}</span>}
    <span className="seat-contribution" title={`In pot · ₹${(player.totalContribution || 0).toLocaleString('en-IN')}`}>{player.lastBetAmount !== undefined ? `${player.lastBet === 'CHAAL' ? 'Chaal' : 'Blind'} · ₹${player.lastBetAmount.toLocaleString('en-IN')}` : `Boot · ₹${(bootAmount || 0).toLocaleString('en-IN')}`}</span>
  </div>;
}
