# Phase 10F-B — TxLINE Provider Bindings and Historical/Proof Requests

This phase extends the backend-only TxLINE client with exact request construction for provider-documented data APIs.

Delivered scope:

- fixture hourly updates
- current fixture-specific score and odds updates
- historical score history
- historical five-minute score and odds intervals, with optional fixture filtering
- official scores and odds SSE endpoint bindings
- fixture update and hourly fixture-batch proof retrieval
- odds update proof retrieval by `messageId` and `ts`
- score-stat proof retrieval in legacy one/two-stat mode and V2 comma-separated multi-stat mode
- deterministic offline tests for paths, query names, encoding, API-base retention, and heartbeat parsing

Security and verification boundaries:

- JWT and API token remain private client credentials.
- Tests use injected transports and do not call TxLINE.
- Proof payloads remain internal and are returned as opaque transport data in this phase.
- Retrieving a proof does not assign `onchain_verified` status.
- No proof blob is exposed through public routes.

Deferred to later phases:

- response-schema decoding and proof structural validation
- on-chain proof execution
- reconnect/backoff supervision
- heartbeat timeout policy
- REST catch-up and deduplication
- persistence, checkpoints, routes, and worker integration
