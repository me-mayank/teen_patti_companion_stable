import { Loader2 } from 'lucide-react';
export default function ActionPanel({ isMyTurn, isProcessing, currentBet, maxBetLimit, activePlayersCount, onAction, currentPlayerName, seenCards, canSideShow, canShow, balance }) {
  const amount = currentBet * (seenCards ? 2 : 1);
  const canAfford = value => balance === undefined || balance >= value;
  return <div className="action-panel">
    <p className="turn-message" role="status">{isProcessing ? <><Loader2 size={16} className="animate-spin" /> Updating the table…</> : isMyTurn ? `Your turn · ${seenCards ? 'Play chaal' : 'Play blind'}` : `Waiting for ${currentPlayerName || 'the next player'}`}</p>
    <div className="bet-controls">
      <button className="table-button button-pack" disabled={!isMyTurn || isProcessing} onClick={() => onAction('PACK')}>Pack</button>
      <button className="table-button button-gold" disabled={!isMyTurn || isProcessing || !canAfford(amount)} onClick={() => onAction('BET')}>{seenCards ? 'Chaal' : 'Blind'}<strong>₹{amount.toLocaleString('en-IN')}</strong></button>
      <button className="table-button" disabled={!isMyTurn || isProcessing || currentBet * 2 > maxBetLimit || !canAfford(amount * 2)} onClick={() => onAction('BET_TWICE')}>Raise 2×<strong>₹{(amount * 2).toLocaleString('en-IN')}</strong></button>
      {activePlayersCount === 2 ? <button className="table-button" title={!canShow ? 'A seen player cannot show against a blind player' : 'Compare both hands; the requester loses on a tie'} disabled={!isMyTurn || isProcessing || !canShow || !canAfford(amount)} onClick={() => onAction('SHOW_REQUEST')}>Show<strong>₹{amount.toLocaleString('en-IN')}</strong></button>
        : <button className="table-button" title={!canSideShow ? 'You and the previous active player must both be seen' : 'Request a comparison with the previous active player'} disabled={!isMyTurn || isProcessing || !canSideShow || !canAfford(amount)} onClick={() => onAction('SIDE_SHOW_REQUEST')}>Side show<strong>₹{amount.toLocaleString('en-IN')}</strong></button>}
    </div>
    {isMyTurn && !canAfford(amount) && <p className="table-error">Your balance is below the stake. Pack to finish your turn.</p>}
  </div>;
}
