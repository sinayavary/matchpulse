# FREE-ACCESS-SECURITY-A-v3 implementation contract

## Mission

Implement the complete v3 architecture: free off-chain Solana wallet identity, signed-message BFF session, free developer applications, a one-time client secret, opaque 600-second `client_credentials` tokens, read-only default-deny scopes, rate/quota/concurrency, rotation/revocation, audit redaction, exact CORS/Origin/CSRF boundaries, and the required Developer Dashboard and Documentation Portal. Never implement transaction, wallet-asset authorization, balances, tokens/NFTs, fees, payment, billing, plans, subscriptions, paywalls, refresh tokens, private-key/seed handling, raw-provider exposure, or external access to `/api/internal/*`.

## File mapping

| Target | Required responsibility |
| --- | --- |
| `apps/api/package.json` | Move the existing `tweetnacl` `^1.0.3` declaration from `devDependencies` to `dependencies` for runtime availability; do not change its version or add another crypto package. |
| `apps/api/src/security/free-access-contract.ts` | Fixed public contract, formats, scopes, limits, environment and safe errors. |
| `apps/api/src/security/security-crypto.ts` | Randomness, base64url, scrypt, hashes/HMAC and timing-safe malformed-input rejection. |
| `apps/api/src/security/wallet-auth.ts` | Five-minute canonical challenge, exact binding checks, three attempts and Ed25519 verification. |
| `apps/api/src/security/wallet-auth-store.ts` | Challenge/user persistence, atomic consumption, bounded attempts and cleanup. |
| `apps/api/src/security/web-session.ts` | Hashed session/CSRF, expiry, cap, revocation and coalesced activity. |
| `apps/api/src/security/api-client-auth.ts` | Ownership, application/credential caps, one-time scrypt secret, rotation/revocation and opaque token issuance. |
| `apps/api/src/security/api-access-boundary.ts` | Bearer/session selection, default-deny scope map, ownership and internal isolation. |
| `apps/api/src/security/api-rate-limit.ts` | Bounded local buckets/concurrency and durable quota windows with 429/503 fail-closed behavior. |
| `apps/api/src/security/security-audit.ts` | Security event contract and recursive private-value redaction. |
| `apps/api/src/security/security-routes.ts` | Wallet, session, token and developer-management routes with generic safe failures. |
| `apps/api/src/security/free-access-security.test.ts` | Crypto, wallet, session, client, quota, redaction and forbidden-behavior coverage. |
| `apps/api/src/security/api-access-boundary.test.ts` | Exemptions, scopes, isolation and auth-before-provider tests. |
| `apps/api/src/security/security-routes.test.ts` | Route/BFF security behavior tests. |
| `apps/api/src/server.ts` | Body limit, redacted logging, request ID, exact CORS, registration order and safe errors. |
| `apps/web/app/login/page.tsx` | Connect/signMessage-only login using exact UTF-8 challenge bytes and safe same-origin return. |
| `apps/web/app/developers/page.tsx` | Session-protected free Developer Dashboard. |
| `apps/web/app/developers/docs/page.tsx` | Developer portal: Quick Start, scopes, tokens, quotas, errors, rotation/revoke, examples and safe Try It. |
| `apps/web/app/api/auth/wallet/challenge/route.ts` | Same-origin BFF challenge. |
| `apps/web/app/api/auth/wallet/verify/route.ts` | Same-origin BFF verify and host-only cookies. |
| `apps/web/app/api/auth/session/route.ts` | Same-origin session inspection. |
| `apps/web/app/api/auth/logout/route.ts` | Idempotent CSRF-protected logout. |
| `apps/web/app/api/bff/public/[...segments]/route.ts` | Fixed-origin, GET-only, header/path/query allowlisted public proxy. |
| `apps/web/app/api/developer/applications/route.ts` | Owned list/create with session and CSRF. |
| `apps/web/app/api/developer/applications/[applicationId]/disable/route.ts` | Owned disable with same 404 for missing/foreign. |
| `apps/web/app/api/developer/applications/[applicationId]/credentials/route.ts` | Owned one-time credential creation/rotation. |
| `apps/web/app/api/developer/applications/[applicationId]/credentials/[credentialId]/revoke/route.ts` | Owned credential revocation. |
| `apps/web/app/api/developer/applications/[applicationId]/usage/route.ts` | Owned public-safe quota/usage view. |
| `apps/web/components/auth/WalletLogin.tsx` | Wallet-only, non-transactional sign-in UI. |
| `apps/web/components/developers/ApiApplicationsPanel.tsx` | One-time secret warning; scopes, usage, rotation and revocation without browser secret persistence. |
| `apps/web/lib/auth-api.ts` | Same-origin auth client. |
| `apps/web/lib/backend-auth-proxy.ts` | Fixed backend origin and safe forwarding. |
| `apps/web/lib/public-api.ts` | Same-origin BFF public data access. |
| `apps/web/middleware.ts` | Unauthenticated navigation redirect while API remains authoritative. |
| `docs/api/free-access-api-v1.openapi.yaml` | Public token/scopes/routes/errors/request IDs/Retry-After contract. |
| `docs/security/free-access-operations-runbook.md` | Configuration, redaction, incident/revocation, rollback and no-production-change guidance. |
| `prisma/schema.prisma` | Exact nine security models/enums; no sports-data rewrite or payment fields. |
| `prisma/migrations/20260718190000_free_access_security/migration.sql` | Create-only PostgreSQL source matching schema; never apply. |
| `pnpm-lock.yaml` | Update only the API importer classification for the already-locked `tweetnacl` version using offline lockfile-only resolution; no registry or application-network access. |

