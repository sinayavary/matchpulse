# MATCHES-CATALOG-RELIABILITY-B v1

## Purpose

Rebuild Matches as a canonical, complete, lifecycle-correct catalog from provider discovery through public API and Web. The paused `PROD-LIVE-E2E-ACCEPTANCE-B` phase remains in the queue and is resumed only after this remediation is complete.

## Non-negotiable invariants

- Provider status is normalized from real payload fields; `UNKNOWN` is used only when no usable status exists.
- A terminal lifecycle is never active or live. A kickoff at or before `now` is never Upcoming. Future terminal, postponed, cancelled, or abandoned fixtures are never Upcoming.
- Discovery covers a configurable UTC backfill plus a configurable fourteen-day default future horizon, with independent near/far cadence and per-day failure isolation.
- Source fixtures are preserved. Public catalog rows are deduplicated by a normalized, orientation-aware canonical identity and deterministic representative selection; ambiguous candidates remain retained internally.
- Range filtering and deduplication happen before pagination. Pagination uses a versioned opaque seek cursor with deterministic tie-breakers and stable no-overlap/no-gap behavior.
- List enrichment is batched and bounded; per-fixture enrichment queries are forbidden.
- Every public list item includes lifecycle fields and precise availability states for score, odds, and events.
- Web Matches exposes Live now, Starting soon, Upcoming, Recently finished, Interrupted, and All with local-date grouping, countdowns, resilient refresh, cursor loading, and accessible precise empty/error states.
- Reconciliation is additive, idempotent, resumable, dry-run capable, and never deletes source or derived rows.
- No raw provider payload, secret, internal lineage, model detail, or betting field is public.

## Allowed implementation

The exact implementation and documentation targets are listed in `manifest.json`. The only allowed documentation target is `docs/public-api-contract.md`.

Prisma schema change is prohibited. Migration creation is prohibited. Migration application is prohibited. Database write is prohibited. `migration_applied=false`.

## Required audit and verification

Run all commands in `manifest.json`, including focused lifecycle, public API, fixture ingestion, TxLINE normalizer, odds discovery window, public-contract leakage, Web typecheck, and Web production build validation; also run API regression, Prisma validation/diff, and `git diff --check`. Do not create documentation outside the manifest allowlist. Production network access and production verification are prohibited.

## Rollback

Rollback is one scoped prepared commit. Never delete fixtures, MatchState, Odds, Event, Replay, Prediction, or source payload records. No migration may be created or applied by this phase.

## Completion gate

Set `ACTIVE_PHASE.json` to `completed_pending_review` only after every validation passes, exact files are recorded, migration/network/deployment facts are truthful, and no unauthorized file changed. Then run Automation v2 Prepare and stop before Publish.
