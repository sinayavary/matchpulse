# LOCAL-OPERATIONS-RELIABILITY-A-v1

## Identity

- Phase: `LOCAL-OPERATIONS-RELIABILITY-A`
- Pack: `LOCAL-OPERATIONS-RELIABILITY-A-v1`
- Title: Local operations reliability closure
- Baseline: `9c2c7ea5230781a4942b7a7ce6ccc01f1a69745c`
- Depends on: completed `FREE-ACCESS-LOCAL-DB-VALIDATION-A`
- Program alignment: `10O-B`

This pack closes the remaining repository-controlled 10O-B reliability requirements. It authorizes local code and tests plus backup/restore validation only against an already-running PostgreSQL 16 loopback instance and disposable databases with the required prefixes. It forbids migrations, Docker, image pulls, provider/application network access, secrets, remote/shared/production databases, deployment, and production acceptance.

Implement the exact allowlist and payload contract: separate API liveness/readiness with bounded DB timeout and no provider calls; a worker heartbeat contract; sanitized degraded responses; recursive redaction; bounded internal metrics; and executable tests. Provide a PowerShell PostgreSQL 16 backup/restore validator using only loopback hosts, `pg_dump`, `pg_restore`, `createdb`, and `dropdb`. Source names must begin `matchpulse_ops_source_`; restore names must begin `matchpulse_ops_restore_`. Verify SHA-256, schema/row counts, corrupt backups, wrong targets, fresh disposable restore, and cleanup.

Human gate: `LOCAL_POSTGRES_16_TOOLS_REQUIRED`. If PostgreSQL 16 tools or a qualifying server cannot be proven, stop without claiming completion. Run every command in `manifest.json` and stop after this phase; do not activate 10O-C automatically.