## Route, scope, and negative contract

Use wallet routes `POST /api/auth/wallet/challenge` and `POST /api/auth/wallet/verify`, `GET /api/auth/session`, `POST /api/auth/logout`, and form-encoded Basic-auth `POST /oauth/token`. Developer management provides list/create, disable, credential create/revoke, and usage. Writes require session, CSRF, exact origin, and ownership; missing and foreign objects share 404 behavior. External scopes are exactly `matches:read`, `events:read`, `scenarios:read`, `historical:read`, `verification:read`, and `stream:read`. Health/status, wallet routes, and token exchange are the sole exemptions. Unmapped external paths fail `SCOPE_MAPPING_MISSING`.

Canonical limits are health/status 60/min/IP; challenge/verify 10/10m/IP and 5/10m/wallet; token 40/min/IP and 20/min/client; web 120/min/session, burst 30, concurrency 8; API 300/min/application, burst 60, concurrency 16; 50,000/day/application; historical 30/min/principal with 31-day/100-record cap; SSE 5/principal and 20/IP; 64 KiB body; 1 MiB response; list 100; URL 8 KiB. Never use unbounded maps, arbitrary proxy destinations, wildcard credentialed CORS, raw secret persistence, secret URLs, a refresh token, external internal-route access, leaked logs/audits, fabricated data, or destructive data changes.

## Required evidence and operational prohibition

Run every manifest command, record actual counts, verify schema/migration equivalence, exact changed paths and `git diff --check`. Focused tests must cover signature/message binding, replay/attempt cap, session/CSRF/origin, client secret/tokens/scopes, boundary ordering/internal isolation, rate/quota/concurrency, recursive redaction, BFF behavior, and Developer Portal behavior. Completion must state `migration_applied=false`, `network_accessed=false`, `deployment_performed=false`, `database_connected=false`, no secret acquisition, and no fabricated data.

Source schema edits, SQL migration source creation, and local Prisma format/validate/generate are permitted only after the phase is actively executed. Dependency resolution must use offline mode; `registry_accessed=false` and `network_accessed=false` are required. `migrate_dev`, `migrate_deploy`, `migrate_reset`, `db_push`, all database connections, migration application, production/application network, Railway, deployment, and secret access are forbidden. This governance transition does not execute the contract.
