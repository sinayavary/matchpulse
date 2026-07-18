# Isolated local PostgreSQL validation plan

This plan governs successor phase `FREE-ACCESS-LOCAL-DB-VALIDATION-A-v1` from baseline `2fc45285a5e39c48f4a1e6ed7d97f0e70b8f8256`. It validates the completed Free Access security migration and durable repositories before any Docker release or production deployment.

The validation boundary is strict: a disposable, empty PostgreSQL 16 database on loopback only, with a name beginning `matchpulse_free_access_validation_`. No remote or shared database, Railway, production or staging system, non-loopback address, registry, image pull, provider/application internet access, deployment, acceptance, or secret discovery is permitted.

The run must prove safe migration status and idempotency, schema/migration equivalence, non-destructive SQL, relational constraints, persistence across Prisma client boundaries, concurrency guarantees, cascade behavior, session and challenge durability, quota atomicity, recursive audit redaction, generic store-failure handling, and separation of external credentials from website sessions and internal routes. All required focused and regression checks must pass, with an exact manifest allowlist.

The phase is a human-gated validation phase. If local PostgreSQL 16 is unavailable or its scope cannot be proven, stop with `LOCAL_POSTGRES_16_REQUIRED`. A successful disposable migration must be reported as validation evidence, never as production acceptance.
