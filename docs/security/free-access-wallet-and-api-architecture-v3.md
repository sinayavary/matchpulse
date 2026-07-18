# MatchPulse free-access wallet identity and Developer API architecture v3

## Product boundary

MatchPulse access is free for every website user and Developer API consumer. A Solana wallet is **off-chain identity only**: users sign a message to prove control of an address. The product must never request or store a seed phrase or private key, submit a transaction, request an approval, authorize wallet assets, require a balance/token/NFT, or implement transfer, fee, deposit, payout, billing, plan, subscription, entitlement, or paywall behavior.

Website users authenticate through a signed-message BFF session. A signed-in user may create a free developer application, receive a public `client_id` and one-time `client_secret`, and exchange `client_credentials` for a short-lived opaque access token. There is no refresh token. External scopes are read-only and default-deny. Existing internal service identity and `/api/internal/*` remain wholly separate from external credentials.

## Trust boundary and security contract

```text
Browser -> Next BFF -> MatchPulse API -> security persistence
Developer server -> token endpoint -> opaque bearer token -> protected public data
Internal worker/operator -> existing service identity -> /api/internal/*
```

The browser receives neither provider credentials nor internal credentials. Public responses and logs must not disclose raw provider payloads, secrets, tokens, signatures, formulas, weights, thresholds, private lineage, or model internals. Authenticate, authorize, and enforce quota before provider or expensive service work. Every malformed, missing, revoked, suspended, expired, foreign, or unmapped request fails closed.

## Wallet, session, BFF, and browser rules

`POST /api/auth/wallet/challenge` validates a 32-byte base58 Solana address and returns a canonical CAIP-122-style, 5-minute challenge bound to configured domain, URI, chain, request ID, issue/expiry time, and `urn:matchpulse:web`. Its fixed statement says that the request is off-chain and neither creates a transaction nor grants wallet-asset access. Store only nonce/message hashes; permit at most three verification attempts.

`POST /api/auth/wallet/verify` requires the exact message and a 64-byte detached Ed25519 signature, verifies all bindings and atomically consumes the challenge. Failures are generic `WALLET_AUTH_FAILED`. Sessions persist only token/CSRF hashes and HMAC-pseudonymous IP/user-agent data; use 12-hour idle, 7-day absolute expiry, a five-session maximum, revocation, and coalesced last-seen writes.

Use `__Host-mp_session` (Secure, HttpOnly, Lax, Path=/) and `__Host-mp_csrf` (Secure, Strict, Path=/). Unsafe BFF actions require session, same allowed Origin/Referer, matching CSRF cookie/header, and a server-side CSRF hash. BFF public proxying is GET-only to a fixed API origin and fixed public path family; forward only allowlisted safe headers, never browser authorization/cookies/origin/internal headers, strip backend cookies/internal headers, and clear invalid session cookies on 401. `/login` signs exact UTF-8 challenge bytes and must never invoke a wallet transaction. `/developers` and `/developers/docs` are required and must explain free fair-use access without exposing private material.

## Credentials, tokens, scopes, and limits

Generate random 32-byte secrets; persist only scrypt hashes (`N=16384,r=8,p=1`, 32-byte digest, 16-byte salt) and compare timing-safely. Use opaque formats `mp_client_*`, `mp_secret_*`, and `mp_access_*`; a secret is returned only on issuance and is never logged, persisted raw, or accepted in a URL. Applications are owned by a wallet user, limited to five enabled applications and two active credentials; credentials expire after 90 days, rotation overlaps for 24 hours, and revocation is immediate.

`POST /oauth/token` accepts HTTPS form data and HTTP Basic client authentication only, with `grant_type=client_credentials` and an optional requested subset. It returns an opaque Bearer token with `expires_in=600`, `Cache-Control: no-store`, and no refresh token. Failures are only generic `invalid_client` or `invalid_scope`.

The only external scopes are `matches:read`, `events:read`, `scenarios:read`, `historical:read`, `verification:read`, and `stream:read`. Exempt only `GET /api/health`, `GET /api/public/status`, wallet challenge/verify, and the token endpoint. All other external routes require an explicit centralized mapping; an unmapped public path returns `403 SCOPE_MAPPING_MISSING`. External credentials never authorize `/api/internal/*`.

Enforce bounded, pseudonymous, cleanup-capable rate/concurrency/quota control: health/status 60/min/IP; challenge/verify 10/10m/IP and 5/10m/wallet; token 40/min/IP and 20/min/client; website 120/min/session (burst 30, concurrency 8); API 300/min/application (burst 60, concurrency 16); 50,000/day/application; historical 30/min/principal with 31-day window and 100 records; SSE 5/principal and 20/IP; 64 KiB body; 1 MiB response; list maximum 100; URL maximum 8 KiB. Return 429 with `Retry-After`; authoritative-store failure is 503 before expensive work.

## Data model and operations

Implementation creates only the security enums `WalletUserStatus`, `ApiApplicationStatus`, `SecurityPrincipalType`, and `SecurityAuditActorType`, plus `WalletUser`, `WalletAuthChallenge`, `WebSession`, `ApiApplication`, `ApiApplicationScope`, `ApiCredential`, `ApiAccessToken`, `ApiUsageBucket`, and `SecurityAuditEvent`. They use UUID ownership, hashes/pseudonyms, status/expiry/revocation fields, restrictive relations, and indexes for owner, expiry, revocation, and usage windows. No sports-data table is removed, rewritten, or backfilled; no payment-related field exists.

Audit/log redaction recursively rejects tokens, secrets, signatures, nonces, cookies, authorization, raw IPs, provider/database credentials, raw payloads, formulas, weights, thresholds, and lineage. Configuration is explicit and fail-closed: external auth mode, minimum 32-byte security pepper, wallet domain/URI/chain, exact allowed origins, trusted proxy CIDRs, and fixed API origin. Invalid production security configuration must prevent listening without printing sensitive values.

## Delivery and safety gates

This is an implementation contract, not permission to implement during this governance transition. Its pack permits source-level schema edits, SQL migration source creation, and local Prisma format/validate/generate without a database connection. `allows_migration=false`: `migrate_dev`, `migrate_deploy`, `migrate_reset`, `db_push`, migration application, database connection/write, production or application-network access, deployment, secret acquisition, and production verification are forbidden. Required evidence includes exact allowlisted changes, focused security tests, regressions/typechecks/build, redaction and path scans, and `migration_applied=false`, `network_accessed=false`, `deployment_performed=false`.

Rollback of a future reviewed implementation is a revision revert plus credential/token revocation or application disablement per runbook; no production operation is authorized by this pack. Stop for unresolved source/security decisions, unauthorized paths, migration/database/network/secret requirements, or failed validation that needs an out-of-allowlist change.
