# FREE-ACCESS-LOCAL-DB-VALIDATION-A-v1

## Identity

- Phase: `FREE-ACCESS-LOCAL-DB-VALIDATION-A`
- Pack: `FREE-ACCESS-LOCAL-DB-VALIDATION-A-v1`
- Title: Isolated local PostgreSQL validation for Free Access security
- Baseline: `2fc45285a5e39c48f4a1e6ed7d97f0e70b8f8256`
- Depends on: completed `FREE-ACCESS-SECURITY-B`
- Program alignment: `10O-B`

This is a validation-only governance pack. It does not authorize implementation outside the manifest, Docker, image pulls, registry access, application/provider network access, deployment, Railway, production acceptance, secret discovery, or any remote/shared database.

## Database safety gate

Execution may proceed only when a local PostgreSQL major version 16 server is already available. The host must resolve to `localhost`, `127.0.0.1`, or `::1`; the database name must begin with `matchpulse_free_access_validation_`; and the database must be verified empty before migration. If these conditions cannot be proven, stop at `LOCAL_POSTGRES_16_REQUIRED`. Never download an image from a registry to satisfy this gate.

Migration apply, rollback, and cleanup are allowed only against that disposable database. This activity is validation evidence, not production acceptance.

## Required evidence

Validate Prisma schema/migration equivalence, destructive SQL safety, tables/indexes/unique constraints/foreign keys, migration status and idempotency, and all durable security behaviors listed in the payload. Run focused security tests, the full API regression, API/Web/root typecheck and build, `git diff --check`, and exact allowlist verification.

Completion metadata must truthfully record `migration_applied=true`, `database_connected=true`, `database_scope=isolated_disposable_local_postgresql_16`, `external_network_accessed=false`, `registry_accessed=false`, `deployment_performed=false`, `production_acceptance=false`, `production_database_accessed=false`, and `shared_database_accessed=false` only when those facts are evidenced.

## Gate

Set the active phase to `completed_pending_review` only after the phase gate passes and stop. Do not transition to another phase.
