# FREE-ACCESS-SECURITY-A-v3

## Identity

- Phase: `FREE-ACCESS-SECURITY-A`
- Pack: `FREE-ACCESS-SECURITY-A-v3`
- Baseline: `7d99b1d59f1c5811943553cb4226cf05e62fac7a`
- State: `ready`; human approval is recorded by `ACTIVE_PHASE.json`.

This self-contained pack defines the complete future implementation contract. It neither depends on nor references an earlier branch or pull request. All MatchPulse capabilities remain free. Wallet signing is off-chain identity only; transactions, asset authorization, balances, tokens/NFTs, fees, billing, plans, subscriptions, deposits, payouts, paywalls, private keys, and seed phrases are forbidden.

## Exact implementation boundary

The 39 sorted, unique manifest targets are the sole permitted implementation files. They cover API security primitives; wallet challenge/verify; sessions; application credentials; opaque tokens; rate/quota; audit redaction; centralized external boundary; server registration; security tests; login; Developer Dashboard; Developer Documentation Portal; BFF routes; middleware; Web auth components/libraries; OpenAPI; operations runbook; Prisma schema; migration SQL source; package and lockfile. `/developers` and `/developers/docs` are required deliverables.

The architecture and payload are authoritative for off-chain wallet authentication, HttpOnly BFF sessions, one-time client secrets, `client_credentials`, 600-second opaque tokens, no refresh token, read-only scopes, default-deny route mapping, internal isolation, fail-closed CSRF/Origin/CORS, redaction, quotas, rotation, revocation, and rollback. No external or internal public response may disclose raw provider data, credentials, formulas, weights, thresholds, or private lineage.

## Migration and network policy

`allows_migration=false` is fail-closed: source schema edits, SQL-source creation, and local Prisma format/validate/generate are allowed only during the future approved implementation; migration apply, database connection/write, `migrate_dev`, `migrate_deploy`, `migrate_reset`, and `db_push` are forbidden. `allows_network=false`; production, application network, Railway, deployment, and secret access are forbidden. Expected evidence is `migration_applied=false`, `network_accessed=false`, and no deployment.

## Validation and rollback

The future implementer must run every manifest validation, verify the active/queue identity and baseline, exact allowlist and payload mapping, architecture/secret/forbidden-field scans, and exact changed paths. A reviewed revert is the only code rollback; operational remediation revokes affected credentials/tokens and disables compromised applications. Stop rather than invent security, product, schema, route, scope, quota, TTL, or public-contract decisions.
