# MATCHES-RAILWAY-TOPOLOGY-A v1

## Purpose

Establish the additive Railway topology required before `MATCHES-PRODUCTION-ROLLOUT-A-v1` can resume. Installing or publishing this pack performs no Railway operation.

## Initial state and fixed topology

The phase begins `awaiting_human_approval` with `human_approved=false`. Its Railway project is `e8540514-d2b9-4585-8d2a-a62fc3c87829`. Every gate needs a new explicit human instruction naming that exact gate.

Create environment `staging` only when the corresponding create gate is approved and it does not already exist. The required staging services are `matchpulse-api-staging`, `matchpulse-ingestion-worker-staging`, `matchpulse-agent-worker-staging`, `matchpulse-evaluation-worker-staging`, and `matchpulse-web-staging`.

Preserve production API `mathpluse-api` (`1fd625ca-6da0-4bfd-a5ad-08230ec6a4be`) and production Web `matchpulse-web` (`cec81dbb-80c4-4c5d-a332-eac04a03c7a5`). Create the additive production worker services `matchpulse-ingestion-worker`, `matchpulse-agent-worker`, and `matchpulse-evaluation-worker` only in their approved gate. The ambiguous existing `mathpluse-api Copy` and `matchpulse` services must not be deleted, renamed or reused.

No gate in this pack authorizes variable changes, migration, database access, deployment, source connection, cron, public exposure other than an explicitly approved domain gate, or secret retrieval. `RAILWAY_TOKEN` is the only permitted local credential name; never print, persist or copy its value.

## Mandatory gate sequence

1. `TOPOLOGY-PREFLIGHT-READONLY`: inspect only project metadata and record exact current environment, service and public-domain state.
2. `STAGING-ENVIRONMENT-CREATE`: create only environment `staging`, once and without retry; if it already exists, record that fact and do not mutate it.
3. `STAGING-SERVICES-CREATE`: create only the five named staging services, once per absent named service and without retry; do not configure variables, source, deployment, database or domains.
4. `PRODUCTION-WORKERS-CREATE`: create only the three named production worker services, once per absent named service and without retry; preserve all existing services.
5. `STAGING-DOMAINS-CONFIGURE`: configure only the exact human-specified staging API/Web domains after their names and target services are included in the approval; never expose worker services.
6. `PRODUCTION-DOMAINS-CONFIGURE`: configure only the exact human-specified production API/Web domains after their names and target services are included in the approval; never expose worker services.
7. `TOPOLOGY-ACCEPTANCE-READONLY`: prove exact environment, service and domain bindings without deployments, database access, variables, migration or source changes.

Read-only requests use a 30-second timeout, maximum three attempts for network/timeout/429/5xx, `Retry-After` when supplied, and concurrency one. Mutations are not retried. A missing approved name, ID, source or gate is `MISSING_SOURCE` or `HUMAN_APPROVAL_REQUIRED`; do not guess or broaden scope.

## Evidence and handoff

Only `docs/operations/matches-railway-topology-evidence.md` may be created or changed during phase execution. It contains public-safe IDs, names, public domains, approval timestamps and outcomes; it must never contain tokens, authorization headers, secret values, database URLs, raw provider payloads or fabricated observations.

After all seven gates pass, topology acceptance may unblock `MATCHES-PRODUCTION-ROLLOUT-A-v1`; it does not authorize that rollout, migration, backfill or deployment. The rollout requires a separate governance activation and its own gates.
