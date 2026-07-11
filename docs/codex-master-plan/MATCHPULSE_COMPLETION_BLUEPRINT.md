# MatchPulse Completion Blueprint

> Status: review-only architecture source. This document does not activate a phase, modify `ACTIVE_PHASE.json`, or change `PHASE_QUEUE.json`.
>
> Source baseline: `8a75e61d4accf4bb67ee4c12fffaad173e4267fd`

## 1. Product boundary

MatchPulse is a protected live scenario intelligence engine. It consumes canonical TxLINE fixture, score, event, odds, history, freshness, and proof-state data, then produces bounded sports-intelligence scenarios.

It is not a betting product. The following remain prohibited across every phase:

- bet execution or wagering instructions
- stake, payout, profit, expected-value, or recommended-bet fields
- public provider decomposition
- public model coefficients, thresholds, formulas, or weights
- wallet requirements for normal users
- unsupported claims that a derived prediction is cryptographically verified

## 2. Permanent architecture

```text
TxLINE auth / transport
        ↓
validated REST + SSE client
        ↓
stream supervisor + deterministic catch-up
        ↓
canonical persisted match timeline
        ↓
feature assembly and quality gates
        ↓
private specialist policy outputs
        ↓
prediction composition engine
        ↓
labels / evaluation / calibration
        ↓
public-safe scenario mapper
        ↓
API, web experience, notifications
```

### Trust boundaries

1. **Provider boundary**: credentials and raw payloads remain backend-only.
2. **Canonical boundary**: normalization must be deterministic, idempotent, and replayable.
3. **Model boundary**: private specialist weights and formulas are injected at runtime and never committed to the public repository.
4. **Public boundary**: only sanitized probabilities, quality labels, verification state, and short explanations leave the backend.
5. **Operator boundary**: subscription, activation, proof checks, and production controls are owner/operator functions.

## 3. Dependency graph

```text
10F-C TxLINE client lifecycle
 ├── 10G-A stream supervisor foundation
 │    ├── 10G-B catch-up / checkpoints / dedupe
 │    └── 10G-C persistence integration [Gate 1]
 ├── 10H-A prediction composition engine
 │    ├── 10H-B feature assembly contracts
 │    └── 10H-C private policy adapter boundary
 └── 10N-A proof transport and structural validation

10E-D odds persistence [Gate 1]
10G-C ingestion persistence [Gate 1]
10H-A/B/C prediction engine
        ↓
10I runtime prediction orchestrator [Gate 1]
        ↓
10J labels, evaluation, replay, calibration
        ↓
10K public prediction API [Human public-contract gate]
        ↓
10L final web experience [Human UX/public-contract gate]
        ↓
10M watchlist and Telegram [Human notification gate]
        ↓
10N-B on-chain proof verification [Human network/Solana gate]
        ↓
10O production hardening [Human deployment/security gate]
        ↓
10P demo/submission release [Human release gate]
```

## 4. Phase specifications

### 10F-C — TxLINE client lifecycle and regression closure

Current repository-selected phase. Complete and publish it before activating another product phase.

Definition of done:

- bounded retry only for approved transient errors
- at most one guest-JWT refresh per operation
- same-host SSE path enforcement
- input validation before transport
- complete package and API regression tests
- no network, migration, successor activation, or push before explicit review

### 10G-A — Stream supervisor foundation

Purpose: supervise score and odds streams without persistence.

Required behavior:

- explicit lifecycle states: `idle`, `connecting`, `live`, `recovering`, `stopping`, `stopped`, `failed`
- bounded exponential reconnect before any post-connect data loss decision
- heartbeat deadline and inactivity detection
- `AbortSignal` support and graceful shutdown
- injectable clock, sleeper, and stream opener
- deterministic status events
- no database, route, production network, or credentials in logs

Suggested targets:

- `packages/txline-client/src/stream-supervisor.ts`
- `packages/txline-client/src/stream-supervisor.test.ts`
- package exports and focused documentation

### 10G-B — Catch-up, checkpoints, and deduplication

Purpose: make reconnect behavior loss-aware.

Required behavior:

- checkpoint contract based on provider event identity, timestamp, and sequence
- REST catch-up window derived from the last accepted checkpoint
- deterministic dedupe across stream and catch-up payloads
- monotonic checkpoint advancement
- bounded replay window
- duplicate, gap, stale, and regression diagnostics
- no persistence until Gate 1

### 10G-C — Ingestion persistence integration

Gate: database readiness and approved development migration.

Required behavior:

- transactionally persist canonical timeline items and checkpoints
- idempotency keys and unique constraints
- no raw provider payload by default
- retention and audit policy
- restart recovery tests
- pre/post migration checks

### 10E-D — Odds persistence service

Gate: database readiness and approved development migration.

Required behavior:

- normalized odds observation persistence
- deterministic latest-provider selection
- indexed fixture/market/time access
- assessment snapshots linked by content hash
- no provider internals in public contracts

### 10H-A — Prediction composition engine

Purpose: build the deterministic internal composition boundary without committing proprietary policy.

Required behavior:

- accept specialist outputs with runtime-injected assigned weights
- validate all distributions and timestamps
- enforce odds market-weight caps supplied by odds reliability assessment
- blend target distributions deterministically
- project goal horizons to monotonic values
- merge scoreline distributions deterministically
- require explicit fallback behavior when a target has no usable specialist
- build the existing `FinalPredictionSnapshot` contract
- expose no hard-coded private coefficients or provider weights
- no DB, route, worker, network, or migration

