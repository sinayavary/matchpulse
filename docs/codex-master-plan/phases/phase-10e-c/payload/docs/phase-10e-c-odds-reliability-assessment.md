# Phase 10E-C — Odds Reliability and Assessment

## Scope

This phase turns normalized stored odds observations plus the mathematical and
temporal primitives from Phase 10E-B into the permanent internal Odds
Intelligence v1 assessment and its public-safe representation.

This phase is pure and deterministic. It does not read from Prisma, call a
network, create a route, run a worker, apply a migration, or change frontend
code.

## Inputs

`assessOddsIntelligence` accepts:

- one non-empty fixture ID
- one canonical `generated_at` timestamp
- normalized stored odds observations
- optional per-market event-consistency evidence:
  - `market_key`
  - bounded score in `[0,1]`
  - explicit critical flag

All observation timestamps must be valid and no later than `generated_at`.
Fixture mismatch, invalid decimal odds, invalid timestamps, and future
timestamps create an internal `invalid` assessment with zero model influence.

## Deterministic ordering and identity

Observations are canonicalized and sorted by fixture, market key, observed
timestamp, provider, selection, sequence, odds, and creation timestamp.

Exact duplicate normalized rows are removed and recorded as
`duplicate_snapshot`.

The assessment ID is:

`odds-assessment-v1:<sha256>`

The canonical SHA-256 input includes:

- policy version
- fixture ID
- generated timestamp
- sorted deduplicated observations
- sorted duplicate-market keys
- sorted event-consistency evidence

Input permutation therefore cannot change the assessment or its ID.

## Current market reconstruction

For each canonical market key:

1. reconstruct provider/timestamp snapshots
2. select the latest snapshot for every distinct provider
3. retain only latest provider snapshots that are structurally complete
4. calculate robust current consensus from those eligible snapshots
5. choose a deterministic canonical complete snapshot for fair probabilities
   and overround
6. keep incomplete or unsupported markets visible internally but unusable when
   hard gates apply

An older complete snapshot is not silently substituted for a provider whose
latest snapshot is incomplete.

## Time-series reconstruction

Provider snapshots are grouped into epoch-aligned one-minute buckets.

Each bucket produces a robust consensus when possible. For every current
selection the engine calculates:

- one-minute probability change
- five-minute probability change
- per-minute velocity
- per-minute-squared acceleration
- volatility metrics
- probability jumps

Temporal anchors allow 90 seconds of tolerance. Velocity and acceleration do
not bridge gaps larger than two minutes.

## Fixed policy thresholds

All exact policy values are private internal implementation details and are
never returned by the public mapper.

- fresh age: at most 90 seconds
- aging age: at most 5 minutes
- soft-stale age: at most 15 minutes
- hard-stale age: more than 30 minutes
- provider-disagreement dispersion: `0.025`
- hard provider-dispersion gate: `0.08`
- abnormal probability jump: `0.08`
- hard abnormal-jump gate: `0.18`
- minimum usable reliability: `0.40`
- reliable threshold: `0.65`
- high-confidence threshold: `0.85`

## Component scores

Every market receives exactly these bounded component scores:

- structural validity
- freshness
- market completeness
- provider quality
- provider consensus
- dispersion quality
- movement integrity
- event consistency
- historical support
- overall reliability

### Structural validity

`0.6 × current-provider completeness + 0.4 × historical snapshot completeness`

Conflicting market types or lines under one canonical market key force zero.

### Freshness

- `1.00` inside 90 seconds
- `0.85` through 5 minutes
- `0.60` through 15 minutes
- `0.35` through 30 minutes
- `0.00` beyond 30 minutes

### Provider coverage

- no provider: `0`
- one provider: `0.45`
- two providers: `0.70`
- three providers: `0.85`
- four or more providers: `1.00`

Provider quality is coverage multiplied by current-provider completeness.

### Provider consensus

`0.45 × provider coverage + 0.55 × dispersion quality`

Dispersion quality is:

`clamp(1 - provider_dispersion / 0.08, 0, 1)`

### Volatility

For each selection:

`0.40 × (population standard deviation / 0.04)`
`+ 0.35 × (RMS change / 0.03)`
`+ 0.25 × (maximum absolute change / 0.08)`

The selection value is clamped to `[0,1]`; market volatility is the mean.

### Anomaly score

The market anomaly score is the bounded maximum of:

- maximum jump divided by `0.18`
- excluded-provider ratio
- provider dispersion divided by `0.08`

### Movement integrity

`clamp(1 - 0.65 × volatility - 0.35 × anomaly, 0, 1)`

### Event consistency

- exact supplied bounded score when available
- neutral `0.50` when absent
- issue below `0.40`
- critical evidence is a hard gate

### Historical support

- 0 points: `0`
- 1 point: `0.15`
- 2 points: `0.30`
- 3–4 points: `0.45`
- 5–9 points: `0.65`
- 10–19 points: `0.85`
- 20 or more points: `1.00`

### Overall reliability

Weighted deterministic sum:

- structural validity: `0.18`
- freshness: `0.16`
- market completeness: `0.14`
- provider quality: `0.10`
- provider consensus: `0.10`
- dispersion quality: `0.08`
- movement integrity: `0.10`
- event consistency: `0.08`
- historical support: `0.06`

Weights total exactly `1.00`.

## Hard gates

A market is unusable when any of these applies:

- conflicting market identity or line
- unsupported probability market
- no current complete consensus
- no deterministic current canonical snapshot
- hard staleness
- provider dispersion at or above `0.08`
- probability jump at or above `0.18`
- critical event inconsistency
- reliability below `0.40`

Unusable markets always have model weight zero.

## Reliability labels and model caps

- below minimum or hard-gated: `unreliable`
- usable baseline: `limited`
- at least `0.65`, at least two providers, and at least three history points:
  `reliable`
- at least `0.85`, at least three providers, at least ten history points, and no
  issues: `high_confidence`

Recommended market-model influence is an upper bound:

- limited: `min(0.12, score × 0.15)`
- reliable: `min(0.22, score × 0.25)`
- high confidence: `min(0.32, score × 0.35)`
- all unusable states: `0`

It is not a betting recommendation.

## Root assessment

The root context aggregates markets with conservative fixed market priorities.

- match result 1X2: `2.0`
- totals and both-teams-to-score: `1.0`
- Asian handicap and next goal: `0.75`
- unsupported markets: `0`

The primary match-result market must be complete and usable. Selection is
deterministic by reliability, latest timestamp, then market key.

The root model weight is a weighted average of usable market caps. Without a
usable primary 1X2 market it is capped at `0.15`.

## Public-safe mapper

The public mapper returns only:

- qualitative availability and reliability
- freshness band
- provider coverage band
- provider agreement band
- volatility band
- market/provider counts
- at most three qualitative movements
- concise summary
- limitations
- last update
- the exact safety note from the existing contract

It excludes:

- assessment ID
- exact fair and consensus probabilities
- component scores
- internal model weights
- provider identities
- raw observations
- formulas and thresholds
- debug lineage

## Test coverage

The two focused test files contain 72 tests covering:

- invalid and unavailable states
- exact component arithmetic
- freshness bands
- hard gates
- incomplete markets
- provider disagreement and outliers
- temporal changes, velocity, acceleration, volatility, and jumps
- event consistency
- root aggregation and primary selection
- assessment-ID determinism and permutation invariance
- no input mutation
- public mapping, qualitative bands, safety note, and forbidden-field absence

## Explicit exclusions

- no Prisma reader
- no persistence
- no route
- no worker
- no migration
- no live network
- no frontend
- no Telegram
- no prediction ensemble
