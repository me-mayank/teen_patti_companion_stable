# Teen Patti Companion

Private multiplayer Teen Patti with server-dealt cards, Classic and printed-Joker modes, blind/seen betting, automatic shows, side shows, and a transaction ledger.

## Run locally

Use Node.js 20.19+ (or 22.12+) and a MongoDB **replica set**. Transactions are required; a standalone MongoDB server is not sufficient. Atlas clusters support transactions.

1. Install dependencies with `npm ci` in `backend` and `frontend`.
2. Copy each directory's `.env.example` to `.env`. Set `MONGODB_URI`, a strong `JWT_SECRET`, and `CLIENT_URL` in the backend. Point the frontend API and socket URLs at the backend.
3. Run `npm start` in `backend` and `npm run dev` in `frontend`.
4. Register at least two players. The host creates a Classic or Joker game, invites friends, finalizes accepted players, arranges the turn order, starts the table, and deals the first round.

Balances use the existing app's ledger; no payment or withdrawal system is included.

## Disposable demo

For a complete local preview without configuring a database:

- Run `npm run demo` in `backend`, then `npm run dev` in `frontend`.
- Open `http://localhost:5173`.
- Sign in as `demo1@example.test` through `demo6@example.test`, password `TeenPattiDemo1!`. Demo 1 is the host.
- Classic and Joker tables are ready for six players. Use separate browser profiles/private windows for separate players.
- `Demo · Two-player Show` is ready for `demo1@example.test` and `demo2@example.test`. Sign in separately, have demo1 deal the first round, and click Show on the current player's turn. Either player can see their cards before requesting Show; both compared hands appear when it finishes.
- All accounts and balances are synthetic. The temporary database disappears when the demo stops. The first run downloads MongoDB to `/tmp/teen-patti-mongodb`; Internet access is needed for that initial download.

## Rules implemented

- A cryptographically shuffled 52-card deck deals three unique cards per Classic player, in three passes. Tables support 2–6 players. The first turn rotates each round.
- Joker mode deals two unique normal cards plus one printed wild joker to every player. Each joker takes the value that makes the best legal three-card hand. Previously dealt random-rank rounds remain finishable under their original rules.
- Ranking: trail > pure sequence > sequence > colour > pair > high card. Sequence order: AKQ > A23 > KQJ > … > 234. Suits do not break ties.
- Everyone pays the boot and starts blind. Seeing cards is free and may happen off-turn. Seen stakes are twice blind stakes. A player is marked Seen after opening their hand, then Chaal after placing a seen bet or raise; this does not change their active turn eligibility. Seats display the last action separately from the turn marker, plus the last Blind/Chaal payment. A raise doubles the blind stake up to the configured boot multiplier (16× boot by default); a seen payment can be twice that blind limit.
- Digital rounds have a fixed pot limit of **100× the round's boot amount**, including boots and comparison fees. The final payment is limited to the remaining amount. Reaching the cap immediately reveals and compares all active hands (using the joker rank when applicable), without another fee or side-show acceptance. Packed hands remain private. Equal best hands split the pot in whole rupees; any remainder goes to tied winners in table seat order. The normal requester-loses-a-tie rule applies only to comparisons below the cap. Payments, payouts and round completion commit together.
- Only the current active player may bet, raise, pack, or request comparison. Insufficient funds leave the round and ledger unchanged. Availability includes unsettled balances at other tables.
- Side show needs at least three active players. The requester and previous active player must both be seen. The requester pays the seen stake; the target accepts or declines. Accepted comparisons automatically pack the lower hand; ties pack the requester. Both participants can see each other's cards for the rest of that round, including packed hands and earlier accepted comparisons. Other players cannot see those hands unless revealed by a final show or the pot limit. Pending and declined requests do not share cards. Declined requests retain their fee and advance the turn.
- Show needs exactly two active players. On their turn, either player can force a show, including a seen player against a blind opponent; no opponent acceptance is needed. The requester pays twice the current chaal (4× the current blind stake), whether blind or seen, capped to the remaining pot allowance. Hands are compared automatically; ties award the non-requester. Only the two showdown hands are revealed.
- When everyone else packs, the last player wins without revealing their hand. The host deals the next round or ends the game and settles balances exactly once.
- Legacy physical-card rounds remain finishable through the existing manual controls. Digital rounds never accept a client-selected winner.

## Verification

- Backend: `npm test -- --runInBand`. Integration tests run against their own temporary MongoDB replica set and never use `MONGODB_URI`.
- Frontend: `npm test`, `npm run build` and `npm run lint`.
- Tests cover all 22,100 standard hands, joker substitutions, unique deals, HTTP card privacy and permissions, authenticated sockets, full invitation/setup flow, fees, payouts, insufficient funds, concurrent requests, and legacy compatibility.

Actions apply their authenticated round response immediately, without extra table reads before re-enabling controls. Realtime round events carry a committed round number and revision. Notifications already covered by an action response are skipped; newer peer actions refresh only the round, and overlapping notifications queue at most one follow-up read. Reads started before an action cannot overwrite its confirmed response. Events never carry private cards; HTTP responses return only the viewer's seen hand, hands shared with them through accepted side shows, and publicly revealed showdown hands. Reconnect joins the room again and refreshes immediately. Full-table polling runs every 60 seconds when the live room is connected, or every 10 seconds while disconnected. Hidden tabs pause background reads and refresh immediately on return.

Boot payments batch wallet checks and ledger writes within one transaction. Turn responses reuse the balance checked by that transaction, including payouts. Card reveals update only the viewer’s seen flag and revision atomically; they do not need a financial transaction. Private response details and wallet reads run concurrently outside transactions.

Screens load on demand. The table fits the viewport in desktop, portrait and landscape layouts, with compact overlapping three-card fans and a persistent action dock. Rules and end-game confirmation use accessible dialogs. Accepted side shows open a private comparison dialog for the two participants; shared hands remain available through a compact button. Wins have a prominent name, hand result, amount and short confetti animation that respects reduced-motion preferences.

The active pack uses image-generated enhancements of the supplied Bicycle face sheet, printed joker and red back. The face sheet has uniform saturated reds, deep blacks, clean paper and vivid court artwork. Its original logical crop coordinates preserve the compact card fans. The back is a complete upright scan restored from the partly obscured reference photo. Both assets preload and are included in the PWA cache. All numbered-face pip counts and face-crop margins were verified. The original images and the old CC0 deck remain as references. Attribution and generation prompts are recorded in `frontend/src/assets/licenses/cards.md` and `frontend/src/assets/cards/enhancement-prompts.md`.

The table keeps its illustrated lounge and selectable dealers, Anaya and Tara. Dealer selection is remembered locally; all dealing, comparison and privacy stay on the server. Table artwork details are in `frontend/src/assets/table/README.md`.
