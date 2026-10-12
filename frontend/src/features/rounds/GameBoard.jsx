import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../../shared/hooks/useSocket';
import * as gamesApi from '../games/games.api';
import * as roundApi from './round.api';
import { Loader2, Crown, ArrowLeft, BookOpen, History, Wifi, WifiOff, Eye } from 'lucide-react';
import PlayerCircle from './components/PlayerCircle';
import PotArea from './components/PotArea';
import ActionPanel from './components/ActionPanel';
import Dealer from './components/Dealer';
import { CardHand, CardArtworkPreload } from './components/PlayingCard';
import TableDialog from './components/TableDialog';
import WinCelebration from './components/WinCelebration';
import { createTableSync } from './tableSync';
import { createRefreshScheduler } from '../../shared/hooks/refreshScheduler';
import './table.css';

const idOf = value => String(value?._id || value || '');
// Leave the top-center rail to the dealer; keep the viewer anchored at the bottom.
const seatPositions = {
  1: [[50, 86]],
  2: [[50, 86], [80, 20]],
  3: [[50, 86], [14, 44], [86, 44]],
  4: [[50, 86], [14, 60], [26, 12], [86, 50]],
  5: [[50, 86], [13, 60], [25, 12], [75, 12], [87, 60]],
  6: [[50, 86], [15, 72], [12, 30], [28, 4], [74, 4], [87, 66]],
};
export default function GameBoard() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [rules, setRules] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [dismissedComparison, setDismissedComparison] = useState('');
  const busy = useRef(false);
  const tableSync = useRef(null);
  const scheduler = useRef(null);
  const live = useRef(false);

  const fetchGameState = useCallback((roundOnly = false, change) => tableSync.current?.refresh(roundOnly === true, change), []);

  useEffect(() => {
    const sync = createTableSync({
      loadGame: () => gamesApi.getGameById(gameId),
      loadRound: () => gamesApi.getCurrentRound(gameId),
      onState: state => {
        if (state.game) setGame(state.game);
        setRound(state.round);
      },
      onError: err => setError(err ? err.response?.data?.message || 'The table could not be loaded. Check your connection and retry.' : ''),
      onLoaded: () => setLoading(false),
    });
    tableSync.current = sync;
    const polling = createRefreshScheduler({ refresh: fetchGameState, isConnected: () => live.current, onVisibility: sync.setVisible });
    scheduler.current = polling;
    busy.current = false; setProcessing(false);
    setLoading(true); setGame(null); setRound(null); fetchGameState();
    return () => { polling.dispose(); sync.dispose(); };
  }, [gameId, fetchGameState]);
  useEffect(() => {
    if (!socket) return;
    let active = true, attempt = 0;
    const connection = value => { live.current = value; setConnected(value); scheduler.current?.reschedule(); };
    const join = () => {
      const request = ++attempt;
      connection(false);
      socket.emit('joinGame', gameId, response => {
        if (!active || request !== attempt) return;
        connection(Boolean(response?.ok));
        if (!response?.ok) setError(response?.message || 'Could not join the table');
        else fetchGameState();
      });
    };
    const disconnect = () => { attempt++; connection(false); };
    const updateRound = payload => { if (!payload?.gameId || idOf(payload.gameId) === gameId) fetchGameState(true, payload); };
    const updateGame = payload => { if (!payload?.gameId || idOf(payload.gameId) === gameId) fetchGameState(); };
    socket.on('connect', join); socket.on('disconnect', disconnect); socket.on('connect_error', disconnect);
    for (const event of ['round:update', 'round:completed']) socket.on(event, updateRound);
    socket.on('game:update', updateGame);
    if (socket.connected) join();
    return () => {
      active = false; live.current = false;
      socket.emit('leaveGame', gameId);
      socket.off('connect', join); socket.off('disconnect', disconnect); socket.off('connect_error', disconnect);
      for (const event of ['round:update', 'round:completed']) socket.off(event, updateRound);
      socket.off('game:update', updateGame);
    };
  }, [socket, gameId, fetchGameState]);

  const perform = async operation => {
    if (busy.current) return;
    busy.current = true; setProcessing(true); setError('');
    const sync = tableSync.current;
    sync.pause();
    try { sync.resume(await operation()); }
    catch (err) {
      sync.resume(undefined, false);
      if (sync === tableSync.current) setError(err.response?.data?.message || 'The action could not be completed. Please try again.');
    }
    finally { if (sync === tableSync.current) { busy.current = false; setProcessing(false); } }
  };
  const handleAction = action => {
    const actions = { BET: roundApi.bet, BET_TWICE: roundApi.betTwice, PACK: roundApi.pack, SHOW_REQUEST: roundApi.requestShow, SIDE_SHOW_REQUEST: roundApi.requestSideShow, SEE: roundApi.seeCards };
    if (round && actions[action]) perform(() => actions[action](round._id));
  };
  const myId = idOf(user);
  const host = idOf(game?.createdBy) === myId;
  const me = round?.players.find(p => idOf(p.userId) === myId);
  const active = round?.players.filter(p => p.status === 'ACTIVE') || [];
  const current = round?.players[round.currentTurnIndex];
  const myTurn = round?.status === 'ACTIVE' && idOf(current?.userId) === myId;
  const seats = round?.players || (game?.turnOrder?.length ? game.turnOrder.map(userId => ({ userId, status: 'ACTIVE' })) : game?.participants?.map(p => ({ userId: p.userId, status: 'ACTIVE' })) || []);
  const ownIndex = seats.findIndex(p => idOf(p.userId) === myId);
  const orderedSeats = ownIndex >= 0 ? [...seats.slice(ownIndex), ...seats.slice(0, ownIndex)] : seats;
  let previous = null;
  if (round) {
    for (let offset = 1; offset < round.players.length; offset++) {
      const p = round.players[(round.currentTurnIndex - offset + round.players.length) % round.players.length];
      if (p.status === 'ACTIVE') { previous = p; break; }
    }
  }
  const legacy = round?.status === 'SHOW_PENDING' || (round?.status === 'SIDE_SHOW_PENDING' && round.sideShowRequest?.result === 'ACCEPTED');
  const request = round?.sideShowRequest;
  const target = idOf(request?.targetPlayer) === myId;
  const requester = round?.players.find(p => idOf(p.userId) === idOf(request?.requestedBy));
  const complete = round?.status === 'COMPLETED';
  const sideShowHands = round?.players.filter(p => idOf(p.userId) !== myId && p.cards?.length === 3 && !p.revealed) || [];
  const comparisonKey = sideShowHands.length ? `${round._id}:${sideShowHands.map(p => idOf(p.userId)).sort().join(':')}` : '';
  const comparisonOpen = comparisonKey && dismissedComparison !== comparisonKey;
  const wallet = round?.availableBalance;
  const winners = round?.players.filter(p => p.status === 'WINNER') || [];
  const splitPot = winners.length > 1;
  const potLimit = round ? round.potLimit : game?.bootAmount * 100;

  if (loading) return <main className="table-screen table-loading"><Loader2 className="animate-spin" /><p>Taking your seat…</p></main>;
  if (!game) return <main className="table-screen table-loading"><h1>Table unavailable</h1><p role="alert">{error}</p><button className="table-button button-gold" onClick={fetchGameState}>Retry</button><Link to="/">Back to games</Link></main>;
  if (game.status === 'ENDED') return <main className="table-screen table-loading"><Crown size={48} /><h1>{game.name}</h1><p>Game finished. All round balances have been settled.</p><Link className="table-button button-gold" to={`/games/${gameId}/history`}>View final scores</Link><Link to="/">Back to games</Link></main>;
  if (game.status !== 'ACTIVE') return <main className="table-screen table-loading"><h1>The table is being prepared</h1><p>Invite your players and set the turn order before dealing.</p><Link className="table-button button-gold" to={`/games/${gameId}/${game.status === 'TURN_ORDER_SETUP' ? 'turn-order' : 'lobby'}`}>Continue setup</Link></main>;

  return <main className="table-screen">
    <CardArtworkPreload />
    <header className="table-header">
      <Link className="table-back" to="/" aria-label="Leave table"><ArrowLeft size={20} /></Link>
      <div className="table-summary">
        <h1 className="table-game-name" title={game.name}>{game.name}</h1>
        <div className="table-values" aria-label="Table values">
          <span className="table-value-chip">{game.mode === 'JOKER' ? 'Joker' : 'Classic'}</span>
          <span className="table-value-chip"><span>Round</span><strong>{round?.roundNumber || 0}</strong></span>
          <span className="table-value-chip"><span>Boot</span><strong>₹{game.bootAmount.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>
      <div className="table-toolbar"><span className={`connection-status ${connected ? 'is-connected' : ''}`} title={connected ? 'Connected to the live table' : 'Reconnecting; the table refreshes automatically'}>{connected ? <Wifi size={16} /> : <WifiOff size={16} />}<span>{connected ? 'Live' : 'Reconnecting'}</span></span><button className="table-icon-button" onClick={() => setRules(!rules)} aria-expanded={rules} aria-label="Table rules"><BookOpen size={20} /></button><Link className="table-icon-button" to={`/games/${gameId}/history`} aria-label="Game history"><History size={20} /></Link></div>
    </header>
    {error && <div className="table-error table-error-banner" role="alert">{error}<button onClick={fetchGameState}>Retry</button></div>}
    {rules && <TableDialog title="Table rules" onClose={() => setRules(false)}><section className="table-rules"><p>Three cards each. Trail beats pure sequence, sequence, colour, pair, then high card. Sequences rank AKQ, A23, KQJ, down to 234. Suits have equal value.</p><p>Blind pays the stake; seen pays twice the stake. A raise doubles the blind stake, up to ₹{game.bootAmount * game.maxBetMultiplier}. With two players left, either player can force a show on their turn, even against a blind opponent. Show costs twice the current chaal (four times the blind stake), capped at the pot limit. No acceptance is needed. The requester loses a tie.</p><p>The pot limit is 100× boot (₹{(game.bootAmount * 100).toLocaleString('en-IN')}). The last payment is capped to the remaining amount. At the limit, all active hands are revealed and compared, with no extra fee. Equal best hands split the pot; spare rupees go in table seat order.</p><p>Side show compares with the previous active player. Both must be seen, with at least three players left. Accepting lets the two participants see each other's cards for the rest of the round. The lower hand packs; the requester packs on a tie. These cards stay private from other players.</p>{game.mode === 'JOKER' && <p>Everyone receives two normal cards plus one printed joker. The joker substitutes for the card that makes your best three-card hand. Older rounds with a rank indicator finish under their original rules.</p>}<button className="table-button" onClick={() => setRules(false)}>Close rules</button></section></TableDialog>}
    {complete && <WinCelebration key={round._id} />}
    <section className="table-stage" aria-label="Teen Patti table">
      <Dealer />
      <div className="table-arena" data-seats={orderedSeats.length}>
      <div className="table-felt">{!complete && <span className="felt-brand" aria-hidden="true">TEEN PATTI<span>COMPANION</span></span>}</div>
      <div className="table-center">
      {complete && <div className="table-result-banner" role="status"><Crown size={32} /><h2>{splitPot ? 'Split pot' : `${round.winnerId?.name || round.winnerId?.username || 'Player'} wins`}{winners[0]?.handRank && !splitPot ? ` with ${winners[0].handRank}` : ''}</h2><strong>₹{round.potAmount.toLocaleString('en-IN')} {splitPot ? 'shared' : 'won'}</strong></div>}
      <div className="table-pot-content"><PotArea potAmount={round?.potAmount} currentBet={round?.currentBet || game.bootAmount} potLimit={potLimit} />
        {game.mode === 'JOKER' && <span className="joker-rule-note">{round?.jokerCard ? 'Legacy rank joker' : 'One joker in every hand'}</span>}
      </div>
      </div>
      {orderedSeats.map((player, index) => {
        const [x, y] = seatPositions[orderedSeats.length][index];
        return <div className={`seat-position ${y <= 20 ? 'seat-upper' : ''}`} key={idOf(player.userId)} data-seat={index} style={{ '--seat-x': `${x}%`, '--seat-y': `${y}%` }}><PlayerCircle player={player} isMe={idOf(player.userId) === myId} bootAmount={round?.startingBet || game.bootAmount} isCurrentTurn={round?.status === 'ACTIVE' && idOf(player.userId) === idOf(current?.userId)} jokerRank={round?.jokerCard?.rank} /></div>;
      })}
      {round && me && <div className="my-hand-area"><div className="hand-caption"><span>Your hand</span><strong>{me?.status === 'PACKED' ? 'Packed' : me?.handRank || 'Blind'}</strong>{wallet !== undefined && <small>Available · ₹{wallet.toLocaleString('en-IN')}</small>}</div><CardHand cards={me?.cards} jokerRank={round.jokerCard?.rank} />{me?.status === 'ACTIVE' && !me.seenCards && !complete && <button className="table-button see-cards" disabled={processing || round.status !== 'ACTIVE'} onClick={() => handleAction('SEE')}><Eye size={18} /> See cards</button>}</div>}
      </div>
    </section>
    <section className="table-play-area">
      {!round && <div className="round-message"><h2>Ready to deal</h2><p>{seats.length} players seated. Everyone starts blind.</p>{host ? <button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.startRound(gameId))}>{processing ? 'Dealing…' : 'Deal first round'}</button> : <p>Waiting for the host to deal.</p>}</div>}
      {round?.status === 'SIDE_SHOW_PENDING' && !legacy && <div className="round-message"><h2>Side show requested</h2><p>{target ? `${requester?.userId?.name || 'A player'} wants to compare hands with you. Accepting lets you both see each other's cards.` : 'Waiting for the previous player to accept or decline.'}</p>{target && <div className="response-controls"><button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.respondSideShow(round._id, true))}>Accept & compare</button><button className="table-button" disabled={processing} onClick={() => perform(() => roundApi.respondSideShow(round._id, false))}>Decline</button></div>}</div>}
      {legacy && <div className="round-message"><h2>Physical-card round</h2><p>This round started before digital dealing. Compare your physical cards to finish it.</p>{round.status === 'SHOW_PENDING' && host && active.map(p => <button className="table-button" key={idOf(p.userId)} disabled={processing} onClick={() => perform(() => roundApi.submitShowResult(round._id, idOf(p.userId)))}>{p.userId.name} wins</button>)}{round.status === 'SIDE_SHOW_PENDING' && [idOf(request.requestedBy), idOf(request.targetPlayer)].includes(myId) && round.players.filter(p => [idOf(request.requestedBy), idOf(request.targetPlayer)].includes(idOf(p.userId))).map(p => <button className="table-button" key={idOf(p.userId)} disabled={processing} onClick={() => perform(() => roundApi.submitSideShowResult(round._id, idOf(p.userId)))}>{p.userId.name} packs</button>)}</div>}

      {complete && <div className="round-message round-result"><p>{splitPot ? winners.map(p => `${p.userId.name || p.userId.username}: ₹${p.winAmount.toLocaleString('en-IN')}`).join(' · ') : round.completionReason === 'POT_LIMIT' ? 'Pot limit reached · Hands compared' : round.completionReason === 'SHOW' ? 'Show complete · Hands compared' : 'Everyone else packed'}</p>{host ? <button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.startRound(gameId))}>{processing ? 'Dealing…' : 'Deal next round'}</button> : <p>Waiting for the host to deal.</p>}</div>}
      {round?.status === 'ACTIVE' && me?.status === 'ACTIVE' && <ActionPanel isMyTurn={myTurn} isProcessing={processing} currentBet={round.currentBet} maxBetLimit={round.startingBet * game.maxBetMultiplier} potRemaining={potLimit ? Math.max(0, potLimit - round.potAmount) : undefined} activePlayersCount={active.length} onAction={handleAction} currentPlayerName={current?.userId?.name} seenCards={me.seenCards} canSideShow={me.seenCards && previous?.seenCards} balance={wallet} />}
      {round?.status === 'ACTIVE' && me?.status === 'PACKED' && <p className="spectator-message">You packed. Watch this round and join the next deal.</p>}
      {round?.sideShowRequest?.result === 'DECLINED' && round.status === 'ACTIVE' && <p className="spectator-message" role="status">Side show declined. Play continues.</p>}
    </section>
    <footer className="table-footer"><span>{seats.length}/6 seats · {game.mode === 'JOKER' ? 'One joker each' : 'Classic rules'}</span>{sideShowHands.length > 0 && <button className="table-icon-button" title="View side-show hands" aria-label="View side-show hands" onClick={() => setDismissedComparison('')}><Eye size={18} /></button>}{host && <button className="end-game-button" disabled={processing || (round && !complete)} onClick={() => setConfirmEnd(true)}>End game</button>}</footer>
    {confirmEnd && <TableDialog title="Finish this game?" onClose={() => setConfirmEnd(false)}><section className="end-confirm"><p>All scores will be settled and saved in game history.</p><div className="response-controls"><button className="table-button button-gold" disabled={processing} onClick={() => perform(async () => { await gamesApi.endGame(gameId); setConfirmEnd(false); navigate(`/games/${gameId}/history`); })}>Finish & settle</button><button className="table-button" disabled={processing} onClick={() => setConfirmEnd(false)}>Keep playing</button></div></section></TableDialog>}
    {comparisonOpen && sideShowHands.length > 0 && <TableDialog title="Side-show comparison" onClose={() => setDismissedComparison(comparisonKey)}><p className="comparison-note">Shared only with the two players in each accepted comparison.</p><div className="comparison-hands">{[me, ...sideShowHands].filter(Boolean).map(player => <div className="comparison-hand" key={idOf(player.userId)}><h3>{idOf(player.userId) === myId ? 'Your hand' : `${player.userId?.name || player.userId?.username || 'Player'}'s hand · Side show`}</h3><CardHand cards={player.cards} jokerRank={round?.jokerCard?.rank} /><strong>{player.handRank}</strong><span>{player.status === 'PACKED' ? 'Packed' : 'Still in the round'}</span></div>)}</div><button className="table-button button-gold" onClick={() => setDismissedComparison(comparisonKey)}>Back to table</button></TableDialog>}
  </main>;
}
