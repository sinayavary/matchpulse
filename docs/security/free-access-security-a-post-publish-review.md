# FREE-ACCESS-SECURITY-A-v4 post-publish review

Review disposition: `PUBLISHED_BUT_REVIEW_REJECTED`

The published completion commit `b913afadb6610506d34e794b9d0f0c454f0606d1` is retained as immutable history. This review authorizes no deployment, production acceptance, migration application, database connection, application or registry network access, or secret access. Remediation is fix-forward only through `FREE-ACCESS-SECURITY-B`.

## FA-SEC-001 — External API fail-open

- Severity: release-blocking high/critical boundary defect.
- Evidence: `scopeForRoute` maps `/api/matches`, while actual public routes are `/api/public/matches`; `authorizeExternal` returns `true` for an unknown scope.
- Impact: public API token enforcement is not proven on the actual route inventory.

## FA-SEC-002 — Wallet challenge contract incomplete

- Severity: release-blocking high.
- Evidence: the challenge lacks complete domain, URI, chain, and request binding; the runtime store retains the full message; invalid verification can consume a challenge before cryptographic success; attempt counting is not enforced; the public key is not canonically bound to the wallet address.
- Impact: replay, cross-context signing, and account-binding failures remain possible.

## FA-SEC-003 — Session/CSRF/Origin/Cookie failure

- Severity: release-blocking high.
- Evidence: the cookie is not `__Host-`/`Secure`; state-changing routes do not consistently enforce CSRF and strict Origin/Referer checks; `x-mp-session` is accepted as a session credential; idle expiry is checked after `lastSeenAt` mutation; logout and the session BFF lack backend validation.
- Impact: browser session boundary and cross-site request protections are incomplete.

## FA-SEC-004 — Runtime persistence absent

- Severity: release-blocking high.
- Evidence: application, credential, token, session, challenge, quota, and audit state are process-local; Prisma models are not connected to runtime stores; restart loses state; replicas are inconsistent; store failure does not fail closed with 503.
- Impact: durable security state and multi-instance correctness are not established.

## FA-SEC-005 — Developer BFF fabricates state

- Severity: release-blocking high.
- Evidence: application routes return random state; credential routes generate random secrets without backend authority; revoke, disable, and usage routes do not proxy real operations; ownership, CSRF, and Origin checks are absent.
- Impact: the browser can observe state that is not authoritative and operations are not protected by the backend security boundary.

## FA-SEC-006 — Login/dashboard incomplete

- Severity: release-blocking medium/high.
- Evidence: `WalletLogin` redirects without performing wallet `connect` and `signMessage`; the dashboard has no real application operations; one-time secret lifecycle is not authoritative.
- Impact: the user-facing identity and developer workflow are incomplete.

## FA-SEC-007 — Rate/quota/revocation incomplete

- Severity: release-blocking high.
- Evidence: rate limiting is process-local and lacks cleanup; durable daily quota and complete response/body/history/SSE limits are absent; revocation does not cascade to prior tokens; disable does not cascade; unauthorized scope requests fall back instead of rejecting.
- Impact: abuse controls and revocation guarantees are incomplete.

## FA-SEC-008 — CORS fail-open

- Severity: release-blocking high.
- Evidence: the current fallback is `origin: true` rather than an explicit allowlist and fail-closed configuration.
- Impact: cross-origin access is broader than the approved security contract.

## FA-SEC-009 — Test evidence insufficient

- Severity: release-blocking process/control finding.
- Evidence: the focused suite covers only six primitive assertions and lacks actual route injection, path mapping, CSRF, Origin, CORS, session cap/expiry, ownership, revoke cascade, persistence failure, BFF, and auth-before-provider coverage.
- Impact: the published security claim is not supported by comprehensive executable evidence.

## Review conclusion

`FREE-ACCESS-SECURITY-A-v4=PUBLISHED_BUT_REVIEW_REJECTED`

```text
deployment_allowed=false
production_acceptance=false
remediation_required=true
remediation_phase=FREE-ACCESS-SECURITY-B
remediates_commit=b913afadb6610506d34e794b9d0f0c454f0606d1
```
