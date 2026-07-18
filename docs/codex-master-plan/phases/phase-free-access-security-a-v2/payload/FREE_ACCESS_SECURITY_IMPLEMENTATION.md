# FREE-ACCESS-SECURITY-A-v2 implementation contract

## 1. Mission and boundaries

Implement the complete architecture in `docs/security/free-access-wallet-and-api-architecture-v2.md`: free Solana wallet registration/login for website users; secure Next BFF and HttpOnly sessions; free developer applications and one-time secrets; client-credentials exchange with opaque 10-minute tokens; read-only default-deny scopes; rate, concurrency, daily quota, audit, rotation, revocation, CORS, redaction, and safe failures; and no billing, paid tier, wallet balance, asset ownership, or blockchain transaction.

Existing `/api/internal/*` authentication, internal service identity, public-safe mappers, TxLINE credentials, database credentials, raw provider data, weights, formulas, thresholds, private lineage, and production acceptance evidence remain outside this phase.

## 2. Exact file-by-file mapping

- `apps/api/package.json`: add only the explicitly required production crypto dependency (`tweetnacl`) and preserve existing scripts.
- `apps/api/src/security/free-access-contract.ts`: fixed product constants, scope matrix, formats, limits, environment contract, and public-safe error contracts.
- `apps/api/src/security/security-crypto.ts`: random bytes, base64url, scrypt, HMAC pseudonyms, SHA-256, timing-safe comparison, and malformed-length rejection.
- `apps/api/src/security/wallet-auth.ts`: canonical challenge, five-minute expiry, three-attempt cap, exact domain/URI/chain/request/issued/expiry checks, and Ed25519 verification.
- `apps/api/src/security/wallet-auth-store.ts`: challenge/user persistence, atomic consumption, bounded attempts, cleanup, and fail-closed store behavior.
- `apps/api/src/security/web-session.ts`: hashed session/CSRF tokens, 12-hour idle and 7-day absolute expiry, five-session cap, revocation, and coalesced last-seen writes.
- `apps/api/src/security/api-client-auth.ts`: application ownership, five-app/two-credential caps, one-time scrypt secret, 90-day expiry, 24-hour rotation overlap, revocation, and opaque 600-second tokens.
- `apps/api/src/security/api-access-boundary.ts`: bearer/session selection, default-deny route-to-scope mapping, ownership, internal-route isolation, and authentication-before-provider ordering.
- `apps/api/src/security/api-rate-limit.ts`: bounded local buckets/concurrency plus atomic durable windows, daily quota, TTL cleanup, `Retry-After`, and fail-closed 503.
- `apps/api/src/security/security-audit.ts`: event contract and recursive redaction of tokens, secrets, signatures, nonces, IPs, cookies, authorization, and credentials.
- `apps/api/src/security/security-routes.ts`: challenge, verify, session, logout, token, developer-management, and safe generic error routes.
- the three API security test files: crypto/wallet/session/client/boundary/limit/leakage/security-route coverage described below.
- `apps/api/src/server.ts`: body limit, logger redaction, request ID, exact CORS, security registration order, headers, no-store responses, and safe error mapper without breaking SSE.
- `apps/web/app/login/page.tsx`: provider connect/signMessage only, exact UTF-8 signing, BFF flow, same-origin `next`, no transaction, and safe failure states.
- `apps/web/app/developers/page.tsx`: session-protected dashboard shell and free-access guidance.
- `apps/web/app/developers/docs/page.tsx`: complete Developer Documentation Portal described in section 8.
- the four auth BFF routes: challenge, verify, session, and idempotent logout.
- `apps/web/app/api/bff/public/[...segments]/route.ts`: GET-only fixed-origin public proxy with path/query/header allowlists and 401 cookie clearing.
- developer application routes: list/create, disable, credential create, credential revoke, and usage with session/CSRF/ownership checks.
- `apps/web/components/auth/WalletLogin.tsx`: wallet-only off-chain sign-in UX.
- `apps/web/components/developers/ApiApplicationsPanel.tsx`: one-time secret warning, rotation/revocation, scopes, usage, and no browser persistence.
- `apps/web/lib/auth-api.ts`: same-origin authentication API client.
- `apps/web/lib/backend-auth-proxy.ts`: fixed backend origin and safe header forwarding.
- `apps/web/lib/public-api.ts`: same-origin BFF public data access with existing refresh behavior.
- `apps/web/middleware.ts`: redirect unauthenticated page navigation while leaving backend validation authoritative.
- `docs/api/free-access-api-v1.openapi.yaml`: token, bearer, scopes, public routes, application routes, errors, request IDs, Retry-After, and no-billing contract.
- `docs/security/free-access-operations-runbook.md`: secrets, WAF/CDN, migration pre/post checks, compromise response, revocation, cleanup, rollback, and explicit no-production-change statement.
- `prisma/schema.prisma`: exactly the nine security models/enums and fields in the architecture.
- `prisma/migrations/20260718190000_free_access_security/migration.sql`: PostgreSQL-compatible create-only migration matching schema; never apply it to production.
- `pnpm-lock.yaml`: only the required dependency resolution change.

