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
import PlayingCard, { CardHand, rankLabel } from './components/PlayingCard';
import './table.css';

const idOf = value => String(value?._id || value || '');
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
  const busy = useRef(false);
  const requestId = useRef(0);

  const fetchGameState = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const g = await gamesApi.getGameById(gameId);
      const r = g.status === 'ACTIVE' || g.status === 'ENDED' ? await gamesApi.getCurrentRound(gameId) : null;
      if (request !== requestId.current) return;
      setGame(g); setRound(r); setError('');
    } catch (err) {
      if (request === requestId.current) setError(err.response?.data?.message || 'The table could not be loaded. Check your connection and retry.');
    } finally { if (request === requestId.current) setLoading(false); }
  }, [gameId]);

  useEffect(() => {
    setLoading(true); fetchGameState();
    const timer = setInterval(fetchGameState, 10000);
    return () => { clearInterval(timer); requestId.current++; };
  }, [fetchGameState]);
  useEffect(() => {
    if (!socket) return;
    const join = () => {
      setConnected(true);
      socket.emit('joinGame', gameId, response => { if (!response?.ok) { setConnected(false); setError(response?.message || 'Could not join the table'); } else fetchGameState(); });
    };
    const disconnect = () => setConnected(false);
    const update = payload => { if (!payload?.gameId || idOf(payload.gameId) === gameId) fetchGameState(); };
    socket.on('connect', join); socket.on('disconnect', disconnect); socket.on('connect_error', disconnect);
    for (const event of ['round:update', 'game:update', 'round:completed']) socket.on(event, update);
    if (socket.connected) join();
    return () => {
      socket.emit('leaveGame', gameId);
      socket.off('connect', join); socket.off('disconnect', disconnect); socket.off('connect_error', disconnect);
      for (const event of ['round:update', 'game:update', 'round:completed']) socket.off(event, update);
    };
  }, [socket, gameId, fetchGameState]);

  const perform = async operation => {
    if (busy.current) return;
    busy.current = true; setProcessing(true); setError('');
    try { await operation(); await fetchGameState(); }
    catch (err) { setError(err.response?.data?.message || 'The action could not be completed. Please try again.'); }
    finally { busy.current = false; setProcessing(false); }
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
  const other = active.find(p => idOf(p.userId) !== myId);
  const legacy = round?.status === 'SHOW_PENDING' || (round?.status === 'SIDE_SHOW_PENDING' && round.sideShowRequest?.result === 'ACCEPTED');
  const request = round?.sideShowRequest;
  const target = idOf(request?.targetPlayer) === myId;
  const requester = round?.players.find(p => idOf(p.userId) === idOf(request?.requestedBy));
  const complete = round?.status === 'COMPLETED';
  const wallet = round?.availableBalance;

  if (loading) return <main className="table-screen table-loading"><Loader2 className="animate-spin" /><p>Taking your seat…</p></main>;
  if (!game) return <main className="table-screen table-loading"><h1>Table unavailable</h1><p role="alert">{error}</p><button className="table-button button-gold" onClick={fetchGameState}>Retry</button><Link to="/">Back to games</Link></main>;
  if (game.status === 'ENDED') return <main className="table-screen table-loading"><Crown size={48} /><h1>{game.name}</h1><p>Game finished. All round balances have been settled.</p><Link className="table-button button-gold" to={`/games/${gameId}/history`}>View final scores</Link><Link to="/">Back to games</Link></main>;
  if (game.status !== 'ACTIVE') return <main className="table-screen table-loading"><h1>The table is being prepared</h1><p>Invite your players and set the turn order before dealing.</p><Link className="table-button button-gold" to={`/games/${gameId}/${game.status === 'TURN_ORDER_SETUP' ? 'turn-order' : 'lobby'}`}>Continue setup</Link></main>;

  return <main className="table-screen">
    <header className="table-header">
      <Link className="table-back" to="/" aria-label="Leave table"><ArrowLeft size={20} /></Link>
      <div className="table-title"><h1>{game.name}</h1><p>{game.mode === 'JOKER' ? 'Joker' : 'Classic'} · Round {round?.roundNumber || 0} · Boot ₹{game.bootAmount}</p></div>
      <div className="table-toolbar"><span className={`connection-status ${connected ? 'is-connected' : ''}`} title={connected ? 'Connected to the live table' : 'Reconnecting; the table refreshes automatically'}>{connected ? <Wifi size={16} /> : <WifiOff size={16} />}<span>{connected ? 'Live' : 'Reconnecting'}</span></span><button className="table-icon-button" onClick={() => setRules(!rules)} aria-expanded={rules} aria-label="Table rules"><BookOpen size={20} /></button><Link className="table-icon-button" to={`/games/${gameId}/history`} aria-label="Game history"><History size={20} /></Link></div>
    </header>
    {error && <div className="table-error table-error-banner" role="alert">{error}<button onClick={fetchGameState}>Retry</button></div>}
    {rules && <section className="table-rules"><h2>Table rules</h2><p>Three cards each. Trail beats pure sequence, sequence, colour, pair, then high card. Sequences rank AKQ, A23, KQJ, down to 234. Suits have equal value.</p><p>Blind pays the stake; seen pays twice the stake. A raise doubles the blind stake, up to ₹{game.bootAmount * game.maxBetMultiplier}. With two players left, a blind player may show either opponent; a seen player may only show another seen player. The requester loses a tie.</p><p>Side show compares with the previous active player. Both must be seen, with at least three players left. If accepted, the lower hand packs; the requester packs on a tie. Folded cards stay private.</p>{game.mode === 'JOKER' && <p>One indicator is drawn before the deal. Every card matching its rank is wild and takes the best possible value. The indicator is kept out of all hands.</p>}<button className="table-button" onClick={() => setRules(false)}>Close rules</button></section>}
    <section className="table-stage" aria-label="Teen Patti table">
      <div className="table-felt"><span className="felt-brand" aria-hidden="true">TEEN PATTI<span>COMPANION</span></span></div>
      <div className="table-center"><PotArea potAmount={round?.potAmount} currentBet={round?.currentBet || game.bootAmount} />
        {round?.jokerCard && <div className="joker-indicator"><PlayingCard card={round.jokerCard} small /><div className="joker-description"><strong>{rankLabel(round.jokerCard.rank)} is wild</strong><span>All four suits</span></div></div>}
      </div>
      {orderedSeats.map((player, index) => {
        const angle = Math.PI / 2 + index * Math.PI * 2 / orderedSeats.length;
        return <div className="seat-position" key={idOf(player.userId)} style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 39}%` }}><PlayerCircle player={player} isMe={idOf(player.userId) === myId} isCurrentTurn={round?.status === 'ACTIVE' && idOf(player.userId) === idOf(current?.userId)} jokerRank={round?.jokerCard?.rank} /></div>;
      })}
    </section>
    <section className="table-play-area">
      {!round && <div className="round-message"><h2>Ready to deal</h2><p>{seats.length} players seated. Everyone starts blind.</p>{host ? <button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.startRound(gameId))}>{processing ? 'Dealing…' : 'Deal first round'}</button> : <p>Waiting for the host to deal.</p>}</div>}
      {complete && <div className="round-message round-result" role="status"><Crown size={30} /><h2>{round.winnerId?.name || round.winnerId?.username || 'Player'} wins ₹{round.potAmount.toLocaleString('en-IN')}</h2><p>{round.completionReason === 'SHOW' ? 'Hands compared automatically. A tie goes to the player who did not request the show.' : 'Everyone else packed.'}</p>{host ? <button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.startRound(gameId))}>{processing ? 'Dealing…' : 'Deal next round'}</button> : <p>Waiting for the host to deal the next round.</p>}</div>}
      {round?.status === 'SIDE_SHOW_PENDING' && !legacy && <div className="round-message"><h2>Side show requested</h2><p>{target ? `${requester?.userId?.name || 'A player'} wants to compare hands with you.` : 'Waiting for the previous player to accept or decline.'}</p>{target && <div className="response-controls"><button className="table-button button-gold" disabled={processing} onClick={() => perform(() => roundApi.respondSideShow(round._id, true))}>Accept & compare</button><button className="table-button" disabled={processing} onClick={() => perform(() => roundApi.respondSideShow(round._id, false))}>Decline</button></div>}</div>}
      {legacy && <div className="round-message"><h2>Physical-card round</h2><p>This round started before digital dealing. Compare your physical cards to finish it.</p>{round.status === 'SHOW_PENDING' && host && active.map(p => <button className="table-button" key={idOf(p.userId)} disabled={processing} onClick={() => perform(() => roundApi.submitShowResult(round._id, idOf(p.userId)))}>{p.userId.name} wins</button>)}{round.status === 'SIDE_SHOW_PENDING' && [idOf(request.requestedBy), idOf(request.targetPlayer)].includes(myId) && round.players.filter(p => [idOf(request.requestedBy), idOf(request.targetPlayer)].includes(idOf(p.userId))).map(p => <button className="table-button" key={idOf(p.userId)} disabled={processing} onClick={() => perform(() => roundApi.submitSideShowResult(round._id, idOf(p.userId)))}>{p.userId.name} packs</button>)}</div>}
      {round && !complete && <div className="my-hand-area"><div className="hand-caption"><span>Your hand</span><strong>{me?.status === 'PACKED' ? 'Packed' : me?.handRank || 'Playing blind'}</strong>{wallet !== undefined && <small>Available · ₹{wallet.toLocaleString('en-IN')}</small>}</div><CardHand cards={me?.cards} jokerRank={round.jokerCard?.rank} />{me?.status === 'ACTIVE' && !me.seenCards && <button className="table-button see-cards" disabled={processing || round.status !== 'ACTIVE'} onClick={() => handleAction('SEE')}><Eye size={18} /> See cards</button>}</div>}
      {round?.status === 'ACTIVE' && me?.status === 'ACTIVE' && <ActionPanel isMyTurn={myTurn} isProcessing={processing} currentBet={round.currentBet} maxBetLimit={round.startingBet * game.maxBetMultiplier} activePlayersCount={active.length} onAction={handleAction} currentPlayerName={current?.userId?.name} seenCards={me.seenCards} canSideShow={me.seenCards && previous?.seenCards} canShow={!me.seenCards || other?.seenCards} balance={wallet} />}
      {round?.status === 'ACTIVE' && me?.status === 'PACKED' && <p className="spectator-message">You packed. Watch this round and join the next deal.</p>}
      {round?.sideShowRequest && ['TARGET_WON', 'REQUESTER_WON', 'DECLINED'].includes(round.sideShowRequest.result) && round.status === 'ACTIVE' && <p className="spectator-message" role="status">{round.sideShowRequest.result === 'DECLINED' ? 'Side show declined. Play continues.' : 'Side show resolved. The lower hand packed; other hands remain private.'}</p>}
    </section>
    <footer className="table-footer"><span>{seats.length}/6 seats · {game.mode === 'JOKER' ? 'Random rank joker' : 'Classic rules'}</span>{host && <button className="end-game-button" disabled={processing || (round && !complete)} onClick={() => setConfirmEnd(true)}>End game</button>}</footer>
    {confirmEnd && <section className="end-confirm"><h2>Finish this game?</h2><p>All scores will be settled and saved in game history.</p><div className="response-controls"><button className="table-button button-gold" disabled={processing} onClick={() => perform(async () => { await gamesApi.endGame(gameId); setConfirmEnd(false); navigate(`/games/${gameId}/history`); })}>Finish & settle</button><button className="table-button" disabled={processing} onClick={() => setConfirmEnd(false)}>Keep playing</button></div></section>}
  </main>;
}
