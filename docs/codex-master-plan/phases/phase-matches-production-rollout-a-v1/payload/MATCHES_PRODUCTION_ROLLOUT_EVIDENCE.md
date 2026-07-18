# Matches Production Rollout Evidence

Public-safe evidence only. Never include tokens, authorization headers, database URLs, raw provider payloads, secret values, private IDs outside the approved Railway scope, or fabricated observations.

## Identity

- phase: `MATCHES-PRODUCTION-ROLLOUT-A`
- pack: `MATCHES-PRODUCTION-ROLLOUT-A-v1`
- expected deployed SHA: `03f308be14a330d269c484efc853e307ffb9c7ce`
- canonical migration: `20260718210000_fixture_competition_id`

## Scope binding

- Railway project ID:
- staging environment ID:
- staging API / ingestion / agent / evaluation / Web service IDs:
- staging API / Web origins:
- production environment ID:
- production API / ingestion / agent / evaluation / Web service IDs:
- production API / Web origins:
- scope discovery approval timestamp UTC:

## Gate ledger

| Gate | Human approval timestamp UTC | Started UTC | Finished UTC | Result | Safe evidence summary |
| --- | --- | --- | --- | --- | --- |
| SCOPE-DISCOVERY-READONLY | | | | pending | |
| STAGING-PREFLIGHT-READONLY | | | | pending | |
| STAGING-MIGRATION-APPLY | | | | pending | |
| STAGING-DEPLOY | | | | pending | |
| STAGING-BACKFILL-APPLY | | | | pending | |
| STAGING-ACCEPTANCE-READONLY | | | | pending | |
| PRODUCTION-PREFLIGHT-READONLY | | | | pending | |
| PRODUCTION-MIGRATION-APPLY | | | | pending | |
| PRODUCTION-DEPLOY | | | | pending | |
| PRODUCTION-BACKFILL-APPLY | | | | pending | |
| PRODUCTION-ACCEPTANCE-READONLY | | | | pending | |

## Environment evidence

For each environment record deployed SHA per service, migration status/version, database readiness reason, ingestion/agent/evaluation heartbeat timestamps, upstream status, backfill checkpoint and `shadow_only` learning state. Unknown competition IDs must remain null.

## Read-only acceptance

Record Today/Tomorrow coverage, UTC range and competition filtering, refresh/last-success/stale behavior, pagination beyond 10,000 fixtures, safe errors, match detail, CORS rejection and all legacy 410 checks. Production Accepted is `true` only when all eleven gates are PASS and every deployed service reports the expected SHA.

## Final facts

- migration applied to staging: false
- staging deployment performed: false
- staging backfill completed: false
- migration applied to production: false
- production deployment performed: false
- production backfill completed: false
- production acceptance: false
- limitations:
