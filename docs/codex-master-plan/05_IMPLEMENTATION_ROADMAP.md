# 05 — Implementation Roadmap

Each milestone requires a separate exact implementation pack and human activation through `ACTIVE_PHASE.json`. Codex executes only the repository-selected active milestone. A new long phase prompt is not required.

## Gate 0 — Canonical Governance and Compliance

Deliver:

- root `AGENTS.md`
- canonical status document
- stale-doc labeling
- decision register
- exact Codex safety rules
- repository-controlled active-phase orchestration
- eligibility and data-license checklist
- repository visibility verification
- local workspace collision check

No production behavior change.

## Gate 1 — Database Readiness

Deliver:

- review permanent prediction migration
- Prisma validate/generate
- backup/restore instructions
- apply migration to approved Neon development database
- post-migration schema smoke tests
- registry seed plan

Human approval required before applying migration.

## Phase 10E-B — Odds Mathematical Primitives

Deliver exact code/tests for:

- market snapshots
- complete selection set validation
- implied probabilities
- overround
- fair probability
- robust aggregation
- temporal grouping
- movement metrics
- volatility/anomaly primitives

No DB, routes, worker, or frontend.

## Phase 10E-C — Odds Reliability and Assessment

Deliver:

- component scores
- hard gates
- market usability
- root assessment
- deterministic assessment ID
- internal contract builder integration
- public-safe mapper

No DB service yet.

## Phase 10E-D — Odds DB Service and Persistence

Deliver:

- bounded Prisma reader
- no `raw` selection
- Decimal/date conversion
- stable ordering
- engine invocation
- existing Phase 10D storage integration
- idempotent persistence
- service tests

## Phase 10F — TxLINE Complete Client

Deliver:

- current updates
- historical interval updates
- SSE parser/client
- proof endpoints
- auth/JWT lifecycle
- retry/error taxonomy
- unit tests with no real network

## Phase 10G — Streaming Ingestion and Backfill

Deliver:

- stream checkpoints
- scores supervisor
- odds supervisor
- reconnect/catch-up
- historical backfill planner
- multi-fixture target planner
- ingestion locks
- worker health
- normalized persistence
- integration tests

## Phase 10H — Prediction Engine

Deliver:

- state specialist
- scoreline specialist
- tempo/event specialist
- market specialist
- ensemble
- confidence/risk
- explanation factors
- deterministic IDs
- exhaustive numeric and invariant tests

## Phase 10I — Runtime Prediction Orchestrator

Deliver:

- trigger policy
- consistent `as_of` reads
- feature snapshot
- odds assessment
- inference
- transactional/ordered persistence
- duplicate suppression
- internal routes
- worker integration

## Phase 10J — Labels, Evaluation, Backtest, Calibration

Deliver:

- historical replay builder
- labels
- evaluations
- calibration buckets
- stability metrics
- dataset manifests
- model registry lifecycle
- post-match job

## Phase 10K — Public Prediction API

Deliver:

- versioned DTO
- public-safe mapper
- history endpoint
- bounded pagination
- degraded fallback
- recursive forbidden-field tests
- backward compatibility

## Phase 10L — Final Web Experience

Deliver:

- synced frontend API client
- match browser
- intelligence room
- probability and market charts
- explanation/limitations
- history
- replay
- verification
- responsive/mobile
- loading/error/stale states
- no protected branding

Must reconcile existing local frontend work before exact patches are generated.

## Phase 10M — Watchlist and Telegram

Deliver:

- subscription storage
- commands
- webhook verification
- alert policy
- deduplication
- retries and delivery log
- deep links
- no betting language

## Phase 10N — TxLINE/Solana Verification

Deliver:

- proof retrieval
- structural validation
- optional approved on-chain check
- proof metadata persistence
- public status
- UI badge with exact semantics

## Phase 10O — Production Hardening

Deliver:

- CI quality gates
- secret scan
- migration check
- rate limiting
- CORS policy
- structured logs
- health/readiness
- graceful shutdown
- deployment manifests
- backup/retention
- observability

## Phase 10P — Demo and Submission

Deliver:

- complete replay dataset
- one-click demo path
- evaluator credentials/configuration
- 5-minute demo script
- architecture summary
- attribution
- compliance checklist
- no-cost evaluator path
- final smoke test

## Definition of Done

All phases are complete only when:

- real data can enter through TxLINE
- replay works without live availability
- predictions are generated and persisted
- public APIs are safe
- web experience is complete
- Telegram delivery works
- provenance is correctly represented
- tests and CI pass
- deployment is reproducible
- evaluator requires no payment or wallet setup
