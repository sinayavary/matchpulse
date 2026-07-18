# MatchPulse Free Access, Wallet Login, and Developer API Security Architecture

## 1. Decision

MatchPulse is free for every user and API consumer. Free means no billing, plans, paywall, token purchase, subscription purchase, or wallet balance requirement. Free does not mean anonymous or unlimited.

There are exactly two external access modes:

1. **Website user**
   - Registers and signs in only by proving control of a Solana wallet.
   - Signs an off-chain authentication message.
   - Does not submit a blockchain transaction.
   - Does not pay a fee.
   - Does not receive API client credentials unless they separately create a developer application.

2. **Developer API consumer**
   - First signs in to the MatchPulse website with a Solana wallet.
   - Creates a free developer application.
   - Receives a public `client_id` and a one-time-displayed `client_secret`.
   - Exchanges the client credentials for a short-lived opaque bearer access token.
   - Uses only approved read-only scopes.
   - Is subject to fair-use limits, concurrency controls, daily quotas, monitoring, rotation, and revocation.

Internal workers and operators remain on the existing internal service-identity boundary. External credentials must never authorize `/api/internal/*`.

## 2. Security objectives

The design must:

- keep wallet private keys entirely inside the wallet;
- prevent signed-message replay;
- bind wallet login to the expected domain, URI, chain, nonce, request, and expiry;
- keep website session tokens out of JavaScript;
- keep developer client secrets and access tokens out of logs and URLs;
- make every external credential revocable;
- enforce least privilege and object ownership;
- enforce distributed fair-use controls;
- protect expensive historical, replay, and streaming paths;
- fail closed when security state cannot be verified;
- preserve public response sanitization and MatchPulse IP boundaries;
- avoid any billing or paid-tier behavior;
- avoid wallet balance, NFT, token ownership, or on-chain transaction requirements;
- keep all model internals, raw provider payloads, credentials, formulas, weights, and private lineage inaccessible.

## 3. Standards baseline

Implementation follows:

- CAIP-122 Sign-In With X concepts and the Solana namespace message/signature rules;
- OAuth 2.0 client credentials semantics for confidential API clients;
- OAuth 2.0 Security Best Current Practice (RFC 9700);
- JWT BCP concepts from RFC 8725 even though external access tokens are opaque;
- OWASP API Security Top 10 2023;
- TLS 1.2 minimum and TLS 1.3 preferred at the edge.

No claim of complete OAuth authorization-server conformance is made beyond the implemented client-credentials token endpoint.

## 4. Trust boundaries

```text
Browser
  -> MatchPulse Web / Next BFF
      -> MatchPulse API
          -> PostgreSQL security state
          -> existing public-safe data services

Developer server
  -> HTTPS
      -> MatchPulse API token endpoint
      -> short-lived bearer token
      -> protected public data routes

Internal worker/operator
  -> existing internal service identity
      -> /api/internal/*
```

The browser never receives:

- the website session token;
- a developer client secret except immediately after explicit creation/rotation;
- an API access token for website browsing;
- internal service credentials;
- TxLINE credentials;
- raw provider payloads;
- private model inputs.

## 5. Website wallet authentication

### 5.1 Challenge

`POST /api/auth/wallet/challenge`

Input:

```json
{
  "wallet_address": "<base58 Solana public key>",
  "return_uri": "https://app.example/matches"
}
```

The server:

- validates a 32-byte Solana public key;
- rate-limits by IP hash and wallet hash;
- creates 32 random bytes of nonce;
- stores only nonce and message hashes;
- creates a canonical CAIP-122-style message;
- binds domain, URI, configured chain ID, wallet address, request ID, issued time, and expiration;
- expires the challenge after 5 minutes;
- permits at most 3 verification attempts;
- returns the exact message to sign.

Required message statement:

`Sign in to MatchPulse. This is an off-chain authentication request. It does not create a transaction or grant access to wallet assets.`

### 5.2 Verification

`POST /api/auth/wallet/verify`

Input includes challenge ID, wallet address, exact message, and base64 signature.

The server:

- loads the challenge;
- checks not consumed, not expired, and attempt count below 3;
- recomputes and timing-safely compares the message hash;
- verifies exact domain, URI, chain ID, nonce, request ID, issued-at, and expiration;
- decodes the wallet address to 32 bytes;
- decodes the detached signature to 64 bytes;
- verifies Ed25519 with `tweetnacl`;
- atomically consumes the challenge;
- creates the wallet user on first successful sign-in;
- creates a new opaque session and revokes superseded sessions according to the configured cap;
- returns session and CSRF material only to the trusted Next BFF.

A signed message is authentication only. It must never request a transfer, approval, transaction, token permission, or asset access.

### 5.3 Website session

Session token format:

`mp_session_<prefix>.<32-byte-base64url-secret>`

Storage:

- prefix stored in plaintext for lookup;
- full token stored only as a scrypt hash;
- raw token never persisted;
- raw IP and user agent never persisted;
- IP and user agent are HMAC-pseudonymized with `MATCHPULSE_SECURITY_PEPPER`.

Lifetime:

- idle expiry: 12 hours;
- absolute expiry: 7 days;
- last-seen persistence no more often than every 5 minutes;
- maximum active sessions per wallet: 5;
- logout and security suspension revoke immediately.

Browser cookies set by Next BFF:

- `__Host-mp_session`: Secure, HttpOnly, SameSite=Lax, Path=/;
- `__Host-mp_csrf`: Secure, SameSite=Strict, Path=/, readable by the app for the synchronizer header.

Unsafe website operations require:

- valid session;
- exact allowed Origin/Referer;
- CSRF cookie and `X-CSRF-Token` equality in the BFF;
- server-side CSRF token hash verification.

## 6. Free developer applications

Developer management is available only to a wallet-authenticated website user.

Limits:

- maximum 5 enabled applications per wallet user;
- maximum 2 active credentials per application;
- application names 3-80 characters;
- credentials expire after 90 days;
- all applications are free;
- there are no plan, price, billing, payment, subscription, or wallet-balance fields.

Application fields:

- owner user;
- name;
- random public client ID;
- enabled/disabled status;
- selected read-only scopes;
- timestamps and last-use time;
- optional IP allowlist, disabled by default.

Allowed external scopes:

- `matches:read`
- `events:read`
- `scenarios:read`
- `historical:read`
- `verification:read`
- `stream:read`

Forbidden scopes:

- every `internal:*`;
- ingestion or runtime write scopes;
- provider operation;
- model operation;
- raw payload access;
- administrative writes.

## 7. Client credentials and access tokens

Client ID format:

`mp_client_<random-base64url>`

Client secret format:

`mp_secret_<prefix>.<32-byte-base64url-secret>`

Rules:

- client secret displayed exactly once;
- only prefix and scrypt hash persisted;
- rotation creates overlap for at most 24 hours;
- revocation is immediate;
- secret never accepted in URL or query string.

Token endpoint:

`POST /oauth/token`

Requirements:

- HTTPS;
- `application/x-www-form-urlencoded`;
- `grant_type=client_credentials`;
- `client_secret_basic` via Authorization header;
- optional requested scope must be a subset of application scopes;
- no refresh token;
- generic invalid-client response;
- token endpoint rate limiting.

Access token format:

`mp_access_<prefix>.<32-byte-base64url-secret>`

Properties:

- opaque;
- scrypt-hashed at rest;
- 10-minute lifetime;
- revocable;
- bound to application, credential, and scopes;
- last-used update coalesced;
- never accepted in query parameters;
- response has `Cache-Control: no-store` and `Pragma: no-cache`.

## 8. External route authorization

The public data boundary accepts exactly one of:

- `Authorization: Bearer mp_access_*` for developer clients;
- `X-MatchPulse-Web-Session: mp_session_*` from the trusted Next BFF.

Exempt routes:

- `GET /api/health`
- `GET /api/public/status`
- wallet challenge and verification;
- `POST /oauth/token`.

All other external public data routes require authentication.

The route-to-scope map is centralized and default-deny. Historical/replay routes require `historical:read`; streaming requires `stream:read`; prediction/scenario routes require `scenarios:read`; verification routes require `verification:read`; match and scoreboard routes require `matches:read`; event routes require `events:read`.

No external credential can reach `/api/internal`, `/api/internal/*`, operator functions, ingestion writes, provider operations, or raw audit payloads.

## 9. Next.js BFF

Browser requests never call the backend public data API directly.

The Next BFF:

- receives the wallet challenge and verification requests;
- stores the returned session token only in the HttpOnly cookie;
- proxies authenticated GETs through a fixed backend origin;
- forwards the session in `X-MatchPulse-Web-Session`;
- never reflects arbitrary backend URLs;
- allows only explicit methods and path families;
- forwards only allowlisted headers;
- strips `Set-Cookie`, authorization, internal headers, and hop-by-hop headers from proxied responses;
- returns 401 to the browser and clears invalid cookies;
- applies CSRF checks to developer-management mutations.

