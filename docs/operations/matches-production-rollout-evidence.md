# Matches Production Rollout Evidence

Public-safe evidence only. Never include tokens, authorization headers, database URLs, raw provider payloads, secret values, private IDs outside the approved Railway scope, or fabricated observations.

## Identity

- phase: `MATCHES-PRODUCTION-ROLLOUT-A`
- pack: `MATCHES-PRODUCTION-ROLLOUT-A-v1`
- expected deployed SHA: `03f308be14a330d269c484efc853e307ffb9c7ce`
- canonical migration: `20260718210000_fixture_competition_id`

## Scope binding

- Railway project ID: `e8540514-d2b9-4585-8d2a-a62fc3c87829`
- staging environment ID: missing; the project metadata exposes only `production`
- staging API / ingestion / agent / evaluation / Web service IDs: missing with the staging environment
- staging API / Web origins: missing with the staging environment
- production environment ID: `704417a2-a89e-45ee-8900-a738149d675e`
- production API service ID: `1fd625ca-6da0-4bfd-a5ad-08230ec6a4be` (`mathpluse-api`)
- production ingestion / agent / evaluation worker service IDs: missing; no distinct role bindings are present in the returned metadata
- production Web service ID: `cec81dbb-80c4-4c5d-a332-eac04a03c7a5` (`matchpulse-web`)
- production API origin: `https://mathpluse-api-production.up.railway.app`
- production Web origin: `https://matchpulse-web-production.up.railway.app`
- scope discovery approval timestamp UTC: `2026-07-18T16:45:13.574Z`

## Gate ledger

| Gate | Human approval timestamp UTC | Started UTC | Finished UTC | Result | Safe evidence summary |
| --- | --- | --- | --- | --- | --- |
| SCOPE-DISCOVERY-READONLY | 2026-07-18T16:45:13.574Z | 2026-07-18T20:18:15.4998007Z | 2026-07-18T20:18:15.4998007Z | MISSING_SOURCE | Read-only Railway metadata verified project `vibrant-serenity`, its sole `production` environment, four services, and the API/Web public domains. Staging and distinct ingestion/agent/evaluation worker bindings remain unproven. No mutation was attempted. |
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

Read-only Railway metadata exposed one environment, `production`, and these four services:

- `1fd625ca-6da0-4bfd-a5ad-08230ec6a4be` — `mathpluse-api` (the prior API hint was reverified)
- `6c419813-4f23-49b7-b613-8d0cbf21e8a8` — `mathpluse-api Copy` (role intentionally left unbound)
- `cec81dbb-80c4-4c5d-a332-eac04a03c7a5` — `matchpulse-web`
- `d140ac5b-ea2a-40ee-bbe9-c0c64a1ae4bc` — `matchpulse` (role intentionally left unbound)

No staging environment was returned. No service was guessed to be an ingestion, agent or evaluation worker. API and Web public origins were verified from read-only service metadata. Deployed SHA, migration status, component heartbeats, upstream status, backfill checkpoint and learning state remain unverified because they belong to later gates.

## Read-only acceptance

Not started. Production Accepted remains false.

## Final facts

- migration applied to staging: false
- staging deployment performed: false
- staging backfill completed: false
- migration applied to production: false
- production deployment performed: false
- production backfill completed: false
- production acceptance: false
- limitations: `MISSING_SOURCE` — the required staging environment and distinct ingestion/agent/evaluation worker service bindings are absent or not provable from the approved metadata. Infrastructure creation or configuration requires a separate governance amendment and explicit human authorization.
