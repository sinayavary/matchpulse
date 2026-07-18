# FREE-ACCESS-SECURITY-A-v2

## Identity and boundary

- Phase: `FREE-ACCESS-SECURITY-A`
- Pack: `FREE-ACCESS-SECURITY-A-v2`
- Baseline: `df9d8cfd7d8076f6ffc2924823ee9b78c4e4cb74`
- State: `ready`, with explicit human approval for the wallet/public API/database contract.

This pack is self-contained. Its architecture and payload contain the complete product, security, data-model, route, documentation, validation, rollback, and stop-code contract. No other branch, pull request, or external source is required to execute it.

## Product and security contract

All access is free. Website users authenticate only with an off-chain Solana wallet signature. A wallet is identity/authentication only. Transactions, transfers, approvals, fees, balance requirements, token/NFT holding, deposits, payouts, billing, subscriptions, plans, paywalls, seed phrases, and private-key requests or storage are forbidden.

Developers establish a wallet session, create a free application, receive a public client ID and one-time client secret, and use client credentials for a short-lived opaque access token. No refresh token is used. External scopes are read-only, fair-use limited, revocable, and default-deny. Internal service identity and `/api/internal/*` remain completely separate.

## Exact implementation map

The manifest allowlist maps every implementation responsibility: API security primitives, wallet challenge/verification, session and CSRF handling, developer application/credential/token routes, public authorization boundary, rate/quota controls, audit redaction, Fastify registration, Next wallet login, Developer Dashboard, `/developers/docs`, BFF routes, public API client, middleware, OpenAPI, operations runbook, Prisma models/migration, tests, package dependency, and lockfile. No file outside the 39 sorted unique paths may change.

## Migration and network policy

The implementation may create and format/validate/generate Prisma schema artifacts only under the allowlist and human gate. `allows_migration=false` is fail-closed for migration execution: `migrate_dev`, `migrate_deploy`, `migrate_reset`, `db_push`, production database connection, and applying any migration are forbidden. The expected completion evidence is `migration_applied=false`. `allows_network=false`; production, Railway, secrets, deployment, and external network access are forbidden.

## Human gates and acceptance

Human review is required for the wallet identity/public contract, authentication boundary, Prisma schema and development migration, and dependency/lockfile changes. Required validation covers JSON/schema, active/queue consistency, current baseline ancestry, pack identity, exact sorted allowlist and count, `/developers/docs` presence, migration-policy consistency, secret redaction, stale-baseline scans, SHA-256, `git diff --check`, exact paths, focused security tests, API regression, typecheck, web build, workspace checks, and no production change.

## Rollback and stop codes

Rollback is a reviewed revert of the single implementation or governance commit; operational rollback revokes affected credentials/tokens and disables compromised applications according to the runbook. Stop immediately with `MISSING_SOURCE`, `HUMAN_APPROVAL_REQUIRED`, `MIGRATION_APPROVAL_REQUIRED`, `NETWORK_ACCESS_REQUIRED`, `SECRET_REQUIRED`, `UNAUTHORIZED_FILE_REQUIRED`, `TEST_FAILURE`, `TYPECHECK_FAILURE`, or `WORKSPACE_COLLISION` when applicable. Do not invent algorithms, TTLs, routes, fields, scopes, quotas, or security choices beyond this contract.
