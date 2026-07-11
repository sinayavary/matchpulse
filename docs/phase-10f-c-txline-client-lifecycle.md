# Phase 10F-C — TxLINE Client Lifecycle and Regression Closure

## Architecture

This phase closes the backend-only TxLINE client layer without adding persistence, worker supervision, routes, migrations, or production network calls.

The provider-specific request bindings from 10F-A/B remain the lower-level transport. `TxlineResilientClient` is the integration boundary used by `TxlineClient` and `createTxlineLiveClient`.

The lifecycle has four deterministic controls:

1. **Request validation** — fixture IDs, timestamps, score-stat keys, hourly coordinates, and five-minute interval coordinates are rejected before transport.
2. **Credential recovery** — an injected guest-JWT refresher may replay one unauthorized operation exactly once. A second 401 stops.
3. **Transient retry** — only rate-limit, server, timeout, and network failures retry. Attempts and exponential delays are capped and the sleeper is injectable for offline tests.
4. **Stream opening safety** — absolute, protocol-relative, traversal, and backslash paths are rejected. An initial stream open may retry, but a failure after the first emitted event is surfaced for 10G supervision instead of silently reconnecting.

## Delivered behavior

- resilient wrapper for every fixture, score, odds, history, proof, and stream operation
- deterministic retry/backoff policy
- one bounded 401 guest-JWT refresh
- validation before transport
- same-host stream path enforcement
- `TxlineClient` and `createTxlineLiveClient` switched to the resilient boundary
- complete TypeScript exports for retry/refresh/sleeper contracts
- offline contract and lifecycle tests
- no real TxLINE, Solana, or database call

## Security boundary

- credentials remain private class fields
- refresher errors are sanitized
- unknown errors are replaced with safe errors
- provider response bodies are never copied into client errors
- proof retrieval still does not mean on-chain verification
- no public API or frontend field is added

## Deferred

Reconnect supervision, heartbeat deadlines, checkpoints, REST catch-up, deduplication, persistence, and graceful worker shutdown belong to 10G. Structural and on-chain proof verification belongs to 10N.
