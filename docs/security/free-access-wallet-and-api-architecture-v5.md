# Free Access wallet and API architecture v5

This document is the self-contained security contract for `FREE-ACCESS-SECURITY-B-v1`. It defines remediation intent only; it does not authorize implementation, migration application, database connection, network access, deployment, or production acceptance.

## Boundaries and invariants

- MatchPulse remains free for normal website users and API consumers.
- Wallet signing is off-chain identity only. No transaction, fee, token, NFT, balance, payment, billing, subscription, paywall, private key, or seed phrase is introduced.
- Unknown routes, scopes, origins, credentials, and store failures fail closed.
- Provider, database, and expensive work occur only after authorization.
- Public responses and audit records exclude raw credentials, tokens, signatures, provider payloads, private lineage, formulas, weights, thresholds, and internal errors.

## Wallet identity

Use a browser wallet provider for only `connect` and `signMessage`. A challenge binds the canonical Solana-compatible address, domain, URI, chain/environment, nonce, issued-at, expiration, and request ID. The store retains only a challenge hash, nonce, binding data, attempt state, and expiry; it never retains the full signed message or raw signature.

Invalid signatures increment the attempt counter without consuming the challenge. Successful verification atomically consumes it. Three attempts is the maximum. Errors are generic and do not reveal whether an address, challenge, or signature was valid.

## Persistence

Define interfaces for application, credential, token, session, challenge, quota, and audit stores. Production runtime uses Prisma-backed stores only. In-memory stores are injected test doubles only. Missing database/configuration/store availability fails closed with 503; runtime must not fall back to a process-local `Map`. State must survive restart and remain consistent across replicas. Audits are durable and redacted.

## Sessions

Use `__Host-mp_session` with `Secure`, `HttpOnly`, `Path=/`, and `SameSite=Strict` or a documented equivalent. Store only a token hash. Enforce idle and absolute expiry before updating `lastSeenAt`, with a maximum of five sessions. Logout revokes the session server-side. Every state-changing operation requires CSRF binding and strict Origin/Referer validation. Remove `x-mp-session` as an accepted session credential.

## External API

Map the actual `/api/public/*` route inventory explicitly, including `/api/public/matches`. Unknown public routes fail closed. API credentials and website-session/BFF identity are separate credential classes. `/api/internal/*` rejects external credentials. Unknown or malformed scopes are rejected, and token issuance fails when any requested scope is unauthorized. Authorization runs before provider, database, or expensive work.

## Developer applications and BFF

The BFF never fabricates IDs, credentials, usage, revoke state, or application state. Every operation proxies to the authoritative API. Session identity, ownership, CSRF, and Origin checks are enforced before proxying. One-time secrets originate only from the backend authority. Missing and foreign-owned objects produce the same generic response. Disable and revoke cascade to credentials and tokens.

The backend origin is server-only; do not expose it through a public client configuration. BFF routes use exact path segment, query, and header allowlists, bounded timeouts, response-size limits, and no arbitrary destination forwarding.

## Limits and audit

Rate state has bounded cleanup. Daily quota is durable. Concurrency, request body, response, history, and SSE limits are explicit. Limit responses use 429 and `Retry-After`. Store/configuration failures use 503. Persistent audit records are redacted and contain no raw credential, provider, or private-lineage material.

## CORS

CORS defaults to deny. Only an explicit configured origin allowlist may be accepted. Missing or malformed configuration fails closed; `origin: true` is prohibited.

## Required evidence before completion

The implementation pack must provide route-injection tests, actual public route mapping tests, internal/external credential separation, challenge binding and attempt tests, session cap/expiry and cookie tests, CSRF/Origin/Referer tests, ownership and cascade tests, persistence failure tests, BFF no-fabrication tests, fixed proxy destination tests, rate/quota tests, durable redacted audit tests, restart/repository tests, Matches DTO compatibility, and explicit absence of transaction/payment/paywall/private-key behavior.
