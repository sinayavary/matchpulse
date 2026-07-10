# 03 — TxLINE Data Architecture

## 1. Documented Upstream Capabilities

TxLINE documentation describes:

- fixtures snapshots
- scores snapshots
- odds snapshots
- current five-minute update caches
- historical five-minute interval updates
- scores SSE stream
- odds SSE stream
- fixture validation proofs
- fixture batch validation
- odds validation proofs
- score/stat validation proofs
- Solana-anchored Merkle roots
- guest JWT and activated API token authentication

## 2. Authentication Lifecycle

Required credentials:

- guest JWT from `/auth/guest/start`
- activated API token from `/api/token/activate`

Design:

1. credentials are loaded from secrets
2. JWT expiry is tracked
3. 401 causes one bounded JWT reacquisition path
4. API token activation is never performed automatically without an approved wallet transaction/signature flow
5. credentials are never logged
6. network/program/API host must match
7. authentication status is exposed only as booleans and expiry metadata

## 3. Client Expansion

The active client must add exact operations for:

### Fixtures

- snapshot by competition/all
- fixture validation proof
- fixture batch validation proof

### Scores

- snapshot by fixture and optional `asOf`
- current updates by fixture
- historical updates by day/hour/interval
- SSE stream
- score validation
- stat validation

### Odds

- snapshot by fixture and optional `asOf`
- current updates by fixture
- historical updates by day/hour/interval with optional fixture filter
- SSE stream
- odds validation
- batch validation where documented

## 4. SSE Requirements

A shared SSE parser must support:

- `id`
- `event`
- multi-line `data`
- `retry`
- blank-line message termination
- comments
- heartbeat events
- incomplete buffer at chunk boundary
- UTF-8 decoder streaming
- abort signal
- maximum message size
- malformed JSON isolation

Supervisor behavior:

- exponential backoff with jitter
- capped retry delay
- stable-connection reset
- heartbeat timeout
- metrics for connect/disconnect/message/error
- REST catch-up after reconnect
- no duplicate ingestion
- graceful shutdown

## 5. Checkpoints

Store per stream:

- stream kind
- last SSE event ID
- last provider timestamp
- last provider sequence/message ID
- last heartbeat timestamp
- connection status
- reconnect count
- last error category
- updated timestamp

Checkpoints are operational metadata, not public data.

## 6. Historical Backfill

TxLINE historical updates are partitioned into five-minute intervals.

Backfill planner input:

- UTC start/end
- target fixture(s)
- score/odds selection
- maximum interval count
- resume cursor

Backfill rules:

- deterministic interval enumeration
- bounded concurrency
- per-interval idempotence
- persist progress
- retry transient failures
- permanently record unavailable intervals
- never invent missing records
- support demo fixture replay preparation

## 7. Data Retention

Persist normalized history needed for:

- replay
- feature reconstruction
- training/evaluation
- audit
- proof lookup

Raw provider payload storage:

- disabled by default
- enabled only for controlled internal audit
- encrypted/retained for a bounded period
- never selected by public services
- must comply with TxLINE licensing terms

## 8. Odds Interpretation Policy

`TXLineStablePriceDemargined` is a consolidated StablePrice source.

Therefore:

- it counts as one provider source
- it must not be represented as independent multi-bookmaker consensus
- `Pct` values may be used only when valid and semantically mapped
- price arrays and selection names must remain aligned
- incomplete market selection sets are not demargined
- quarter-handicap `NA` percentages are treated as unavailable, not zero
- cross-time agreement may be measured separately from source diversity

## 9. Provider Data and Public Display

Public routes may show:

- normalized market label
- normalized selection label
- decimal price where product/legal policy permits
- high-level movement
- freshness
- reliability
- proof status

They must not show:

- raw provider records
- private credentials
- proof blobs
- unsupported bookmaker decomposition
- internal provider-quality weights

## 10. Proof Semantics

Maintain four explicit states:

- `unavailable`
- `proof_available`
- `proof_structurally_valid`
- `onchain_verified`

Never collapse these into a generic green “verified” badge.

Derived MatchPulse probabilities are not cryptographically verified merely because their source data is anchored.

## 11. License/Compliance Gate

Before a public deployment exposes raw odds or extensive historical data, the project owner must confirm that the intended display and retention comply with the applicable TxLINE license and terms.

The implementation must support a configuration flag that can restrict public market detail while retaining internal intelligence calculations.
