# FREE-ACCESS-SECURITY-A Implementation Contract

## 1. Mission

Implement the canonical architecture in:

`docs/security/free-access-wallet-and-api-architecture.md`

The implementation must provide:

- free Solana-wallet registration/login for website users;
- a secure Next.js BFF and HttpOnly website sessions;
- free developer applications and one-time client secrets;
- OAuth-style client-credentials token exchange with opaque 10-minute access tokens;
- read-only scopes and default-deny route authorization;
- rate limits, concurrency limits, daily quotas, audit events, rotation, revocation, CORS hardening, log redaction, and safe failures;
- no billing, paid plan, wallet balance, token ownership, or blockchain transaction requirement.

This phase changes the public access contract and the Prisma schema. Its activation requires explicit human approval. It does not authorize deployment or a production migration.

## 2. Existing boundaries that must remain

- Existing `/api/internal/*` authentication remains independent and stronger.
- External sessions, client credentials, and access tokens must never authorize internal routes.
- Existing TxLINE credentials, internal service credentials, database credentials, raw provider data, feature weights, formulas, thresholds, and private model lineage remain server-only.
- No gambling recommendation, stake, payout, profit, trade, wallet asset permission, or financial action may be introduced.
- Existing public-safe mappers remain authoritative.
- Existing production acceptance phase is not modified by this pack.

## 3. Exact data model

Add the following Prisma enums and models. Names and semantics are fixed.

### Enums

```prisma
enum WalletUserStatus {
  ENABLED
  SUSPENDED
}

enum ApiApplicationStatus {
  ENABLED
  DISABLED
}

enum SecurityPrincipalType {
  IP
  WALLET
  SESSION
  APPLICATION
  CLIENT
}

enum SecurityAuditActorType {
  ANONYMOUS
  WALLET_USER
  WEB_SESSION
  API_APPLICATION
  API_CREDENTIAL
  SYSTEM
}
```

### WalletUser

- `id String @id @default(uuid()) @db.Uuid`
- `walletAddress String @unique @map("wallet_address")`
- `chainNamespace String @default("solana") @map("chain_namespace")`
- `status WalletUserStatus @default(ENABLED)`
- `blockedUntil DateTime? @map("blocked_until") @db.Timestamptz(3)`
- `lastLoginAt DateTime? @map("last_login_at") @db.Timestamptz(3)`
- timestamps
- relations to challenges, sessions, and applications
- map `wallet_users`
- indexes status and blockedUntil

Wallet address is canonical base58 after decode/re-encode.

### WalletAuthChallenge

- UUID id
- optional user relation by wallet address is not required
- `walletAddress`
- `nonceHash`
- `messageHash`
- `domain`
- `uri`
- `chainId`
- `requestId`
- `issuedAt`
- `expiresAt`
- `consumedAt`
- `attemptCount Int @default(0)`
- `requesterIpHash`
- `userAgentHash`
- `createdAt`
- map `wallet_auth_challenges`
- indexes walletAddress+expiresAt, expiresAt, consumedAt

Never persist the raw nonce, message, signature, IP, or user agent.

### WebSession

- UUID id
- userId relation
- tokenPrefix unique
- tokenHash
- csrfHash
- createdAt
- lastSeenAt
- idleExpiresAt
- absoluteExpiresAt
- revokedAt
- revokeReason
- ipHash
- userAgentHash
- indexes userId+revokedAt, idleExpiresAt, absoluteExpiresAt
- map `web_sessions`

### ApiApplication

- UUID id
- ownerUserId relation
- name
- clientId unique
- status
- blockedUntil
- lastUsedAt
- timestamps
- relations scopes, credentials, access tokens
- indexes ownerUserId+status and blockedUntil
- map `api_applications`

Do not add plan, billing, payment, subscription, price, or entitlement fields.

### ApiApplicationScope

- applicationId
- scope
- composite primary key
- relation cascade
- map `api_application_scopes`

### ApiCredential

- UUID id
- applicationId
- prefix unique
- secretHash
- createdAt
- expiresAt
- overlapEndsAt
- revokedAt
- revokeReason
- lastUsedAt
- relation cascade
- indexes applicationId+revokedAt and expiresAt
- map `api_credentials`

### ApiAccessToken

- UUID id
- applicationId
- credentialId
- prefix unique
- tokenHash
- scopes `String[]`
- createdAt
- expiresAt
- revokedAt
- revokeReason
- lastUsedAt
- indexes applicationId+expiresAt, credentialId+expiresAt, expiresAt, revokedAt
- map `api_access_tokens`

