# Local operations reliability contract

Every allowlisted implementation target must map to one obligation; no unlisted file may change.

| Target | Contract |
|---|---|
| `apps/api/src/server.ts` | Separate public liveness from internal readiness; bounded DB readiness; safe degraded responses; no provider calls. |
| `apps/api/src/db-health.ts` | Timeout-bounded DB probe with deterministic connected/unavailable outcomes. |
| `apps/api/src/db-health.test.ts` | Liveness/readiness and timeout behavior tests. |
| `apps/api/src/operational-observability.ts` | Recursive redaction and bounded internal operational metrics. |
| `apps/api/src/operational-observability.test.ts` | Nested secret, credential, token, URL, signature, cookie, and raw-payload redaction tests. |
| `apps/api/src/operational-reliability.test.ts` | API failure, degraded response, readiness, persistence exception, and recovery tests. |
| `apps/worker/src/index.ts` | Emit only the sanitized heartbeat/health contract and preserve failure redaction. |
| `apps/worker/src/health-contract.ts` | Worker health/heartbeat schema, stale-state rules, and bounded counters. |
| `apps/worker/src/health-contract.test.ts` | Fresh/stale heartbeat, failure, restart, and redaction tests. |
| `scripts/local-postgres-backup-restore.ps1` | Loopback/PostgreSQL-16-only pg_dump/pg_restore validation, prefixes, checksum, schema/row checks, corrupt/wrong-target rejection, and cleanup. |
| `docs/security/local-operations-reliability-runbook.md` | Local runbook and evidence interpretation; no secret discovery or production instructions. |

Forbidden: migrations, `db push`, Docker, registry/image access, external/provider network, remote/shared/production databases, deployment, production acceptance, secret values, raw payloads, and fabricated evidence.
