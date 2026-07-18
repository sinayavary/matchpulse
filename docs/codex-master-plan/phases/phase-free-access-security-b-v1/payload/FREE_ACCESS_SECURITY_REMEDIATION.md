# FREE-ACCESS-SECURITY-B remediation payload

This payload is the implementation map for the 40 allowlisted targets. It is a contract for a separately authorized implementation run; no implementation is performed by this governance transition.

## API security and persistence

- `apps/api/package.json` — preserve existing dependencies; expose the focused B security test command only.
- `apps/api/src/public-api.test.ts` — add actual public route inventory, DTO compatibility, and default-deny regression evidence.
- `apps/api/src/security/api-access-boundary.test.ts` — test exact public/internal route and credential boundaries.
- `apps/api/src/security/api-access-boundary.ts` — implement centralized exact route mapping and fail-closed authorization.
- `apps/api/src/security/api-client-auth.ts` — enforce exact scopes, rejection of unauthorized scope requests, token expiry, and revocation cascade.
- `apps/api/src/security/api-rate-limit.ts` — implement bounded cleanup, durable quota integration, concurrency, body, response, history, and SSE limits.
- `apps/api/src/security/free-access-contract.ts` — define the v5 public-safe contracts without private fields or paid behavior.
- `apps/api/src/security/free-access-security.test.ts` — cover wallet binding, persistence failure, limits, audit redaction, and forbidden behavior.
- `apps/api/src/security/security-audit.ts` — persist redacted audit records and fail closed on store failure.
- `apps/api/src/security/security-crypto.ts` — hash-only credential/challenge/session handling and constant-time verification.
- `apps/api/src/security/security-routes.test.ts` — Fastify injection coverage for actual public, internal, auth, and error routes.
- `apps/api/src/security/security-routes.ts` — enforce auth-before-provider/DB work, generic errors, CSRF, Origin, and ownership.
- `apps/api/src/security/wallet-auth-store.ts` — interface and Prisma-backed store; injected in-memory test double only.
- `apps/api/src/security/wallet-auth.ts` — domain/URI/chain/nonce/request binding, attempt increment, and atomic consume.
- `apps/api/src/security/web-session.ts` — `__Host-mp_session`, expiry, five-session cap, hash-only storage, and revocation.
- `apps/api/src/server.ts` — wire authoritative stores, exact routes, fail-closed startup/runtime behavior, and explicit CORS.

## Web auth and developer BFF

- `apps/web/app/api/auth/logout/route.ts` — proxy authoritative logout with session, CSRF, and Origin enforcement.
- `apps/web/app/api/auth/session/route.ts` — proxy backend-validated session state; never fabricate identity.
- `apps/web/app/api/auth/wallet/challenge/route.ts` — proxy the bound challenge contract.
- `apps/web/app/api/auth/wallet/verify/route.ts` — proxy verification and cookie issuance from backend authority.
- `apps/web/app/api/bff/public/[...segments]/route.ts` — exact public path/query/header allowlists, fixed server origin, timeout, and response-size limits.
- `apps/web/app/api/developer/applications/[applicationId]/credentials/[credentialId]/revoke/route.ts` — proxy ownership-checked revoke and token cascade.
- `apps/web/app/api/developer/applications/[applicationId]/credentials/route.ts` — proxy authoritative credential rotation and one-time secret response.
- `apps/web/app/api/developer/applications/[applicationId]/disable/route.ts` — proxy ownership-checked disable and cascade.
- `apps/web/app/api/developer/applications/[applicationId]/usage/route.ts` — proxy authoritative usage/quota state.
- `apps/web/app/api/developer/applications/route.ts` — proxy create/list operations without random fabricated state.
- `apps/web/app/developers/docs/page.tsx` — document the v5 contract and forbidden/allowed behavior accurately.
- `apps/web/app/developers/page.tsx` — expose authoritative dashboard state and generic errors only.
- `apps/web/app/login/page.tsx` — provide the real wallet connect/signMessage flow and safe failure state.
- `apps/web/components/auth/WalletLogin.tsx` — call wallet provider connect/signMessage with canonical challenge binding.
- `apps/web/components/developers/ApiApplicationsPanel.tsx` — use real application/credential/revoke/disable/usage operations.
- `apps/web/lib/auth-api.ts` — centralize same-origin auth requests with safe error handling and no secret logging.
- `apps/web/lib/backend-auth-proxy.ts` — use server-only fixed backend origin; never expose arbitrary destinations.
- `apps/web/lib/public-api.ts` — preserve Matches DTO compatibility while applying the exact public boundary contract.
- `apps/web/middleware.ts` — enforce session/CSRF/Origin policy without accepting `x-mp-session`.

## Contracts, migration, and documentation

- `docs/api/free-access-api-v1.openapi.yaml` — document actual public routes, exact scopes, generic errors, and safe DTOs.
- `docs/security/free-access-operations-runbook.md` — document durable stores, fail-closed operation, revocation, audit redaction, and forbidden production operations.
- `pnpm-lock.yaml` — change only for a real existing importer adjustment; no new dependency or online resolution.
- `prisma/migrations/20260718190000_free_access_security/migration.sql` — edit only when schema-to-SQL equivalence requires it; never apply it in this phase.
- `prisma/schema.prisma` — define durable application, credential, token, session, challenge, quota, and audit state without connecting to a database.

## Cross-target completion requirements

The implementation must include actual route injection, wallet challenge, session, CSRF/Origin/Referer, CORS, BFF, ownership, cascade, persistence failure, rate/quota, audit redaction, restart/repository, and Matches compatibility evidence. No test count is prescribed. No transaction, payment, paywall, token/NFT, private-key, deployment, production acceptance, database connection, migration apply, or application/registry network may occur.
