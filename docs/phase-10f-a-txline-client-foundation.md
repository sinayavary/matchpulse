# Phase 10F-A — TxLINE Client Foundation

This phase consolidates TxLINE data access behind one secret-safe client.

Delivered scope:

- environment-driven REST transport
- explicit guest JWT and API-token headers
- canonical fixture, score, and odds snapshot methods
- generic SSE connection support without inventing a provider-specific stream path
- deterministic SSE parsing with chunk-boundary handling
- backward-compatible `createTxlineLiveClient`
- injected transports for offline tests
- no real network request, migration, public route, or provider payload exposure

Later 10F subphases may add provider-specific stream endpoint bindings and additional
data domains only after their exact contracts are documented.