### ApiUsageBucket

- UUID id
- principalType
- principalIdHash
- routeGroup
- windowStart
- windowSeconds
- requestCount
- updatedAt
- unique principalType+principalIdHash+routeGroup+windowStart+windowSeconds
- index windowStart
- map `api_usage_buckets`

### SecurityAuditEvent

- UUID id
- actorType
- actorId
- eventType
- success
- route
- method
- reasonCode
- ipHash
- userAgentHash
- requestId
- metadata Json?
- occurredAt
- indexes occurredAt, eventType+occurredAt, actorType+actorId+occurredAt
- map `security_audit_events`

Metadata sanitization must reject forbidden keys recursively.

## 4. Migration

Create:

`prisma/migrations/20260718190000_free_access_security/migration.sql`

Requirements:

- PostgreSQL-compatible;
- enum and table creation ordered correctly;
- foreign keys use cascade only for owned credential/session/application records;
- no existing sports-data table is dropped or rewritten;
- no data backfill is required;
- rollback SQL and operational rollback are documented in the runbook;
- do not apply against production;
- `migration_applied=false` in completion metadata.

## 5. Cryptographic primitives

Use Node built-ins plus existing `bs58`; move `tweetnacl` to API production dependencies.

Fixed primitives:

- random secret/nonce: `randomBytes(32)`;
- base64url encoding;
- scrypt N=16384, r=8, p=1, 32-byte digest, 16-byte salt;
- timing-safe digest comparison;
- HMAC-SHA256 pseudonymization with `MATCHPULSE_SECURITY_PEPPER`;
- SHA-256 message and nonce hashing;
- Ed25519 detached signature verification with `tweetnacl`;
- reject malformed lengths before crypto operations.

Secret formats:

- session `mp_session_<10-char-prefix>.<secret>`;
- client ID `mp_client_<24-char-random>`;
- client secret `mp_secret_<10-char-prefix>.<secret>`;
- access token `mp_access_<10-char-prefix>.<secret>`.

Raw secrets are returned only at issuance and are never logged or persisted.

## 6. Environment contract

Document and validate:

- `MATCHPULSE_EXTERNAL_AUTH_MODE=required|disabled`; production permits only `required`;
- `MATCHPULSE_SECURITY_PEPPER` minimum 32 random bytes;
- `MATCHPULSE_WALLET_DOMAIN`;
- `MATCHPULSE_WALLET_URI`;
- `MATCHPULSE_WALLET_CHAIN_ID`;
- `MATCHPULSE_ALLOWED_ORIGINS` comma-separated exact origins;
- `MATCHPULSE_TRUSTED_PROXY_CIDRS` explicit CIDRs;
- `MATCHPULSE_API_ORIGIN` used only by Web server/BFF;
- optional limit overrides may reduce defaults but cannot exceed canonical maxima without source change.

API startup in production fails before listening when required security configuration is absent or invalid. No secret value appears in the error.

## 7. Wallet challenge contract

### POST `/api/auth/wallet/challenge`

Schema:

- wallet_address required string;
- return_uri optional absolute HTTPS URI or localhost HTTP in development;
- unknown fields rejected;
- body <= 8 KiB.

Canonical challenge:

- CAIP-122-style Solana message;
- exact configured domain and URI;
- wallet address;
- fixed statement from architecture;
- version 1;
- configured chain ID;
- random nonce;
- issued-at UTC;
- expiration exactly 5 minutes;
- random request ID;
- resource `urn:matchpulse:web`.

Response:

- challenge_id;
- wallet_address;
- message;
- issued_at;
- expires_at.

Never return nonce separately.

### POST `/api/auth/wallet/verify`

Input:

- challenge_id;
- wallet_address;
- exact message;
- signature_base64.

On success:

- atomically consume challenge;
- create or update user;
- issue session and CSRF token;
- return them only to BFF response contract;
- audit success.

On any failure:

- increment bounded attempts when challenge exists;
- return generic `WALLET_AUTH_FAILED`;
- do not reveal whether wallet, challenge, message, or signature was the failing component;
- audit sanitized reason internally.

## 8. Session contract

Session validation checks:

- token syntax;
- hash;
- user enabled;
- user not temporarily blocked;
- session not revoked;
- idle and absolute expiry;
- CSRF for unsafe session-authenticated methods;
- route access.

Coalesce `lastSeenAt` writes to one per 5 minutes.

Auth routes:

- `GET /api/auth/session`
- `POST /api/auth/logout`

Logout is idempotent and revokes the current session.

## 9. Developer management contract