Next middleware redirects unauthenticated page navigation to `/login`, excluding static assets, login, and auth BFF routes. Cookie presence is only a navigation optimization; backend validation remains authoritative.

## 10. Fair-use controls

Free access is protected by fixed defaults. Configuration may reduce limits in an incident but may not silently increase them beyond documented maxima without review.

### 10.1 Limits

- unauthenticated health/status: 60 requests/minute/IP;
- wallet challenge: 10 requests/10 minutes/IP and 5/10 minutes/wallet;
- wallet verification: 10/10 minutes/IP and 5/10 minutes/wallet;
- OAuth token endpoint: 40/minute/IP and 20/minute/client;
- website session reads: 120/minute/session, burst 30, 8 concurrent;
- developer API: 300/minute/application, burst 60, 16 concurrent;
- developer daily quota: 50,000 successful or rejected protected requests/day/application;
- historical/replay: 30/minute/principal, maximum 31-day request window, maximum 100 returned records;
- SSE: 5 concurrent streams/principal and 20/IP;
- request body: 64 KiB;
- normal JSON response: 1 MiB;
- list limit: 100;
- maximum URL length: 8 KiB.

### 10.2 Enforcement

- local bounded token bucket handles bursts and concurrency;
- PostgreSQL atomic usage buckets enforce sustained windows and daily quota across replicas;
- all maps have TTL cleanup and hard cardinality bounds;
- rate-limit failures return 429 and `Retry-After`;
- protected routes fail closed with 503 when authoritative security state is unavailable;
- health/status remain bounded and available;
- expensive downstream work occurs only after authentication, authorization, and quota checks.

## 11. Edge protections

Application controls do not replace DDoS protection. Production readiness requires:

- CDN/WAF in front of Web and API;
- TLS termination and HTTPS redirect;
- network-level connection and request-rate controls;
- bot and anomaly rules;
- maximum body and header limits;
- origin access restricted to the edge where supported;
- explicit trusted-proxy CIDRs;
- no `trustProxy=true` wildcard;
- origin and DNS monitoring.

External provider/WAF configuration is a separate deployment gate. This implementation phase creates the runbook and readiness checks but performs no production network or configuration changes.

## 12. Data model

The implementation adds:

- `WalletUser`
- `WalletAuthChallenge`
- `WebSession`
- `ApiApplication`
- `ApiApplicationScope`
- `ApiCredential`
- `ApiAccessToken`
- `ApiUsageBucket`
- `SecurityAuditEvent`

All relations use restrictive ownership checks and indexed expiry/status fields. Security audit metadata is sanitized and cannot contain tokens, signatures, nonces, raw IPs, cookies, authorization headers, secrets, or provider payloads.

## 13. Logging and errors

Fastify logger redacts:

- authorization;
- cookie and set-cookie;
- client secret;
- access/session tokens;
- signatures;
- CSRF values;
- database URL;
- provider credentials.

Public failures expose:

- stable error code;
- generic message;
- request ID;
- retryability and Retry-After when applicable.

They never expose stack traces, ORM details, credential existence, hash format, wallet signature material, internal route names, or provider details.

## 14. CORS and browser security

- Browser data traffic uses same-origin BFF.
- Backend CORS is disabled by default for protected data.
- Development origins are explicit.
- Production origins come from an exact allowlist.
- Wildcard origin with credentials is forbidden.
- Auth/token responses are `no-store`.
- Security headers include nosniff, strict referrer policy, frame denial, and an explicit CSP on the Web app.
- Unsafe methods reject missing or foreign Origin.

## 15. Security monitoring

Audit events cover:

- challenge created, failed, consumed, expired;
- wallet login success/failure/logout;
- session revoked/expired;
- application created/disabled;
- credential created/rotated/revoked;
- access token issued/rejected/revoked;
- scope denied;
- rate limit/quota/concurrency denied;
- repeated unknown client IDs;
- invalid CSRF/origin;
- security-store failure.

Automated response states:

`normal -> throttled -> temporarily_blocked -> application_disabled`

Automatic blocking must be bounded, reversible, audited, and must not disclose detection thresholds to clients.

## 16. Deployment gates

Before production enablement:

1. reviewed migration;
2. security secrets configured;
3. exact application and API domains configured;
4. trusted proxy configuration reviewed;
5. WAF/CDN checklist complete;
6. smoke tests using test wallet and test application;
7. credential redaction verified in logs;
8. rate limits verified across at least two API replicas or documented single-replica state;
9. rollback tested;
10. no internal/public leakage regression.

The implementation phase must not deploy, apply a production migration, acquire secrets, access real wallets, or call production services.
