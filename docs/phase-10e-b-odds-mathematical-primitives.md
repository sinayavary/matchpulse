# Phase 10E-B — Odds Mathematical Primitives

## Status

Implementation pack version: `phase-10e-b-v1`

This phase adds deterministic, pure mathematical foundations. It does not add a final Odds Intelligence assessment, database service, route, worker, migration, frontend behavior, or public API.

## Inputs

The phase consumes only `NormalizedStoredOddsObservation` values produced by Phase 10E-A.

## Supported Complete Probability Markets

- `match_result_1x2`: home, draw, away
- `total_goals`: over, under
- `both_teams_to_score`: yes, no
- `asian_handicap`: home, away
- `next_goal`: home, none, away

`double_chance`, `correct_score`, and `unknown` remain unsupported for complete probability mathematics in this phase because the existing normalized selection contract does not define mutually exclusive complete selection identities for them.

## Snapshot Identity

A provider snapshot is grouped by:

- fixture ID
- canonical market key
- provider key, including explicit null
- effective observed timestamp

The effective timestamp is `source_timestamp` when available, otherwise `created_at`.

Input order does not affect output.

## Structural Status

- `complete`: required selections appear exactly once and no unexpected selections exist
- `incomplete`: one or more required selections are missing or an unexpected selection exists
- `ambiguous`: a selection appears more than once
- `unsupported`: no exact required selection set is defined

Only `complete` snapshots receive probability mathematics.

## Probability Mathematics

For decimal odds `o`:

```text
implied_probability = 1 / o
```

For one complete mutually exclusive market:

```text
implied_probability_sum = sum(implied_probability_i)
overround = implied_probability_sum - 1
fair_probability_i = implied_probability_i / implied_probability_sum
```

Internal values are not rounded.

## Provider Consensus

Each provider contributes at most one complete snapshot: its latest complete snapshot in the supplied collection.

`TXLineStablePriceDemargined` counts as one provider.

For each required selection:

1. collect provider fair probabilities
2. calculate the median
3. calculate median absolute deviation
4. calculate modified z-score using `0.6744897501960817`
5. mark outliers only with at least three provider values
6. exclude outliers only when at least two inliers remain
7. calculate the median of used provider values
8. normalize selection medians to a unit distribution

Default robust outlier threshold is `3.5`.

Provider dispersion is the arithmetic mean of selection-level median absolute deviations.

This is a mathematical primitive, not a claim that TxLINE StablePrice contains multiple independent bookmakers.

## Time Buckets

Time buckets are aligned to Unix epoch boundaries:

```text
bucket_start_ms = floor(observed_at_ms / window_ms) * window_ms
```

The window is an explicit caller input. This phase does not choose the production aggregation window.

## Movement

Probability changes use only observations at or before the target anchor.

```text
change_1m = latest_probability - anchor_probability_at_or_before(latest_time - 1m)
change_5m = latest_probability - anchor_probability_at_or_before(latest_time - 5m)
```

An anchor is accepted only within the explicit caller-provided tolerance.

Velocity:

```text
velocity = probability_change / elapsed_minutes
```

Acceleration compares the two latest interval velocities and divides by the distance between interval midpoints.

Future observations after `as_of` are excluded.

## Volatility and Jumps

Reported raw volatility primitives:

- population standard deviation
- mean absolute consecutive change
- root mean square consecutive change
- maximum absolute consecutive change

Jump detection uses an explicit caller-provided minimum absolute probability change.

This phase does not convert volatility into final reliability scores; that is Phase 10E-C.

## Security

The new modules contain no:

- raw provider payload
- credentials
- routes
- database reads
- model weights
- betting recommendations
- public API mapper

## Verification

The implementation contains 68 explicit focused tests:

- 48 market/probability/snapshot/consensus tests
- 20 temporal/volatility/anomaly tests

Required validation:

- TypeScript typecheck
- 68 focused tests
- Phase 10E-A normalization regression
- Odds contract regression
- full API suite
- no Prisma or migration changes
- no unauthorized workspace changes
