import { Loader2 } from 'lucide-react';
export default function ActionPanel({ isMyTurn, isProcessing, currentBet, maxBetLimit, potRemaining = Infinity, activePlayersCount, onAction, currentPlayerName, seenCards, canSideShow, balance }) {
  const stake = currentBet * (seenCards ? 2 : 1);
  const amount = Math.min(stake, potRemaining);
  const raiseAmount = Math.min(stake * 2, potRemaining);
  const showAmount = Math.min(currentBet * 4, potRemaining);
  const canAfford = value => balance === undefined || balance >= value;
  return <div className="action-panel">
    <p className="turn-message" role="status">{isProcessing ? <><Loader2 size={16} className="animate-spin" /> Updating the table…</> : isMyTurn ? `Your turn · ${seenCards ? 'Play chaal' : 'Play blind'}` : `Waiting for ${currentPlayerName || 'the next player'}`}</p>
    <div className="bet-controls">
      <button className="table-button button-pack" disabled={!isMyTurn || isProcessing} onClick={() => onAction('PACK')}>Pack</button>
      <button className="table-button button-gold" disabled={!isMyTurn || isProcessing || !canAfford(amount)} onClick={() => onAction('BET')}>{seenCards ? 'Chaal' : 'Blind'}<strong>₹{amount.toLocaleString('en-IN')}</strong></button>
      <button className="table-button" disabled={!isMyTurn || isProcessing || currentBet * 2 > maxBetLimit || !canAfford(raiseAmount)} onClick={() => onAction('BET_TWICE')}>Raise 2×<strong>₹{raiseAmount.toLocaleString('en-IN')}</strong></button>
      {activePlayersCount === 2 ? <button className="table-button" title={showAmount >= potRemaining ? 'Pot limit: compare all active hands; equal best hands split the pot' : 'Costs twice the current chaal. Compare both hands immediately; the requester loses on a tie'} disabled={!isMyTurn || isProcessing || !canAfford(showAmount)} onClick={() => onAction('SHOW_REQUEST')}>Show<strong>₹{showAmount.toLocaleString('en-IN')}</strong></button>
        : <button className="table-button" title={!canSideShow ? 'You and the previous active player must both be seen' : amount >= potRemaining ? 'Pot limit: compare all active hands immediately' : 'Request a comparison with the previous active player'} disabled={!isMyTurn || isProcessing || !canSideShow || !canAfford(amount)} onClick={() => onAction('SIDE_SHOW_REQUEST')}>Side show<strong>₹{amount.toLocaleString('en-IN')}</strong></button>}
    </div>
    {isMyTurn && stake * 2 >= potRemaining && <p className="spectator-message">At the pot limit, active hands are shown automatically. Payments stop at the remaining ₹{potRemaining.toLocaleString('en-IN')}.</p>}
    {isMyTurn && !canAfford(amount) && <p className="table-error">Your balance is below the stake. Pack to finish your turn.</p>}
  </div>;
}
