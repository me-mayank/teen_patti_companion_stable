# Review of compact-table gameplay fixes

Reviewed `git diff 9fd490e^...9fd490e` against the user's feature summary, README.md and DESIGN.md. Follow-up fixes accompany this review on `codex/compact-table-gameplay-fixes`.

## Standards

The independent standards review found two inconsistencies with DESIGN.md, both fixed:

- **P2: Last-action state was not atomic.** Overlapping See requests could use an old blind snapshot to overwrite a newer Chaal label. The server now changes Seen only when the stored player is still unseen. Duplicate requests do not write a revision or notify every connected player.
- **P2: Legacy Joker information was hidden.** The public wild rank is displayed again as a compact label.

No substantive naming, abstraction or duplication issue warranted a broad refactor. Existing compact component and stylesheet conventions were preserved.

## Spec

The independent requirements review found three issues, all fixed:

- **P2: Preserve the public wild rank in older rounds.** The generic legacy label prevented blind players from knowing which rank was wild. The table now names it and states that all suits are wild.
- **P2: Preserve the latest action after concurrent reveals.** The unseen-to-seen transition now uses a database predicate, with a deterministic regression test covering reveal → Chaal → delayed duplicate reveal.
- **P2: Keep dismissed comparisons closed after Show.** A publicly revealed hand leaving the private comparison list no longer reopens the popup over the result. New shared hands and comparisons in a new round still open; manual reopening remains available.

The reviewed Show pricing/capping, printed-joker dealing, server-side card privacy, 16× blind default and artwork caching matched the supplied requirements.

Standards: 2 findings, worst severity P2; Spec: 3 findings, worst severity P2. Two findings overlap between axes. All are resolved.

## Additional browser fixes

- Restore keyboard focus to the opener when a dialog is unmounted.
- Move the lower-left player upward in short landscape so the last payment remains visible above the action dock.

Validation: 72 backend tests, 28 frontend tests, production build, lint (eight pre-existing warnings), responsive browser inspection and a clean whitespace check. See VERIFICATION.md for coverage and the local preview limitation.

The follow-up reviewer also suggested rereading an already-seen snapshot to avoid concurrent stale responses. No extra read was added: an additional read can race as well, and responses retain their revision so the existing frontend synchronization rejects older state. The important fix prevents stale requests from writing over newer actions.
