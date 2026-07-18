# FREE-ACCESS-SECURITY-A-v2

Baseline: `df9d8cfd7d8076f6ffc2924823ee9b78c4e4cb74`.

This is a governance transition and implementation pack for free off-chain wallet identity, secure free developer API access, and the Developer Documentation Portal. It does not declare the paused production acceptance phase successful. It does not permit production network access, deployment, Railway changes, secrets, migration application, database writes, fabricated data, or direct PR #34 merge/rebase/force-update.

Human gates cover wallet/public API identity, authentication boundaries, Prisma schema/development migration, and dependency/lockfile changes. The implementation phase may create and validate a migration only; it must never apply it to production. The exact allowlist and validation commands are authoritative in `manifest.json`.

Required governance checks are JSON/schema validation, active queue consistency, current baseline ancestry, pack identity, exact allowlist, SHA-256, stale baseline and acceptance-reference scans, AGENTS rule consistency, documentation portal scope, `git diff --check`, and exact changed-path review. This transition itself performs no runtime implementation or migration.
