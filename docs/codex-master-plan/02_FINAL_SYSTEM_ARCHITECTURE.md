# 02 — Final System Architecture

## 1. Architectural Principles

1. **Database is the canonical runtime source.**
   TxLINE is an upstream provider; public APIs never call TxLINE directly.

2. **Ingestion and intelligence are separated.**
   Provider parsing and persistence must not calculate product predictions.

3. **Every calculation is deterministic for identical input/version.**

4. **Contracts precede implementations.**
   Public and internal contracts remain validated at runtime.

5. **Version everything that affects predictions.**
   Feature version, label version, model version, ensemble version, calibration version, odds intelligence version, contract version.

6. **Public mapping is a separate layer.**
   Internal rich objects never leak directly.

7. **One bad message never stops the stream.**

8. **Degraded data produces bounded degraded output, not invented values.**

9. **Backward compatibility is preserved through versioned routes.**

10. **Codex never makes architectural decisions.**

## 2. Target Runtime Topology

```text
TxLINE REST + SSE
        |
        v
packages/txline-client
  auth lifecycle
  snapshots
  current updates
  historical updates
  SSE
  proof endpoints
        |
        v
apps/worker
  fixture planner
  stream supervisors
  catch-up/backfill
  normalized ingestion
  checkpoints
  trigger queue
        |
        v
Neon PostgreSQL
  raw-safe normalized history
  canonical state
  assessments
  predictions
  labels/evaluations
  subscriptions/delivery
  proof metadata
        |
        +-----------------------+
        |                       |
        v                       v
apps/api                    offline jobs
 internal engines           replay/backtest
 public-safe routes         label/evaluation
        |
        v
apps/web + Telegram
```

## 3. Process Boundaries

### API process

Responsibilities:

- public reads
- internal authenticated reads
- explicit admin/manual jobs
- contract validation
- public-safe mapping
- health/readiness
- no long-lived TxLINE streams

### Worker process

Responsibilities:

- TxLINE token lifecycle
- fixture scheduling
- REST catch-up
- SSE streams
- ingestion checkpoints
- event-driven intelligence calculation
- prediction generation
- label/evaluation jobs
- alert dispatch
- proof retrieval jobs

### Web process

Responsibilities:

- public-safe rendering
- polling or server-streaming from MatchPulse API
- no TxLINE credentials
- no model internals
- no direct database access

## 4. Internal Module Boundaries

### Provider layer

`packages/txline-client`

- authentication
- HTTP transport
- SSE transport
- retries and timeouts
- schemas and raw provider types
- no Prisma
- no product intelligence

### Normalization layer

`apps/api/src/txline-*normalizer*`
and dedicated odds normalization

- conservative field extraction
- orientation handling
- timestamp normalization
- provider message identity
- no predictions

### Persistence layer

- idempotent upserts
- sequence/timestamp uniqueness
- no silent repair of corrupt data
- explicit transactions

### Canonical state layer

- latest confirmed state
- freshness
- completeness
- event and market coverage
- no product prose

### Intelligence layer

- pressure
- event impact
- odds intelligence
- scenario specialists
- ensemble
- confidence/risk
- explanations

### Orchestration layer

- determines triggers
- reads a consistent snapshot
- computes assessment/features/prediction
- persists atomically where required
- publishes a safe update event

### Public layer

- versioned DTOs
- recursive safety scan
- bounded arrays/text
- no internal formulas or raw rows

## 5. Consistency Model

Each intelligence cycle uses:

- fixture ID
- `as_of`
- latest accepted score/event/odds sequence at or before `as_of`
- deterministic feature snapshot ID
- deterministic odds assessment ID
- deterministic prediction snapshot ID
- explicit trigger

A prediction may never combine future rows with an earlier `as_of`.

## 6. Trigger Policy

Generate a new intelligence cycle on:

- score change
- match phase change
- material event
- meaningful market movement
- periodic heartbeat while live
- replay clock step
- explicit manual rebuild

Suppress duplicates when the canonical feature hash and odds assessment hash have not changed.

## 7. Caching

Initial production architecture:

- PostgreSQL remains source of truth
- optional Upstash Redis only for:
  - short-lived public route cache
  - distributed worker lock
  - alert deduplication
- the product must remain correct without Redis
- no critical history lives only in Redis

## 8. Availability Strategy

- public API returns last known state with freshness metadata
- stream failure triggers REST catch-up
- REST failure leaves stored data available as stale
- prediction engine falls back to state-only mode when odds are unusable
- public response clearly communicates missing/limited data
- no upstream error body is leaked

## 9. Versioned Public API Direction

Preserve existing routes.

Add a new versioned product surface rather than mutating old DTOs:

- `GET /api/public/v1/matches`
- `GET /api/public/v1/matches/:fixtureId`
- `GET /api/public/v1/matches/:fixtureId/intelligence`
- `GET /api/public/v1/matches/:fixtureId/history`
- `GET /api/public/v1/matches/:fixtureId/replay-manifest`
- `GET /api/public/v1/matches/:fixtureId/verification`
- `POST /api/public/v1/watchlist`
- Telegram endpoints remain internal/webhook-protected

Exact contracts will be supplied in a dedicated implementation pack.

## 10. Deployment Target

Recommended:

- Web: Vercel
- API: Railway/Fly/Render or equivalent long-running Node service
- Worker: separate long-running Railway/Fly service
- Database: Neon PostgreSQL
- Optional cache/lock: Upstash Redis
- Secrets: platform environment secret store
- Devnet for hackathon source activation unless mainnet free tier is explicitly selected and tested

No evaluator should need to supply a wallet or buy tokens.
