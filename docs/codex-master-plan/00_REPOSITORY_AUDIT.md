# 00 — Repository Audit

## 1. Audited Baseline

- Repository: `sinayavary/matchpulse`
- Branch: `main`
- Baseline commit: `39e8dd92144b783fc9582b62b37b37a7ed657d4e`
- Latest completed capability: deterministic odds market normalization, Phase 10E-A
- Verified local quality state reported by the project owner:
  - TypeScript typecheck passed
  - Odds normalization tests: 60/60
  - Odds contract tests: 60/60
  - Full API tests: 730/730
  - No Prisma or migration changes in 10E-A

## 2. Workspace Shape

The repository is a pnpm/Turbo monorepo:

- `apps/api`: Fastify API, data ingestion, intelligence contracts, storage, public/internal routes
- `apps/web`: Next.js web application
- `apps/worker`: independent worker process
- `packages/shared`: shared types/utilities
- `packages/txline-client`: TxLINE/Solana integration package
- `prisma`: database schema, migrations, seed
- `docs`: historical and phase documentation

## 3. Implemented and Usable Foundations

### 3.1 TxLINE HTTP snapshots

Real HTTP support exists for:

- fixtures snapshots
- score snapshots
- odds snapshots
- historical snapshot lookup using `asOf`

The active implementation is in `packages/txline-client/src/live.ts`.

### 3.2 Ingestion and canonical storage

Implemented:

- fixture normalization and persistence
- score snapshot normalization and persistence
- odds mapping and persistence
- event normalization and persistence
- canonical match-state builder
- runtime target refresh worker
- bounded internal ingestion routes
- database health and seed verification

### 3.3 Product-safety layers

Implemented:

- internal route authentication
- recursive forbidden-field checks
- public-safe API sanitization
- safe Product Agent output
- safe event-impact mapping
- safe Telegram message contract
- no raw provider payloads in public routes
- no direct betting execution or wallet exposure

### 3.4 Intelligence foundations

Implemented:

- data readiness/freshness signals
- SignalCore v0
- heuristic pressure adapter
- heuristic event-impact assessment
- basic odds reliability foundation
- product presenter and product intelligence mapping

These are not the final prediction engines.

### 3.5 Final prediction contracts and storage

Implemented:

- final prediction domain contracts and validation
- prediction feature bundle builder
- odds intelligence internal/public contracts
- feature snapshots
- odds intelligence persistence
- prediction snapshot persistence
- specialist contribution persistence
- label revision persistence
- evaluation persistence
- feature, label, dataset, and model registries
- deterministic content hashing
- immutable/idempotent storage behavior

The migration creating permanent prediction tables exists but must be applied only through an explicitly approved database operation.

### 3.6 Phase 10E-A

Implemented and pushed:

- stored odds observation contract
- market ID parsing
- conservative market type normalization
- selection normalization
- line extraction
- deterministic canonical market keys
- timestamp and decimal-odds validation
- 60 explicit normalization tests

## 4. Major Gaps

### 4.1 No final Odds Intelligence engine

The repository has contracts, storage, and normalization, but no complete engine that calculates:

- complete market reconstruction
- implied probabilities
- overround
- fair probabilities
- temporal consensus
- movement velocity and acceleration
- volatility
- anomalies/outliers
- event consistency
- component scores
- reliability gates
- recommended market model weight
- deterministic assessment identity

### 4.2 No final inference engine

Prediction contracts exist, but there is no runtime engine producing validated predictions from stored data. Current `live-prediction-agent` uses neutral defaults and is explicitly not the final inference layer.

Missing:

- state specialist
- scoreline/hazard specialist
- tempo/event specialist
- market specialist
- deterministic ensemble
- phase-aware calibration
- fallback hierarchy
- inference orchestrator
- trigger and sequence policy

### 4.3 No complete live ingestion topology

The worker currently refreshes configured snapshot targets. Missing:

- scores SSE client
- odds SSE client
- SSE parser and heartbeat handling
- reconnect/backoff
- resume/cursor strategy
- current five-minute update catch-up
- historical five-minute interval backfill
- multi-fixture scheduling
- overlap prevention across processes
- token refresh/reacquisition after 401
- ingestion checkpoints
- dead-letter/error audit

### 4.4 No complete replay/backtest

Current replay is in-memory and based on a very small seed timeline. Missing:

- database-backed historical replay
- merged score/event/odds timeline
- deterministic clock
- prediction regeneration at each replay point
- assessment/prediction comparison
- label generation
- evaluation metrics
- calibration curves
- stability/oscillation analysis

### 4.5 No real Telegram system

A safe message mapper exists, but missing:

- bot commands
- webhook or polling transport
- subscriptions
- alert deduplication
- delivery log
- retry policy
- quiet/silent conditions
- application deep links

### 4.6 No proof-verification product feature

Missing:

- TxLINE validation clients
- fixture proof retrieval
- odds proof retrieval
- score/stat proof retrieval
- verification metadata storage
- safe public verification status
- UI badge/details
- on-chain verification adapter or clearly labeled off-chain proof availability

### 4.7 Frontend is behind backend

The current public web experience is primarily:

- match browser
- match detail
- data quality
- brief
- signals
- raw JSON debugging

Missing final surfaces:

- live prediction room
- scenario probability cards
- probability history
- market movement chart
- reliability explanation
- momentum/event-impact timeline
- replay controls
- prediction evaluation
- verification badge
- watchlist and Telegram subscription
- system status and graceful degraded modes

Frontend public API types are also behind the newer backend route contracts.

### 4.8 CI is insufficient

Current CI only runs typecheck.

Required gates:

- install with frozen lockfile
- Prisma format/validate/generate
- typecheck
- all API tests
- web build
- worker build
- lint/format checks
- migration destructive scan
- forbidden-key scan
- secret scan
- deterministic replay smoke test

## 5. Documentation Problems

The repository contains stale documents that claim workers and prediction infrastructure do not exist. They conflict with current code and cannot remain authoritative.

Required action:

- preserve old phase docs as historical evidence
- create one canonical current-state document
- label stale docs as archived or superseded
- make `AGENTS.md` and the active phase pack the only Codex execution authority

## 6. Local Workspace Risk

The project owner reported unrelated uncommitted local work, including frontend and workspace files. Therefore every implementation prompt must:

- preserve all unrelated changes
- never use `git reset --hard`
- never use `git clean`
- never use `git checkout -- .`
- never stash or restore automatically
- list the exact allowed paths
- abort on overlap with an unapproved local change

## 7. Compliance Findings

- The product must not use FIFA logos, protected marks, or imply official affiliation.
- Public output must remain informational sports intelligence.
- No stake, payout, value-bet, expected-value, or bet-placement features.
- Raw TxLINE provider data and credentials must not be publicly redistributed.
- The official hackathon terms require human participation and may disqualify submissions materially controlled by an autonomous agent.
- Eligibility requirements must be verified by the project owner before submission, including the stated minimum participant age.
- Judges must be able to evaluate the project without purchasing tokens, subscriptions, software, or third-party accounts.

## 8. Audit Conclusion

MatchPulse already has a strong backend foundation and unusually mature contract/storage safety. It is not yet a complete final product because the core intelligence calculations, live streaming, runtime inference, final frontend, Telegram delivery, proof experience, and deployment hardening are incomplete.

The correct strategy is to preserve existing contracts and build the missing engines and orchestration behind versioned interfaces rather than replacing the repository.