## 3. Exact Prisma contract

Create `WalletUserStatus`, `ApiApplicationStatus`, `SecurityPrincipalType`, and `SecurityAuditActorType` with the values in the architecture. Create exactly `WalletUser`, `WalletAuthChallenge`, `WebSession`, `ApiApplication`, `ApiApplicationScope`, `ApiCredential`, `ApiAccessToken`, `ApiUsageBucket`, and `SecurityAuditEvent` with their stated UUIDs, maps, relations, indexes, unique constraints, expiry/status fields, and restrictive ownership. Never add billing, payment, plan, price, subscription, entitlement, wallet-balance, or asset fields. Never drop or rewrite existing sports-data tables or backfill data.

## 4. Exact routes and security behavior

Wallet routes are `POST /api/auth/wallet/challenge` and `POST /api/auth/wallet/verify`; session routes are `GET /api/auth/session` and `POST /api/auth/logout`. Token exchange is `POST /oauth/token` with form encoding, Basic authentication, `client_credentials`, subset scopes, generic `invalid_client`/`invalid_scope`, no refresh token, and `expires_in=600`.

Developer routes are `GET/POST /api/developer/v1/applications`, disable, credential create/revoke, and usage. Every write requires web session and CSRF; every object checks ownership and returns the same 404 for missing/foreign objects. External scopes are exactly `matches:read`, `events:read`, `scenarios:read`, `historical:read`, `verification:read`, and `stream:read`.

Exempt only `GET /api/health`, `GET /api/public/status`, wallet auth routes, and token endpoint. Unmapped public paths return 403 `SCOPE_MAPPING_MISSING`. External credentials never authorize `/api/internal/*`. Authenticate, authorize, and apply quota before any expensive provider/service call.

## 5. Exact limits and negative/security criteria

Use the architecture maxima: health/status 60/min/IP; challenge/verify 10/10m/IP and 5/10m/wallet; token 40/min/IP and 20/min/client; website 120/min/session, burst 30, concurrency 8; API 300/min/application, burst 60, concurrency 16; 50,000/day/application; historical 30/min/principal with 31-day range and 100 records; SSE 5/principal and 20/IP; 64 KiB body; 1 MiB response; list 100; URL 8 KiB. Return 429 with `Retry-After`; authoritative-store failures return 503. No unbounded maps, arbitrary proxy destination, wildcard credentialed CORS, raw secret persistence, secret in URL, refresh token, transaction method, internal external-credential access, log/audit leakage, or fabricated data is permitted.

## 6. Test mapping and completion evidence

Focused tests cover valid/invalid Solana signatures, exact message/domain/URI/chain, expiry, consumption, three-attempt cap, atomic replay, no-transaction text; session hashes/expiry/suspension/revocation/CSRF/origin/last-seen; one-time secrets, scrypt, ownership, caps, rotation/revoke, Basic parsing, token expiry/revoke, scope subset/default deny/no refresh; boundary exemptions, bearer/session access, missing scopes, internal isolation, and auth-before-provider; rate/concurrency/quota/Retry-After/cleanup/durable buckets/fail-closed; recursive leakage redaction; BFF headers/cookie/CSRF/redirect/public refresh; and Developer Portal behavior.

Run every command in `manifest.json`, record actual counts, verify schema/migration equivalence, exact allowlisted paths, `git diff --check`, and no production action. Completion metadata must explicitly report `migration_applied=false`, `network_accessed=false`, no deployment, no secret acquisition, no fabricated data, and the exact changed paths. Required stop codes include `MISSING_SOURCE`, `HUMAN_APPROVAL_REQUIRED`, `MIGRATION_APPROVAL_REQUIRED`, `NETWORK_ACCESS_REQUIRED`, `SECRET_REQUIRED`, `UNAUTHORIZED_FILE_REQUIRED`, `TEST_FAILURE`, `TYPECHECK_FAILURE`, and `WORKSPACE_COLLISION`.

## 7. Migration and rollback policy

The migration file may be created, formatted, validated, and generated against a local schema only after the human gate. Manifest policy is fail-closed: `allows_migration=false`; schema edit, SQL creation, Prisma format/validate/generate are allowed only in the implementation phase; `migrate_dev`, `migrate_deploy`, `migrate_reset`, `db_push`, database connections, and production application are forbidden. Completion must say `migration_applied=false`. Rollback is application revision rollback plus immediate credential/token revocation and application disablement according to the runbook; no production rollback is authorized here.

## 8. Developer Documentation Portal

Implement `/developers` and `/developers/docs` with Quick Start, wallet sign-in, application creation, one-time secret handling, token exchange, exact scopes, rate limits/quotas, pagination, error codes, rotation/revoke, OpenAPI reference, curl/PowerShell/TypeScript/Python examples, dashboard, versioning, changelog, deprecation, security guidance, and safe authenticated Try It. Never show internal routes, secrets, raw provider data, private fields, formulas, or model internals.

Do not execute this contract during governance review. Do not access production, Railway, secrets, network, or database. Do not change or merge any other pull request.
