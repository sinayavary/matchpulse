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

The exact implementation and documentation targets are listed in `manifest.json`. Additive Prisma changes are permitted only through the explicitly named migration target; production migration, seed, deployment, and production writes are not permitted by this phase.

## Required audit and verification

Before implementation, record the read-only discovery-to-Web audit in `docs/matches-catalog-audit.md`. Run all commands in `manifest.json`, including focused lifecycle/discovery/dedup/cursor/API/Web tests, query-count and leakage checks, typechecks, build, Prisma validation/diff, and `git diff --check`. Production verification is read-only and only runs when an authorized origin and credentials exist; otherwise record `IMPLEMENTATION_COMPLETE_WAITING_FOR_PRODUCTION_VERIFICATION` without fabricated evidence.

## Rollback

Rollback is one scoped prepared commit. Never delete fixtures, MatchState, Odds, Event, Replay, Prediction, or source payload records. Do not apply the migration without separate explicit authorization.

## Completion gate

Set `ACTIVE_PHASE.json` to `completed_pending_review` only after every validation passes, exact files are recorded, migration/network/deployment facts are truthful, and no unauthorized file changed. Then run Automation v2 Prepare and stop before Publish.
