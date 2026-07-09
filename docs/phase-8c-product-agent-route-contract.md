# Phase 8C — Product Agent Internal Route Contract

## Contract

The future route is `GET /api/internal/product-agent/matches/:fixtureId/insight`.
It is reserved for an internal operator dashboard, internal demo/debug tooling,
backend-only orchestration, and a future protected admin panel. It is not a
public API, unauthenticated frontend surface, third-party client surface, or
Telegram runtime surface by default.

The route must have a server-side internal authorization boundary before it is
implemented. A later implementation may use `x-matchpulse-internal-token` or
`Authorization: Bearer <internal-token>`, but this phase does not hardcode
secrets or add authentication middleware because the repository has no existing
internal-token pattern.

## Query contract

Only these query parameters are allowed:

- `includeEventImpact` — boolean, default `true`.
- `includeOddsReliability` — boolean, default `true`.
- `staleAfterMinutes` — integer, default `180`, bounded to `1..10080`.
- `oddsLimit` — integer, default `20`, bounded to `1..50`.

`"true"` and `"false"` are accepted for booleans. Numeric values are truncated
and clamped to their bounds; invalid numeric values use the default. Unknown
query parameters are rejected.

## Response contract

Success responses have exactly the following envelope:

```ts
{
  data: ProductAgentV1Insight;
  meta: {
    status: "live" | "degraded" | "no_data" | "stale";
    source: "product-agent";
    mode: "internal";
  };
}
```

Failures use `data: null` and a bounded `message` with `status` of `no_data` or
`degraded`. They must not contain stack traces, raw errors, secrets, raw
SignalCore output, raw event rows, formulas, or debug lineage.

`ProductAgentV1Insight.decision_context` is internal-only. It must not be added
to `/api/matches`, `/api/matches/:fixtureId`, `/api/public/*`, public web
frontend props, or Telegram payloads by default. A later phase may define a
separate reduced public-safe mapping; this phase does not.

The structured payload safety assertion rejects forbidden keys case-insensitively:
`prediction`, `probability`, `confidence`, `winner`, `recommended_bet`, `bet`,
`expected_value`, `EV`, `edge`, `wager`, `stake`, `profit`, `payout`, `wallet`,
`deposit`, `formula`, `raw`, `raw_payload`, `debug`, `debug_lineage`,
`internal_context`, `stack`, `secret`, `token`, and `api_key`. Negative
disclaimer text containing those words is allowed because only structured keys
are scanned.

This phase defines no route, changes no public API behavior, adds no frontend
UI, and adds no auth implementation.
