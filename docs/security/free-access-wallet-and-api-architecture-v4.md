# MatchPulse free-access wallet identity and Developer API architecture v4

## Product and trust boundary

Access is free. A wallet is only an off-chain identity: the browser signs a canonical challenge and never submits a transaction, authorizes assets, requires a balance/token/NFT, or exposes a private key or seed phrase. The boundary is `Browser -> same-origin Next BFF -> MatchPulse API`; developer servers use `client_credentials` and opaque bearer tokens; workers and operators remain isolated behind existing internal identity and `/api/internal/*`.

## Authentication and authorization

Challenges are domain/URI/chain/request bound, expire after five minutes, store only nonce/message hashes, and allow at most three attempts. Verification requires the exact message and detached Ed25519 signature, atomically consumes the challenge, and returns only a generic failure. Website sessions use Secure HttpOnly `__Host-` cookies, CSRF binding, origin checks, idle/absolute expiry, revocation, and bounded session count.

Applications are free. A one-time client secret is generated randomly, stored only as a salted scrypt verifier, and never logged or accepted in URLs. `client_credentials` accepts HTTPS form data and HTTP Basic authentication, issues an opaque token for 600 seconds, has no refresh token, and supports only read-only scopes. Authorization is default-deny with centralized path mapping; unmapped routes fail closed. External credentials can never access `/api/internal/*`.

## Limits, privacy, and compatibility

Rate, quota, body/response, concurrency, historical-window, and SSE limits are bounded and return `429` with `Retry-After`; security-store failure returns `503` before expensive work. CSRF, Origin, CORS, rotation, revocation, and configuration checks fail closed. Logs and public responses redact secrets, tokens, signatures, cookies, provider payloads, credentials, raw IPs, formulas, weights, thresholds, and private lineage.

The BFF and `apps/web/lib/public-api.ts` must preserve all current Matches catalog fields, `catalog_identity`, pagination diagnostics, date/calendar behavior, current DTO additions, public-safe fields, and Matches Browser behavior while routing browser requests through the authenticated same-origin BFF. `/developers` and `/developers/docs` are required and must explain free fair-use access without private material.

## Data and operational gate

Future source changes may add only the security persistence model and its migration source from the manifest; no sports-data table is removed or backfilled and no payment field is introduced. `allows_migration=false` means no migration application, DB connection/write, `migrate_dev`, `migrate_deploy`, `migrate_reset`, or `db_push`. `allows_network=false` means no registry, application, production, Railway, deployment, or secret access. Required evidence remains `migration_applied=false`, `database_connected=false`, `registry_accessed=false`, `network_accessed=false`, `deployment_performed=false`, and `production_acceptance=false`.
