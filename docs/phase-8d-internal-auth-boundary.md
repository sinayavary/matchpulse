# Phase 8D — Internal Auth Boundary Foundation

The API now provides a reusable `internal-auth.ts` module for future
server-side internal routes. It verifies `MATCHPULSE_INTERNAL_TOKEN` from
either `x-matchpulse-internal-token` or `Authorization: Bearer <token>`.

Missing or empty configuration denies every request with `not_configured`.
Missing request credentials return `missing_token`; malformed Authorization
returns `malformed_authorization`; and a non-matching token returns
`invalid_token`. Results never contain configured or provided token values.

This phase does not register a route, modify `server.ts`, expose Product Agent
output, or change public API behavior.
