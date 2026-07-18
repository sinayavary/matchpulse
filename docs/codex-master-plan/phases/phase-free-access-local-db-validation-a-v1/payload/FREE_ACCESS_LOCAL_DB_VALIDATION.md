# FREE-ACCESS-LOCAL-DB-VALIDATION-A validation payload

## Hard boundary

The only permitted database is a new, disposable local PostgreSQL 16 database. Acceptable hosts are `localhost`, `127.0.0.1`, and `::1`. The name must begin with `matchpulse_free_access_validation_`. Reject remote, shared, staging, Railway, production, non-loopback, or pre-populated databases. Do not start Docker, pull images, access a registry, or access application/provider internet services.

## Validation contract

The validation script and integration test must prove, with the resolved connection metadata, that the database is empty before migration, PostgreSQL major version is 16, the migration status is coherent, and deployment targets only the disposable database. Run Prisma validate and generate. Compare schema and migration intent, scan SQL for destructive statements, and verify tables, indexes, unique constraints, foreign keys, migration idempotency, and final migration status.

## Durable security evidence

The PostgreSQL integration suite must use new Prisma clients and restart-equivalent repository boundaries to prove that application scopes persist; credential and token authentication persist; credential revoke cascades to tokens; application disable cascades to credentials and tokens; sessions persist; logout/revoke persists; exactly one concurrent challenge verification succeeds; invalid challenge attempts persist and lock on attempt three; daily quota increments atomically under concurrency and survives a new Prisma client; audit events persist and remain recursively redacted; store failure maps to generic 503; external and website-session credential classes remain isolated; and `/api/internal` remains inaccessible.

The suite must also retain the existing focused security tests and full API regression. API, Web, and root typecheck/build, `git diff --check`, and exact changed-path allowlisting are required.

## Completion facts

Successful completion records:

```text
migration_applied=true
database_connected=true
database_scope=isolated_disposable_local_postgresql_16
external_network_accessed=false
registry_accessed=false
deployment_performed=false
production_acceptance=false
production_database_accessed=false
shared_database_accessed=false
```

Applying a migration to this disposable local database is not production success. Any unmet local PostgreSQL prerequisite stops with `LOCAL_POSTGRES_16_REQUIRED`.
