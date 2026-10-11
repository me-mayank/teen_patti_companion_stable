# Verification — card dealing and joker mode

- Backend: **49 tests passed** in three suites, including exhaustive ranking of the 22,100 standard hands and temporary-database integration tests.
- Pot cap: real-payment integration cases verify 100× boot, exact and capped final contributions, blind/seen/raise/show/side-show paths, joker comparisons, packed-hand privacy, concurrent completion, whole-rupee tie splits, next-round reset and older digital-round fallback.
- Frontend: production build completed; lint completed with warnings (React effect and fast-refresh advisories). No lint errors.
- Dependency scan: frontend has zero reported vulnerabilities; backend production dependencies have zero. The test-only Jest coverage dependency tree retains moderate advisories; no forced major downgrade was applied.
- Browser: actual six-player Classic and Joker tables tested through the local demo API. Verified dealing, seeing cards off-turn, seen betting, turn advancement, automatic showdown/payout, next-round dealing, and authenticated live updates.
- Pot-cap browser check: six-player Joker round at ₹920; a seen player paid the remaining ₹80 instead of the ₹160 stake. The pot finished at ₹1,000 and all active hands were shown automatically. Desktop and 390px mobile limit/payment displays were inspected; mobile document width remained 390px.
- Demo showdown: ₹90 pot, two public showdown hands, all other hands private, zero-sum ledger confirmed. Demo money and accounts are synthetic.
- Responsive evidence: 1440×960 desktop and 390×844 mobile captures have no horizontal document overflow. The mobile joker-card sizing and contrast defects found during inspection were corrected.
- Fresh finish review: table composition, private hand, joker indicator, and action row matched the documented direction. Reviewer requested a turn-label correction; the follow-up review scored that correction resolved and returned `ship` at that fix's scope.

Screenshots are local review evidence under `.impeccable/review/`. The local demo uses a disposable MongoDB replica set. Production deployment and an existing hosted database were not exercised; configuring a transaction-capable MongoDB connection and server secrets is required for deployment.
