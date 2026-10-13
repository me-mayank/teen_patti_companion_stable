# Verification — compact table and gameplay fixes

Verified on 12 October 2026 on `codex/compact-table-gameplay-fixes`.

- Backend: **70 tests passed** across three suites. Includes all 22,100 natural hands, per-seat printed joker dealing and evaluation, legacy rank-joker compatibility, card privacy, accepted side-show sharing, payments, payouts, pot caps and concurrent requests.
- Revised Show fee: blind and seen requesters both pay twice the current chaal. Tests cover raised stakes, capped payments, ties and rollback when funds are insufficient.
- Player actions: tests verify Seen/Blind/Chaal transitions and the actual last payment for normal and raised bets. Frontend checks preserve last-action labels during the player's turn.
- Frontend: **25 tests passed**, including private comparison display for either participant, packed-player access, closing/reopening comparisons, bystander privacy, completed Show hands, fees, balance checks, card artwork and round synchronization.
- Production build passed. The PWA caches 37 entries, including the supplied deck images. Lint passed with existing React effect and fast-refresh warnings; no errors.
- Browser: tested disposable six-player Classic and Joker tables, a private side-show popup, printed joker cards, visible last Blind/Chaal amounts, and a completed two-player Show with a large winner/amount announcement. The completed-round DOM contains 48 confetti particles and CSS disables them for reduced motion.
- Responsive checks: 1280×720 desktop, 390×844 portrait, 320×568 small portrait and 844×390 landscape. Document dimensions match each viewport. Seat, hand and action regions remain in bounds. Final short-landscape pot and hand regions have a visible gap.
- Design detector reported no deterministic issues; `git diff --check` passed.

All browser accounts, balances and rounds used the disposable local demo. The source Bicycle references are retained exactly; the back is reconstructed from the unobscured half because the ace covers part of it. Source details are in `frontend/src/assets/licenses/cards.md`.

## Review follow-up — 12 October 2026

- Reviewed commit `9fd490e` against its parent, the supplied requirements, README and DESIGN.md. Findings and resolutions are in `REVIEW.md`.
- Backend: **72 tests passed**. A deterministic delayed-reveal regression failed before the fix (Seen incorrectly replaced Chaal), then passed. Repeated reveals now preserve the revision and emit no update notification.
- Frontend: **28 tests passed**. Added checks for legacy wild-rank visibility, dismissed comparisons staying closed when a hand becomes public, and new comparisons still opening automatically.
- Production build passed with 37 precache entries; lint retained eight existing warnings and no errors. The design scan and `git diff --check` passed.
- Browser: inspected the current table at 1280×720, 390×844, 320×568 and 844×390. Portrait and landscape document dimensions matched the viewport. Fixed the lower-left six-player seat being obscured by the landscape action dock; all six seat bottoms are now above the dock at 844×390.
- Browser: closing Table rules now restores focus to its opener. Previously focus returned to the document body.
- Visual checks used the disposable local demo on a fresh frontend port because older preview origins served cached UI. Its socket origin is not in the demo server's allowlist, so those visual checks used the fallback refresh and showed Reconnecting. Automated backend coverage includes socket access and private-data restrictions; this pass does not claim a fresh multi-browser realtime smoke test.

## Card clipping follow-up — 13 October 2026

The card sheet crops used approximate coordinates from the resized 1408px chat
preview, scaled to the original image. Those rectangles cut through corner
indices on several faces. The fix calibrates row and column edges directly in
the original 1440×1800 PNG, preserving white margins and the compact card fan.

A regression test measures all 52 face and printed-joker crop rectangles against
independently captured ink extents, requiring an eight-source-pixel safe border.
The fixture includes a source hash to detect image changes. This test failed on
the original implementation and passes after calibration.

All 29 frontend tests pass; production build and lint complete with the existing
React warnings. A browser fixture using the real PlayingCard and CardHand
components verified every face on desktop and the reported 4H/6S/3C hand at both
desktop and 390px mobile sizes, including small table cards. No browser errors.
The temporary preview was removed after verification. No game rules changed.


## Image-generated deck enhancement — 13 October 2026

The built-in image-generation tool restored the face sheet and produced a clean,
complete upright card back from the supplied references. Enhanced assets are
saved beside the original images and used by PlayingCard and the preload helper.
Final prompts are saved in `frontend/src/assets/cards/enhancement-prompts.md`.

- All 36 numbered faces (2–10 in four suits) passed a connected-ink-component pip-count check against their ranks.
- Every face and joker retains at least eight logical pixels of white border around its measured ink extent; tests validate source hashes for both original and enhanced images.
- Previously faded 4/5/6 hearts have red pip interiors around RGB (250, 5, 5), and 5/6 spades have black interiors around RGB (10, 10, 10).
- All 29 frontend tests passed. Production build passed and includes both enhanced PNGs in the PWA cache. Lint completed with existing React warnings.
- The real PlayingCard/CardHand components were checked in a temporary desktop and 390px mobile gallery, including all 52 faces, the joker, large/small fans and the restored back. No browser errors. The preview was removed after verification.

No dealing, ranking, payment or card-visibility rules changed.