A complete review-only source pack for this phase is included in this branch.

### 10H-B — Feature assembly contracts

Purpose: convert canonical state into versioned, hashable model features.

Required behavior:

- fixture identity, score, phase, minute, score difference
- event summaries and context-dependent event-impact references
- odds intelligence reference, not raw observations
- freshness, coverage, missing fields, and verification states
- stable ordering and content hash
- no private policy coefficients
- replay-equivalent feature output for equivalent canonical timelines

### 10H-C — Private policy adapter boundary

Purpose: isolate proprietary policy from the public repository.

Required behavior:

- interface for specialist inference providers
- runtime-only private configuration reference
- secret-safe loading and validation
- no policy values in logs, API responses, snapshots, or Git
- deterministic mock adapter for tests
- explicit unavailable/degraded behavior

### 10I — Runtime prediction orchestrator

Dependencies: 10E-D, 10G-C, 10H-A/B/C, Gate 1.

Required behavior:

- trigger snapshots on initial state, timer, score, goal, red card, phase, odds movement, event batch, and replay
- idempotent snapshot identity
- fetch canonical state and latest quality/odds assessments
- run private specialists and composition engine
- persist snapshot and registry atomically
- bounded concurrency per fixture
- stale-work cancellation
- no public route in this phase

### 10J — Labels, evaluation, replay, and calibration

Required behavior:

- derive labels only from finalized canonical timelines
- next-goal and horizon labels using strict temporal ordering
- final-outcome, scoreline, survival, and momentum labels
- log loss, Brier score, calibration error, accuracy, precision/recall where applicable
- segmentation by competition, phase, minute range, score state, coverage, and model version
- walk-forward replay; no future-data leakage
- calibration artifacts versioned and private

### 10K — Public prediction API

Gate: explicit public-contract approval.

Required behavior:

- versioned public response contract
- probabilities rounded for presentation while preserving valid totals
- short safe explanation and limitations
- data quality and verification state
- no feature hash, specialist contribution, assigned weight, provider identity, internal confidence components, raw payload, or proof blob
- bounded pagination and safe `no_data`/degraded responses
- rate limiting and response sanitization

### 10L — Final web experience

Gate: explicit UX/public-contract approval.

Required behavior:

- live match list and detail view
- scenario probability presentation
- freshness, data-quality, and verification indicators
- timeline and movement summaries without provider decomposition
- accessible loading, no-data, stale, degraded, and error states
- no gambling language or wallet requirement

### 10M — Watchlist and Telegram

Gate: explicit notification approval.

Required behavior:

- user-controlled watchlist
- notification dedupe and cooldown
- material-change threshold supplied by private policy, not public code
- sanitized message templates
- unsubscribe and failure handling
- no odds-provider or model-internal leakage

### 10N — Verification

Gate: explicit network, Solana, and operator approval.

Required behavior:

- distinguish `unavailable`, `proof_available`, `proof_structurally_valid`, and `onchain_verified`
- validate fixture, odds, and score-stat proof structure offline first
- perform on-chain verification only in the approved network mode
- never label derived prediction as on-chain verified
- no proof blob in public API

### 10O — Production hardening

Gate: explicit deployment/security approval.

Required behavior:

- threat model and secret inventory
- HTTPS, trusted proxy, CORS, rate limits, body limits, and internal authentication
- structured logs with redaction
- metrics, tracing, health, readiness, and dependency status
- backup/restore and migration rollback procedure
- load, soak, reconnect, replay, and failure-injection tests
- dependency and container scanning

### 10P — Demo/submission release

Gate: explicit release approval.

Required behavior:

- reproducible seeded demo mode
- production-safe environment templates
- operator runbook
- architecture, security, verification, and limitations documentation
- smoke-test checklist
- release tag and immutable commit references

## 5. Cross-phase invariants

Every phase pack must declare:

- exact baseline commit
- exact allowed target files
- required validation commands
- expected outcomes
- migration and network permissions
- exact commit message
- publish permission

Every implementation phase must preserve:

- unrelated local work
- `PHASE_QUEUE.json` during execution
- no successor activation
- no unapproved migrations or network calls
- no public/internal contract leakage
- no secrets in errors or logs

## 6. Recommended activation sequence

1. Complete, review, and publish 10F-C.
2. Merge this blueprint as architecture-only documentation after review.
3. Review the included 10H-A source pack independently.
4. Build and review 10G-A source pack.
5. Activate exactly one approved phase at a time.
6. Keep Gate 1 phases blocked until database approval.
7. Prefer 10H-A before Gate 1 because it is pure and independent.
8. Run 10G-A/B without persistence while Gate 1 remains blocked.
9. After Gate 1, execute 10E-D and 10G-C, then 10I.
10. Cross public, notification, network, deployment, and release gates only with separate human approval.

## 7. Completion standard

The project is complete only when:

- live ingestion is supervised, loss-aware, and restart-safe
- canonical state and prediction snapshots are persisted and replayable
- scenario outputs are evaluated and calibrated
- public responses are safe and versioned
- web and notifications handle degraded data honestly
- proof status is accurate and non-misleading
- production controls, runbooks, monitoring, and rollback exist
- no proprietary model policy or provider credential is exposed
