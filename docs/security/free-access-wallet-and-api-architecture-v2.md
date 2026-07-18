# MatchPulse free-access wallet, API, and documentation architecture

## 1. Product invariants and access modes

MatchPulse is free for every user and API consumer. Free means no billing, plan, paywall, token purchase, subscription purchase, wallet balance, token ownership, NFT, deposit, payout, payment, or blockchain transaction requirement. Free does not mean anonymous or unlimited.

There are exactly two external access modes:

1. Website users prove control of a Solana wallet by signing an off-chain authentication message. They do not submit a transaction or pay a fee.
2. Developer API consumers first establish a website wallet session, create a free application, receive a public `client_id` and one-time `client_secret`, exchange client credentials for a short-lived opaque bearer token, and use approved read-only scopes under fair-use controls.

Internal workers and operators remain on the existing internal service-identity boundary. External credentials never authorize `/api/internal/*`.

## 2. Threat model, objectives, and trust boundaries

Protect against signed-message replay, wrong-domain or wrong-URI authentication, nonce reuse, expired challenges, brute-force attempts, session theft, CSRF, origin confusion, credential leakage, token replay, object-ownership bypass, scope confusion, unbounded resource use, distributed quota races, audit metadata leakage, and fail-open authorization. Private keys stay inside the wallet. Raw provider payloads, credentials, formulas, weights, and private model lineage remain server-only.

```text
Browser -> MatchPulse Web / Next BFF -> MatchPulse API -> PostgreSQL security state
Developer server -> HTTPS -> token endpoint -> bearer token -> protected public data
Internal worker/operator -> existing service identity -> /api/internal/*
```

The browser never receives an internal credential, website session token in JavaScript, API token for browsing, provider credential, raw payload, or private model input. The BFF is the only browser-to-public-data path.

## 3. Wallet challenge and verification contract

`POST /api/auth/wallet/challenge` accepts `wallet_address` and optional `return_uri`; unknown fields are rejected and the body is at most 8 KiB. The server validates the 32-byte base58 Solana public key, rate-limits IP and wallet principals, creates 32 random bytes of nonce, stores only nonce/message hashes, and returns the exact canonical CAIP-122-style message. The message binds configured domain, URI, chain ID, wallet, request ID, issued-at, expiry, and `urn:matchpulse:web`.

The fixed statement is:

> Sign in to MatchPulse. This is an off-chain authentication request. It does not create a transaction or grant access to wallet assets.

Challenges expire after exactly 5 minutes and allow at most 3 verification attempts. Raw nonce, message, and signature are never persisted.

`POST /api/auth/wallet/verify` accepts challenge ID, wallet address, exact message, and base64 detached signature. It checks consumption, expiry, attempts, message hash, domain, URI, chain, nonce, request ID, issued-at, expiry, address decoding, 64-byte signature length, and Ed25519 verification. It atomically consumes the challenge, creates or updates the wallet user, issues a session and CSRF material, and returns those only through the trusted BFF. Failure is generic `WALLET_AUTH_FAILED` and does not reveal which component failed.

## 4. Website sessions, cookies, CSRF, and CORS

Session format is `mp_session_<prefix>.<32-byte-base64url-secret>`. Only the prefix and a scrypt hash are persisted; raw tokens, raw IPs, and raw user agents are not. IP and user-agent values are HMAC-SHA256 pseudonyms using `MATCHPULSE_SECURITY_PEPPER`.

Session policy is idle expiry 12 hours, absolute expiry 7 days, last-seen persistence no more than once per 5 minutes, and at most 5 active sessions per wallet. Logout and suspension revoke immediately. The BFF cookies are:

- `__Host-mp_session`: Secure, HttpOnly, SameSite=Lax, Path=/.
- `__Host-mp_csrf`: Secure, SameSite=Strict, Path=/; readable by the app for the synchronizer header.

Unsafe operations require a valid session, exact allowed Origin/Referer, matching CSRF cookie and `X-CSRF-Token`, and server-side CSRF hash verification. Backend CORS is disabled by default for protected data; development and production origins are explicit allowlists, wildcard credentials are forbidden, and unsafe methods reject missing or foreign origins. Auth/token responses use `Cache-Control: no-store` and `Pragma: no-cache`.

## 5. Cryptographic and environment contract

Use `randomBytes(32)`, base64url, scrypt `N=16384,r=8,p=1` with a 32-byte digest and 16-byte salt, timing-safe comparison, HMAC-SHA256 pseudonymization, SHA-256 message/nonce hashes, and Ed25519 detached verification with `tweetnacl`. Reject malformed lengths before crypto.

