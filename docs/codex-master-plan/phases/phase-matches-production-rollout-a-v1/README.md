# MATCHES-PRODUCTION-ROLLOUT-A v1

## Purpose

Roll out completion commit `03f308be14a330d269c484efc853e307ffb9c7ce` through staging and production with independently approved, evidence-backed gates. Installing or publishing this pack performs no rollout operation.

## Initial state and scope binding

The phase starts as `awaiting_human_approval` with `human_approved=false`. Before the first external request, a separate human instruction must approve the read-only scope-discovery gate. That gate may inspect only Railway project `e8540514-d2b9-4585-8d2a-a62fc3c87829` metadata to record exact staging and production environment IDs, API/ingestion/agent/evaluation/Web service IDs, and public API/Web origins. The previously recorded production environment `704417a2-a89e-45ee-8900-a738149d675e` and API service `1fd625ca-6da0-4bfd-a5ad-08230ec6a4be` are untrusted hints until reverified. Missing staging or service scope is `MISSING_SOURCE`; do not create, rename, clone or mutate infrastructure during discovery.

`RAILWAY_TOKEN` is the only local credential name permitted for Railway metadata/deployment commands. `MATCHPULSE_INTERNAL_TOKEN` may be consumed only from existing secure platform/runtime storage for authenticated status GETs. `DATABASE_URL` must remain inside the scoped Railway runtime and must never be retrieved, printed or copied. Public origins and deployed SHAs are non-secret evidence; authorization headers, logs containing secrets, raw provider payloads and private identifiers are forbidden evidence.

## Mandatory gate sequence

1. `SCOPE-DISCOVERY-READONLY`: Railway project metadata only; no configuration or service mutation.
2. `STAGING-PREFLIGHT-READONLY`: deployed SHA, service status, migration status, database backup/restore evidence, current health and origins.
3. `STAGING-MIGRATION-APPLY`: one non-retried apply attempt after proving `20260718210000_fixture_competition_id` is the sole expected pending migration.
4. `STAGING-DEPLOY`: deploy one service at a time in this order: API, ingestion worker, agent worker, evaluation worker, Web.
5. `STAGING-BACKFILL-APPLY`: run dry-run first, then resumable evidence-only apply batches; unknown competition IDs remain null.
6. `STAGING-ACCEPTANCE-READONLY`: verify deployed SHA, migration, all component heartbeats, readiness, today/tomorrow, filters, refresh, pagination, errors and match detail.
7. `PRODUCTION-PREFLIGHT-READONLY`: repeat scope, backup/restore, deployed-version, migration and health checks without writes.
8. `PRODUCTION-MIGRATION-APPLY`: one non-retried apply attempt under the same sole-pending-migration invariant.
9. `PRODUCTION-DEPLOY`: API, ingestion worker, agent worker, evaluation worker, then Web, one service at a time with health evidence between services.
10. `PRODUCTION-BACKFILL-APPLY`: dry-run, bounded resumable apply batches and evidence-backed completion only.
11. `PRODUCTION-ACCEPTANCE-READONLY`: deployed SHA, migration version, fresh independent heartbeats, upstream status, today/tomorrow coverage and read-only browser/API E2E.

Every item requires a new explicit human instruction naming that exact gate. Approval of one item does not authorize the next. A failed mutation is not retried automatically. Read-only requests use a 30-second timeout, at most two retries after the first attempt for network/429/5xx, honor `Retry-After`, and run with concurrency one. Monitoring waits are bounded to five minutes per observation cycle and must yield progress at least once per minute.

## Migration, deployment and backfill invariants

The only permitted migration is the committed additive `prisma/migrations/20260718210000_fixture_competition_id/migration.sql`. The older `20260718170000_fixture_competition_id` text in a historical operations document is stale and forbidden for execution. Migration preflight must fail if another unexpected migration is pending. Never use migration or seed as a service startup command.

Rollback is application-version rollback or a forward corrective migration only. Never drop `competition_id`, delete fixtures, or delete ingestion/raw evidence. Deployment must target the exact bound environment/service IDs and commit SHA. Each worker uses the existing Worker image with only its matching enable flag true; public domains and cron remain disabled. Learning remains `shadow_only`; no model promotion is permitted. Watchlist and Telegram remain 410-disabled.

Backfill uses `node dist/index.js matches-catalog-reconcile` in dry-run mode first, followed only after its gate by `--apply --resume --batch-size=250` with a bounded `--max-batches`. Continue from the recorded checkpoint until `finished=true`; never infer IDs from names and never label unproven rows.

## Evidence and completion

Only `docs/operations/matches-production-rollout-evidence.md` may be created or updated. Copy the payload template before the first approved external gate. Evidence is public-safe and records each human approval, exact scope IDs, timestamps, commands in redacted form, result, deployed SHA, migration version, worker heartbeats and acceptance observations. Production is accepted only when every gate is PASS and the deployed SHA equals the baseline completion commit.

Run the manifest validations after every evidence update. At final completion, set `ACTIVE_PHASE.json` to `completed_pending_review`, record truthful migration/network/deployment/production-acceptance facts, run Automation v2 Prepare and stop before Publish.

## Stop conditions

Stop with the repository code applicable to missing approval, scope, secret, network, migration safety, non-fast-forward state, failed health, version mismatch, test failure or unauthorized file requirement. Do not work around a gate, broaden a service scope, expose a secret, fabricate evidence or declare degraded readiness as accepted.