All routes require valid web session and CSRF for writes.

- `GET /api/developer/v1/applications`
- `POST /api/developer/v1/applications`
- `POST /api/developer/v1/applications/:applicationId/disable`
- `POST /api/developer/v1/applications/:applicationId/credentials`
- `POST /api/developer/v1/applications/:applicationId/credentials/:credentialId/revoke`
- `GET /api/developer/v1/applications/:applicationId/usage`

Object ownership is checked on every route. Missing and foreign objects return the same 404.

Create application input:

- name;
- unique allowed scope array;
- optional exact IP CIDR allowlist, maximum 10 entries.

Defaults:

- all access free;
- max 5 enabled apps per wallet user;
- max 2 active credentials per app;
- credential expiry 90 days;
- overlap after rotation 24 hours.

Secret is shown once in create/rotation response and recursively forbidden from logs/audit metadata.

## 10. Token endpoint contract

`POST /oauth/token`

- only `application/x-www-form-urlencoded`;
- only `grant_type=client_credentials`;
- require HTTP Basic client authentication;
- reject client secret in query;
- body client credentials are not supported;
- requested `scope` is space-delimited subset;
- no refresh token;
- access token expires in 600 seconds;
- `Cache-Control: no-store`;
- `Pragma: no-cache`.

Success response uses standard fields:

- access_token;
- token_type `Bearer`;
- expires_in 600;
- scope.

Failure response uses generic `invalid_client` or `invalid_scope` without identifying which credential property failed.

## 11. Scope map and public boundary

Central constants:

```text
matches:read
events:read
scenarios:read
historical:read
verification:read
stream:read
```

Default deny.

Exempt only:

- GET `/api/health`
- GET `/api/public/status`
- auth routes
- token endpoint

Path semantics:

- replay/history -> `historical:read`;
- stream/SSE -> `stream:read`;
- verification/proof public summaries -> `verification:read`;
- competition prediction/scenario -> `scenarios:read`;
- public events/timeline -> `events:read`;
- all remaining public match reads -> `matches:read`.

If a path under `/api/public/` has no exact rule, return 403 `SCOPE_MAPPING_MISSING` and emit a critical audit event. Never fall through as public.

External auth is never evaluated as an alternative for `/api/internal/*`.

## 12. Fair-use implementation

Implement a bounded two-layer limiter:

1. local token bucket and concurrency counters;
2. durable PostgreSQL fixed-window and daily buckets.

Canonical maxima:

- health/status 60/min/IP;
- challenge 10/10m/IP and 5/10m/wallet;
- verify 10/10m/IP and 5/10m/wallet;
- token 40/min/IP and 20/min/client;
- website 120/min/session, burst 30, concurrency 8;
- API 300/min/application, burst 60, concurrency 16;
- API 50,000/day/application;
- historical 30/min/principal;
- SSE 5/principal, 20/IP;
- body 64 KiB;
- list limit 100;
- history range 31 days.

Requirements:

- principals are HMAC-pseudonymized;
- DB increment is atomic and safe across replicas;
- no unbounded in-memory maps;
- TTL cleanup;
- concurrency release in `onResponse` and `onError`;
- `Retry-After`;
- 429 safe body;
- authoritative-store failure produces 503 before expensive work;
- no provider call occurs before auth and limits pass.

## 13. Fastify hardening

Modify server construction and registration:

- bodyLimit 64 KiB;
- explicit logger redaction for authorization, cookie, set-cookie, secrets, signatures, tokens, and CSRF;
- request ID response header;
- strict external auth registration before public routes;
- existing internal auth registration preserved;
- CORS exact allowlist; no reflected origin and no wildcard credentials;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `X-Frame-Options: DENY`;
- auth/token responses no-store;
- safe centralized error mapper for new security routes.

Do not globally break SSE with a request timeout.

## 14. Web BFF implementation

Browser data access goes through same-origin BFF.

Required routes:

- auth challenge;
- auth verify;
- auth session;
- logout;
- public GET catch-all;
- developer applications list/create;
- application disable;
- credential create;
- credential revoke;
- usage.

The public catch-all:

- accepts GET only;
- fixed backend origin;
- path starts at `/api/public/`;
- encodes path segments;
- preserves only validated query parameters;
- forwards only Accept, If-None-Match, and request ID;
- adds web session header;
- never forwards browser Authorization, Cookie, Origin, internal token, or arbitrary headers;
- strips backend Set-Cookie and internal headers;
- clears invalid session cookie on 401.

BFF cookie behavior follows the architecture exactly.

## 15. Web UI

### `/login`

