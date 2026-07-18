# FREE-ACCESS-SECURITY-A-v4 implementation payload

This payload is an implementation contract, not permission to implement during governance preparation. Every target in the manifest is mapped below. Preserve existing Matches behavior and public-safe contracts; extend compatible transport only. All malformed, missing, expired, revoked, foreign, unmapped, unauthorized, or security-store-failure cases fail closed. Tests must cover positive behavior, negative authorization, redaction, CSRF/Origin/CORS, quota, rotation/revocation, internal isolation, and rollback evidence.

## Exact target mapping

| Target | Responsibility and required evidence |
|---|---|
| `apps/api/package.json` | Move existing `tweetnacl ^1.0.3` from devDependencies to dependencies without changing version; offline lockfile evidence only. |
| `apps/api/src/security/api-access-boundary.test.ts` | Test centralized external scope mapping, default deny, internal isolation, limits, and sanitized errors. |
| `apps/api/src/security/api-access-boundary.ts` | Authenticate and authorize external read-only routes before provider/expensive work; reject `/api/internal/*`. |
| `apps/api/src/security/api-client-auth.ts` | Implement Basic/form `client_credentials`, one-time verifier use, 600-second opaque tokens, expiry/revocation. |
| `apps/api/src/security/api-rate-limit.ts` | Enforce bounded IP/session/application quotas, concurrency, payload/response limits, 429/503 fail-closed behavior. |
| `apps/api/src/security/free-access-contract.ts` | Define public scopes, DTO-safe contracts, generic errors, and free/no-payment boundary. |
| `apps/api/src/security/free-access-security.test.ts` | Cover wallet, secret, token, scope, redaction, quota, CSRF, and forbidden product behavior. |
| `apps/api/src/security/security-audit.ts` | Produce redacted audit events; reject secrets, tokens, signatures, provider payloads, formulas, weights, thresholds, and lineage. |
| `apps/api/src/security/security-crypto.ts` | Use random secrets, scrypt verifiers, timing-safe comparison, hashes, and pseudonyms; never persist raw credentials. |
| `apps/api/src/security/security-routes.test.ts` | Test challenge/verify, token, application lifecycle, generic failures, and route isolation. |
| `apps/api/src/security/security-routes.ts` | Register wallet, session, token, application, credential, and usage endpoints with explicit authorization. |
| `apps/api/src/security/wallet-auth-store.ts` | Persist only challenge/session hashes and bounded revocation/expiry state; no DB/network access is authorized here. |
| `apps/api/src/security/wallet-auth.ts` | Validate canonical five-minute off-chain challenge and detached Ed25519 signature; consume atomically and fail generically. |
| `apps/api/src/security/web-session.ts` | Secure HttpOnly session, CSRF hash, origin binding, idle/absolute expiry, five-session cap, revocation. |
| `apps/api/src/server.ts` | Wire the security boundary without weakening current Matches routes or exposing internal/provider data. |
| `apps/web/app/api/auth/logout/route.ts` | Revoke/clear website session safely; no secret leakage. |
| `apps/web/app/api/auth/session/route.ts` | Return only public session identity and safe status. |
| `apps/web/app/api/auth/wallet/challenge/route.ts` | Same-origin challenge BFF endpoint; no transaction or wallet-asset authorization. |
| `apps/web/app/api/auth/wallet/verify/route.ts` | Verify exact signed bytes through backend proxy and establish secure session. |
| `apps/web/app/api/bff/public/[...segments]/route.ts` | GET-only fixed-origin public proxy; allowlist paths/headers and strip browser/internal/backend credentials. |
| `apps/web/app/api/developer/applications/[applicationId]/credentials/[credentialId]/revoke/route.ts` | CSRF/origin-protected credential revocation. |
| `apps/web/app/api/developer/applications/[applicationId]/credentials/route.ts` | Issue/rotate one-time secret; display raw secret exactly once. |
| `apps/web/app/api/developer/applications/[applicationId]/disable/route.ts` | CSRF/origin-protected application disablement. |
| `apps/web/app/api/developer/applications/[applicationId]/usage/route.ts` | Return redacted usage/quota diagnostics only. |
| `apps/web/app/api/developer/applications/route.ts` | Free application CRUD with ownership, five-app/two-credential bounds, and safe DTOs. |
| `apps/web/app/developers/docs/page.tsx` | Public documentation for free read-only API, scopes, 600-second tokens, limits, and security boundaries. |
| `apps/web/app/developers/page.tsx` | Dashboard entry and fair-use explanation; never require payment or wallet assets. |
| `apps/web/app/login/page.tsx` | Wallet-signature login UX only; explicitly no transaction, fee, private key, or seed phrase. |
| `apps/web/components/auth/WalletLogin.tsx` | Sign exact UTF-8 challenge bytes and handle generic failure safely. |
| `apps/web/components/developers/ApiApplicationsPanel.tsx` | Safe application/credential lifecycle UI; never retain or log one-time secrets. |
| `apps/web/lib/auth-api.ts` | Typed same-origin auth calls, CSRF handling, and sanitized errors. |
| `apps/web/lib/backend-auth-proxy.ts` | Fixed backend origin and allowlisted headers; no raw provider/private-model forwarding. |
| `apps/web/lib/public-api.ts` | Preserve all current Matches catalog fields, `catalog_identity`, pagination diagnostics, date/calendar behavior and public-safe DTO compatibility while routing browser requests through the authenticated same-origin BFF. |
| `apps/web/middleware.ts` | Enforce safe session/CSRF/origin policy and prevent external credential access to internal paths. |
| `docs/api/free-access-api-v1.openapi.yaml` | Document only public read-only scopes, auth formats, safe DTOs, generic errors, limits, and no-payment boundary. |
| `docs/security/free-access-operations-runbook.md` | Redacted audit, rotation/revocation, disablement, rollback, migration gate, and incident procedures. |
| `pnpm-lock.yaml` | Offline-only importer classification update; `registry_accessed=false`, `network_accessed=false`; retain tweetnacl version. |
| `prisma/migrations/20260718190000_free_access_security/migration.sql` | Source-only security tables/enums; no apply, DB connection, sports-data rewrite, payment fields, or fabricated evidence. |
| `prisma/schema.prisma` | Source-only wallet/session/application/credential/token/quota/audit model with restrictive relations and expiry/revocation indexes. |

## Fixed security contract

Access is free. Wallet signatures are off-chain identity only. No transaction, fee, token, NFT, balance, payment, billing, subscription, paywall, private key, or seed phrase. External scopes are `matches:read`, `events:read`, `scenarios:read`, `historical:read`, `verification:read`, and `stream:read`; mapping is centralized and default-deny. Tokens are opaque, expire after 600 seconds, and have no refresh token. Internal service identity and `/api/internal/*` are isolated.

## Required evidence and rollback

Run only the manifest checks during the authorized implementation. Record exact changed paths, public-contract/secret scans, focused and regression test results, and `migration_applied=false`, `database_connected=false`, `registry_accessed=false`, `network_accessed=false`, `deployment_performed=false`, `production_acceptance=false`. Rollback is a reviewed revert plus credential/token revocation or application disablement. No migration, DB, application network, deployment, secret, or production acceptance is permitted by this pack.