Formats are `mp_client_<24-char-random>`, `mp_secret_<10-char-prefix>.<32-byte-base64url-secret>`, and `mp_access_<10-char-prefix>.<32-byte-base64url-secret>`. Raw secrets are returned only at issuance and never logged or persisted.

Required configuration is `MATCHPULSE_EXTERNAL_AUTH_MODE` (`required` or `disabled`, with production permitting only `required`), a 32-random-byte minimum `MATCHPULSE_SECURITY_PEPPER`, `MATCHPULSE_WALLET_DOMAIN`, `MATCHPULSE_WALLET_URI`, `MATCHPULSE_WALLET_CHAIN_ID`, exact `MATCHPULSE_ALLOWED_ORIGINS`, explicit `MATCHPULSE_TRUSTED_PROXY_CIDRS`, and `MATCHPULSE_API_ORIGIN` for the Web BFF. Invalid production security configuration fails before listening without revealing secrets. Limit overrides may reduce canonical maxima but may not increase them without a source change.

## 6. Exact security data model

The implementation uses exactly these enums: `WalletUserStatus { ENABLED, SUSPENDED }`, `ApiApplicationStatus { ENABLED, DISABLED }`, `SecurityPrincipalType { IP, WALLET, SESSION, APPLICATION, CLIENT }`, and `SecurityAuditActorType { ANONYMOUS, WALLET_USER, WEB_SESSION, API_APPLICATION, API_CREDENTIAL, SYSTEM }`.

The exact models are `WalletUser`, `WalletAuthChallenge`, `WebSession`, `ApiApplication`, `ApiApplicationScope`, `ApiCredential`, `ApiAccessToken`, `ApiUsageBucket`, and `SecurityAuditEvent`.

- `WalletUser`: UUID id, unique canonical wallet address, `chainNamespace` default `solana`, status, optional `blockedUntil` and `lastLoginAt`, timestamps, relations to challenges/sessions/applications, status/blocked indexes, map `wallet_users`.
- `WalletAuthChallenge`: UUID, wallet address, nonce/message hashes, domain, URI, chain ID, request ID, issued/expiry/consumed timestamps, attempt count default 0, IP/user-agent hashes, timestamps, expiry/consumption indexes, map `wallet_auth_challenges`.
- `WebSession`: UUID, user relation, unique token prefix, token/CSRF hashes, created/seen/idle/absolute timestamps, revocation fields, pseudonymous IP/user-agent, user/revocation and expiry indexes, map `web_sessions`.
- `ApiApplication`: UUID, owner relation, name, unique client ID, status, blocked/last-used timestamps, timestamps, scopes/credentials/tokens relations, owner/status and blocked indexes, map `api_applications`; no plan, billing, payment, subscription, price, or entitlement fields.
- `ApiApplicationScope`: application relation and scope with composite primary key, cascade only within owned application records, map `api_application_scopes`.
- `ApiCredential`: UUID, application relation, unique prefix, secret hash, created/expiry/overlap/revocation/last-used fields, application/revocation and expiry indexes, map `api_credentials`.
- `ApiAccessToken`: UUID, application and credential relations, unique prefix, token hash, string-array scopes, created/expiry/revocation/last-used fields, application/credential/expiry/revocation indexes, map `api_access_tokens`.
- `ApiUsageBucket`: UUID, principal type and pseudonymous principal ID, route group, window start/seconds, request count, updated timestamp, unique principal/window tuple and window index, map `api_usage_buckets`.
- `SecurityAuditEvent`: UUID, actor type/id, event type, success, route/method/reason, pseudonymous IP/user-agent, request ID, optional JSON metadata, occurred timestamp, occurrence/event/actor indexes, map `security_audit_events`.

No existing sports-data table is dropped or rewritten. No backfill is required. Audit metadata rejects forbidden keys recursively, including tokens, secrets, signatures, nonces, raw IPs, cookies, authorization, database/provider credentials, and raw payloads.

## 7. Developer applications and token exchange

Developer management requires a wallet-authenticated website session. There are at most 5 enabled applications per wallet and 2 active credentials per application. Names are 3–80 characters; credentials expire after 90 days; rotation overlaps for at most 24 hours; revocation is immediate; optional IP allowlists are disabled by default and limited to 10 exact CIDRs.

The only external scopes are `matches:read`, `events:read`, `scenarios:read`, `historical:read`, `verification:read`, and `stream:read`. Internal, ingestion, provider, model, raw-payload, and administrative scopes are forbidden.

`POST /oauth/token` accepts only HTTPS form encoding, `grant_type=client_credentials`, HTTP Basic `client_secret` authentication, and an optional requested scope subset. Client secrets are never accepted in URLs or query strings. The response is opaque `Bearer`, expires in 600 seconds, contains no refresh token, and is `no-store`. Failures use generic `invalid_client` or `invalid_scope` responses. Tokens are scrypt-hashed, bound to application/credential/scopes, revocable, and never accepted in query parameters.

