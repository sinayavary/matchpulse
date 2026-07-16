# P0-SEC-A — Internal Route Authentication Boundary

## Review and rationale

The published `HOTFIX-PUBLIC-MATCHES-UPCOMING-v1` completion is valid on
`origin/main` (`2d5c9958471e4a70d227b19ed78ec5424cc22662`), with its declared
focused tests, API typecheck/build, regression suite, empty Prisma diff, and
no migration or production network evidence recorded in `ACTIVE_PHASE.json`.
The queue already records the preceding 10F-A, 10F-B, 10F-C, competition, and
hotfix work as complete. The next risk-ranked phase is therefore P0-SEC-A.

## Objective

Guard every `/api/internal/*` route before its handler with the existing
secret-safe token verifier. Missing configuration fails closed with 503;
missing, malformed, or invalid request credentials return 401. Public routes
remain unaffected and no token or credential material is logged or returned.

## Scope and gates

This phase has no schema or migration change, no dependency change, and no
production network access. The allowlist is limited to the central Fastify
boundary, its tests, server registration, and repository governance/pack
artifacts. Raw audit data remains an internal-only concern; this phase closes
the unauthenticated route boundary and does not expand any public contract.

## Acceptance and rollback

- GET and POST internal routes reject unauthorized requests before handlers.
- Missing server configuration returns 503; invalid credentials return 401.
- A valid bearer or internal header reaches the handler.
- Public routes remain usable without the internal token.
- Focused security tests, API typecheck/build/regression, diff check, and
  read-only Prisma diff pass.
- Rollback is a single revert of the phase commit; no data migration exists.

## Continuation

After this phase is complete and published, P0-SEC-B is the default next
phase: Telegram webhook, raw audit, and legacy route isolation. It must remain
inactive until this phase has completion evidence and a valid fast-forward
publication.