- detects an injected Solana provider with `connect` and `signMessage`;
- clearly states the request is off-chain and free;
- requests challenge through BFF;
- signs exact UTF-8 bytes;
- verifies through BFF;
- redirects to validated same-origin `next`;
- never requests a transaction;
- handles no wallet, rejected signature, expired challenge, and safe generic errors.

Do not add a wallet adapter dependency in this phase.

### `/developers`

- requires website session;
- lists applications, scopes, status, usage, credentials metadata;
- creates application;
- displays new secret once with explicit copy warning;
- rotates and revokes credentials;
- never stores secret in localStorage/sessionStorage/indexedDB;
- clears secret from component state on navigation/unmount;
- explains all API use is free but fair-use limited;
- documents server-side-only client secret usage.

### Middleware

Require session-cookie presence for page navigation except:

- `/login`;
- Next static/image assets;
- favicon/public assets;
- auth BFF routes.

Backend session validation remains authoritative.

### Existing browser data

Update `apps/web/lib/public-api.ts` to use the same-origin public BFF with `credentials: same-origin`. Existing client refresh behavior must continue after wallet login.

## 16. OpenAPI and documentation

Create an OpenAPI 3.1 document covering:

- token endpoint;
- bearer auth;
- scopes;
- application-management routes as session-protected;
- public data route security references;
- 401/403/429/503 schemas;
- request IDs and Retry-After;
- one-time secret behavior;
- no billing.

Create operations runbook with:

- secret generation;
- deployment prerequisites;
- WAF/CDN checklist;
- migration pre/post checks;
- credential compromise response;
- application suspension and token revocation;
- security event queries;
- cleanup jobs for expired challenges, sessions, access tokens, usage buckets;
- rollback;
- explicit statement that this phase performs no production changes.

## 17. Tests

Focused tests must include at least:

### Wallet

- valid Solana signature;
- invalid address/signature/message;
- expired, consumed, domain/URI/chain mismatch;
- three-attempt cap;
- atomic replay race produces one session only;
- no transaction request text.

### Sessions

- token hash verification;
- idle/absolute expiry;
- suspended user;
- revoked session;
- CSRF success/failure;
- Origin failure;
- last-seen coalescing.

### API clients

- one-time secret;
- scrypt hash;
- owner isolation;
- 5-app and 2-credential caps;
- rotation overlap;
- revoke;
- expired credential;
- Basic parsing;
- token expiry/revoke;
- scope subset/default deny;
- no refresh token.

### Boundary

- health/status exemption;
- website session access;
- bearer access;
- missing/invalid token;
- missing scope map;
- internal route cannot use external credential;
- auth happens before provider/service calls.

### Limits

- per-IP, wallet, session, app, daily, history, and concurrency;
- Retry-After;
- bounded cleanup;
- cross-instance durable bucket behavior at store level;
- store failure fail-closed.

### Leakage

- recursive forbidden audit metadata;
- logs and responses exclude token, secret, signature, nonce, raw IP, cookie, authorization, database/provider credentials;
- public contracts still reject forbidden model/provider internals.

### Web

- login signs exact challenge;
- no transaction method invocation;
- BFF header allowlist;
- no arbitrary proxy destination;
- cookie flags;
- CSRF;
- one-time secret not persisted;
- unauthenticated redirect;
- public refresh uses BFF.

## 18. Required commands

Run all, with actual counts:

```powershell
pnpm.cmd install --lockfile-only
pnpm.cmd exec prisma format --schema prisma/schema.prisma
pnpm.cmd exec prisma validate --schema prisma/schema.prisma
pnpm.cmd exec prisma generate --schema prisma/schema.prisma
pnpm.cmd --filter @matchpulse/api test:free-access-security
pnpm.cmd --filter @matchpulse/api test
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/web typecheck
pnpm.cmd --filter @matchpulse/web build
pnpm.cmd typecheck
pnpm.cmd build
git diff --check
```

Also verify:

- exact changed paths;
- migration SQL matches schema;
- no production migration;
- no network;
- no secret acquisition;
- no deployment;
- PHASE_QUEUE unchanged;
- unrelated work unchanged.

## 19. Completion

Only after every gate passes:

- set active state to `completed_pending_review`;
- `human_approved=false`;
- status `PHASE_COMPLETE`;
- list actual changed allowed files;
- `migration_applied=false`;
- `network_accessed=false`;
- run Automation v2 Prepare;
- stop with `PHASE_COMPLETE_PREPARED`.

Do not Publish without the explicit instruction already provided for that exact prepared commit, and do not activate any successor.