## 8. Public boundary and route map

The public boundary accepts either `Authorization: Bearer mp_access_*` for developers or `X-MatchPulse-Web-Session: mp_session_*` from the trusted BFF. Exemptions are only `GET /api/health`, `GET /api/public/status`, wallet challenge/verify routes, and `POST /oauth/token`. All other external public routes require authentication.

Authorization is centralized and default-deny: matches/scoreboards use `matches:read`, events/timeline `events:read`, prediction/scenario `scenarios:read`, history/replay `historical:read`, verification summaries `verification:read`, and streams/SSE `stream:read`. An unmapped `/api/public/` path returns 403 `SCOPE_MAPPING_MISSING` and emits a critical audit event. External credentials never reach `/api/internal/*`, operators, ingestion writes, provider operations, or raw audit payloads.

## 9. BFF and browser routes

The Next BFF owns challenge, verify, session, logout, public GET catch-all, application list/create/disable, credential create/revoke, and usage routes. Public proxying accepts GET only, uses a fixed backend origin and `/api/public/` path family, validates query parameters, forwards only `Accept`, `If-None-Match`, and request ID, adds the web-session header, strips `Set-Cookie` and internal headers, never forwards browser Authorization/Cookie/Origin/internal headers, and clears invalid cookies on 401. Middleware redirects unauthenticated page navigation to `/login` except static assets, login, and auth BFF routes; backend validation remains authoritative.

`/login` uses an injected provider's `connect` and `signMessage`, signs exact UTF-8 challenge bytes, handles missing/rejected/expired/error cases, redirects only to validated same-origin `next`, and never invokes a transaction. `/developers` requires a website session, shows applications/scopes/status/usage/credential metadata, displays a new secret once, supports rotation/revocation, never persists secrets in browser storage, and explains free fair-use access.

## 10. Fair-use and edge policy

Canonical maxima are: health/status 60/min/IP; challenge and verify 10/10m/IP and 5/10m/wallet; token 40/min/IP and 20/min/client; website 120/min/session with burst 30 and concurrency 8; API 300/min/application with burst 60 and concurrency 16; 50,000 protected requests/day/application; historical/replay 30/min/principal with a 31-day request window and 100-record response cap; SSE 5 concurrent/principal and 20/IP; 64 KiB request body; 1 MiB normal response; list limit 100; URL length 8 KiB.

Local bounded token buckets handle bursts and concurrency; atomic PostgreSQL usage buckets enforce sustained windows and daily quotas across replicas. Counters are pseudonymous, bounded, TTL-cleaned, and released on response/error. Rate limits return 429 with `Retry-After`; authoritative security-store failure returns 503 before expensive work; health/status remain bounded and available.

Production readiness requires CDN/WAF, TLS, explicit trusted proxies, edge rate controls, bot/anomaly rules, header/body limits, and origin monitoring. This phase only creates contract/runbook checks; it performs no production configuration or network operation.

## 11. Logging, errors, monitoring, rollout, and rollback

Logs redact Authorization, Cookie/Set-Cookie, secrets, tokens, signatures, CSRF, database URLs, and provider credentials. Public failures expose only stable code, generic message, request ID, and retry information. Audit events cover challenge, login, session, application, credential, token, scope, quota, client, CSRF/origin, and store-failure events. Response states are bounded and reversible: `normal -> throttled -> temporarily_blocked -> application_disabled`.

Deployment gates are reviewed schema/migration, security configuration, exact domains/proxies, WAF checklist, test-wallet/test-application smoke tests, redaction verification, multi-replica limit checks, and rollback rehearsal. Rollback revokes affected credentials/tokens, disables compromised applications, restores the prior application revision, and follows the runbook; no production action is authorized by this governance transition.

## 12. Documentation Portal contract

The portal includes `/developers` and `/developers/docs`, complete Quick Start, wallet sign-in, application creation, one-time secret handling, token exchange, scopes, rate limits/quotas, pagination, errors, credential rotation/revocation, OpenAPI reference, curl, PowerShell, TypeScript, and Python examples, the developer dashboard, versioning, changelog, deprecation policy, security guidance, and safe authenticated Try It. It must not show internal routes, secrets, raw provider data, private fields, formulas, or model internals.

## 13. Acceptance boundary

The implementation phase must run the manifest commands and security tests, verify exact allowlisted paths, schema/migration consistency, redaction, default-deny scope mapping, BFF boundaries, and no-transaction behavior. It must report `migration_applied=false`, `network_accessed=false`, no deployment, no secret acquisition, and no fabricated data. This document is self-contained and does not require another branch, pull request, or external source for its implementation contract.
