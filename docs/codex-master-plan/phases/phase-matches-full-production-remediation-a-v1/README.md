# MATCHES-FULL-PRODUCTION-REMEDIATION-A v1

## Purpose

Implement the complete human-approved Matches production remediation plan from baseline
`9c2c7ea5230781a4942b7a7ce6ccc01f1a69745c`. Preserve the verified catalog reliability work
while closing the remaining data-contract, runtime, security, Web UX, CI, and release gaps.

## Required outcomes

1. Add nullable indexed `Fixture.competitionId`, source-only expand migration, ingestion propagation,
   safe resumable backfill, correct API filtering, competitions catalog, and UTC `from`/`to` filters.
2. Run ingestion, intelligence, and evaluation as independently locked and observable loops with
   heartbeat-renewed leases, checkpoints, batch isolation, bounded classified retry, and shadow-only learning.
3. Make public readiness evidence-derived; distinguish Presenter no-data from dependency failure; retire unsafe
   legacy/mock routes with 410; require production CORS/API URL configuration; complete date, competition,
   refresh, stale/error, cancellation, and UTF-8 Web behavior.
4. Replace placeholder lint, require full CI including browser E2E, document additive rollout, and record only
   evidence-backed acceptance. Production acceptance remains false in this phase.

## Invariants

- No production migration apply, database access, deployment, secret access, provider network call, or production write.
- No raw provider payload, credentials, private model detail, betting fields, fabricated fixture, or unsupported readiness claim.
- Existing public fields remain backward-compatible; `product_ready` becomes derived rather than removed.
- Learning remains `shadow_only`; no automatic model promotion.
- Watchlist and Telegram remain unavailable until their dedicated production phase.
- Source and derived sports records are not deleted or destructively rewritten.

## Completion

Run every command in the manifest, record exact results, set `completed_pending_review`, and use Automation v2
Prepare. Do not publish, apply the migration, deploy, access production, or activate another phase.
