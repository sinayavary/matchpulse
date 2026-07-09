# Agent Runtime Assumptions

## Purpose

This document defines what MatchPulse Agent v1 is allowed to infer from verified TxLINE runtime data.

It exists to turn the runtime audit evidence into safe assumptions and to prevent future phases from overclaiming, overfitting, or treating sparse fields as dense signals.

## Runtime Evidence Snapshot

Verified runtime audit facts:

- audit status: `completed`
- requests: `3 attempted / 3 succeeded / 0 failed`
- fixtures payload available: yes
- scores payloads fetched: `35`
- odds payloads fetched: `31`
- warnings: empty
- latency mode: `historical_snapshot_age`

Fixture window caveat:

- `fixtureIds` contained `17952170` and `17588223`
- `targetFixtureIdsPresent` only included `17952170`
- this is expected because the fixture snapshot window was `competitionId=430/startEpochDay=20608`
- `17588223` is an odds validation target, not a fixture-window validation target for that snapshot

## Score Field Decisions

Allowed for Agent v1:

- `seq`
- `ts`
- `fixtureId`
- `gameState`
- `scoreSoccer` when present
- `dataSoccer` when present
- `possession` when present
- `possessionType` when present

Important interpretation rules:

- `possessionType` is sparse: `6/35` records, rate `0.1714`
- it must be treated as a discrete event/state flag, not as possession percentage
- it can support pressure or event-state hints
- it must not be treated as continuous pressure by itself
- missing `possessionType` means "no observed value in this record", not "neutral pressure"
- `possibleEvent` is not available in the verified runtime audit: `0/35`
- Agent v1 must not rely on `possibleEvent`

Forbidden score assumptions:

- no xG
- no shot quality
- no pass map
- no continuous possession percentage
- no player-level model
- no direct tactical dominance claim from sparse `possessionType` alone

## Odds Field Decisions

Allowed for Agent v1:

- `BookmakerId`
- `Bookmaker`
- `SuperOddsType`
- `InRunning`
- `MarketParameters`
- `MarketPeriod` when present
- `PriceNames`
- `Prices`
- `Pct`

Important interpretation rules:

- current verified classification is `single_stable_price_demargined`
- this should be described as a StablePrice/Demargined market view, not an independent multi-bookmaker consensus
- `Pct` rows with complete numeric values can be used as normalized implied probability candidates
- `Pct` rows containing `NA` must be excluded from probability calculations
- `Pct` sums are approximately `100` only for fully numeric rows
- `Pct` has a high `NA` rate: `43.75%`

Forbidden odds assumptions:

- no claim of true multi-bookmaker diversity from this audit
- no "sharp money" claim
- no match-fixing or suspicious-market language
- no market reliability score based on historical accuracy yet
- no calibrated probability model yet

## Agent v1 Allowed Outputs

Allowed:

- data availability summary
- market view summary
- score-state summary
- pressure hint based on sparse `possessionType`, clearly labeled as heuristic
- odds availability and `Pct` quality summary
- confidence labels based on data completeness, not prediction accuracy
- explainable "why this signal exists" text

Not allowed:

- betting recommendations
- bet execution
- "guaranteed" or "sure" predictions
- suspicious odds/fixing claims
- trained model claims
- historical accuracy claims
- user-facing "AI knows the outcome" framing

## Pressure Engine v1 Input Policy

Provisional v1 inputs:

- score changes
- `gameState`
- `seq`/timestamp ordering
- `possessionType` if present
- `possession` if present
- `scoreSoccer`/`dataSoccer` if present

Not usable:

- `possibleEvent`
- player-level events
- xG
- shot maps
- pass maps

Pressure v1 must be called:

```text
rule-based pressure hint
```

not:

```text
trained pressure model
```

## Odds Reliability v1 Input Policy

v1 reliability means:

```text
data reliability / market data completeness
```

not:

```text
prediction reliability
```

It may use:

- `Pct` numeric completeness
- `NA` rate
- `BookmakerId` presence
- market count
- `InRunning` availability
- timestamp availability

It must not use:

- historical profitability
- model calibration
- suspicious market language
- multi-bookmaker disagreement unless multiple bookmaker IDs are observed

## Scenario/Probability v1 Policy

- scenario output can be qualitative only at first
- probability should be disabled or labeled experimental unless derived directly from complete numeric `Pct` rows
- if using `Pct`-derived probability, explain it as market-implied probability, not model prediction
- do not combine sparse pressure hints and odds into a fake calibrated probability

## Demo/Presenter Language Rules

Use:

- `market-implied view`
- `data completeness`
- `rule-based pressure hint`
- `available signal`
- `not enough data`
- `experimental`

Avoid:

- `guaranteed`
- `suspicious`
- `sharp money`
- `fixed match`
- `trained model`
- `highly accurate prediction`
- `AI betting tip`

## Next Implementation Gates

Pressure Engine gate:

- needs replay sample with ordered score records
- needs documented scoring weights
- needs debug lineage

Odds Reliability gate:

- needs explicit reliability definition
- must start as data-quality reliability
- must avoid historical accuracy language

Scenario Engine gate:

- needs explainable inputs
- must output qualitative scenarios first

Learning Layer gate:

- blocked until sufficient historical labeled data exists

## Final Decision Table

| Component | Status | Reason |
| --- | --- | --- |
| Runtime Audit | Approved | clean targeted audit |
| Score Data | Approved with sparsity limits | 35 records, `possessionType` sparse |
| Odds Data | Approved with single-source/demargined limits | 31 records, `StablePriceDemargined` |
| PossibleEvent | Blocked | `0/35` present |
| Pressure v1 | Allowed as heuristic | sparse but usable state flags |
| Odds Reliability v1 | Allowed as data-quality reliability | no historical accuracy yet |
| Probability v1 | Limited | only market-implied `Pct` rows |
| Learning Layer | Blocked | no labeled history |
