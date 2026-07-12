# 07 — Competition Release Track and Future Production Track

## Decision

MatchPulse is split into two sequential delivery tracks from the current repository state. This is an additive architecture change. No completed phase is reverted, no contract is discarded, and no production capability is removed.

1. **Competition Release Track** — deliver a complete but deliberately limited prediction product quickly.
2. **Future Production Track** — replace and extend internal specialists, runtime, persistence, calibration, verification, and operational hardening without changing the competition-facing output contract.

The Competition Release Track is inserted after `BUILD-INFRA-A` and before the original `10H-A` production prediction phase.

## Current continuation point

- `BUILD-INFRA-A` implementation commit: `e33a8f4d8949ee219261350b1bd05836bc3c8878`
- The build boundary, workspace package outputs, API production build, Prisma Client generation, TxLINE regression, and full API regression have passed.
- The next product work must start from this state. No rollback to an earlier TxLINE, odds, agent, or build phase is allowed.

## Architectural rule: one contract, two model profiles

Both tracks use the existing `FinalPredictionSnapshot` domain and prediction target vocabulary.

The runtime must depend on a stable prediction interface, not on a concrete model implementation:

```text
Canonical match state
+ odds reliability
+ stored/live event context
+ data quality/freshness
        ↓
PredictionInput boundary
        ↓
PredictionProfile
  - competition_baseline_v1
  - production_ensemble_v1 (future)
        ↓
FinalPredictionSnapshot
        ↓
public-safe prediction mapper
        +
existing public market-intelligence mapper
        ↓
API / web / replay
```

The competition model is therefore not throwaway code. It is the first implementation of the permanent prediction boundary. Future phases add or replace specialists behind that boundary.

## Competition output contract

The Competition Release must produce every required user-facing prediction and intelligence family:

1. final outcome probabilities: home / draw / away;
2. next goal probabilities: home / none / away;
3. goal probability in the next 5, 10, and 15 minutes;
4. bounded final score distribution plus `other_probability`;
5. current result survival/change probability;
6. momentum shift probabilities;
7. confidence level, confidence score, and confidence reasons;
8. risk level and risk reasons;
9. concise explanation, main factors, and limitations;
10. data coverage, freshness, and model profile metadata through public-safe fields only;
11. a mandatory user-facing odds/market analysis built from the existing `PublicMarketIntelligence` boundary.

The public odds analysis must include:

- market-data availability;
- public reliability level;
- freshness;
- provider coverage category;
- provider agreement category;
- market volatility category;
- market, usable-market, and provider counts;
- up to three notable market movements with market label, selection label, direction, strength, and human-readable summary;
- overall market summary;
- public limitations;
- last update timestamp;
- the existing market-intelligence safety note.

The user-facing odds analysis must describe market quality and movement independently from the model prediction. It must remain clear that market intelligence is an input signal and is not equivalent to MatchPulse's final prediction.

All probability distributions must remain normalized and deterministic for identical inputs.

## Competition model profile

### Purpose

`competition_baseline_v1` prioritizes completeness, determinism, runtime safety, and fast delivery over maximum predictive sophistication.

It must not claim production-grade accuracy or calibration.

### Inputs

Use only foundations already present in the repository:

- canonical fixture and match state;
- score, phase, minute, and score difference;
- odds intelligence assessment and approved model-use cap;
- event pressure and stored event impact;
- freshness and data quality;
- deterministic fallback priors.

No new provider, external ML service, training pipeline, database migration, or production network dependency is required for the competition model.

### Internal specialists

The competition profile uses bounded deterministic specialists:

- `competition_state` — score, minute, phase, and home/away state;
- `competition_market` — usable consensus odds only, capped by the existing odds reliability assessment;
- `competition_event` — available pressure and event-impact direction only;
- `competition_goal_hazard` — conservative time-window goal hazard;
- `competition_scoreline` — bounded scoreline generator;
- `competition_fallback` — complete deterministic output when inputs are incomplete.

These roles map to the permanent production specialist roles. The future production engine can replace each specialist independently.

### Conservative behavior

- Missing or stale inputs reduce confidence and increase risk.
- Unusable odds receive zero market contribution.
- Missing events do not fabricate event pressure.
- Finished matches collapse relevant probabilities to deterministic terminal values.
- Pre-match and unknown-phase inputs use explicit conservative fallbacks.
- Exact internal coefficients, weights, thresholds, fair probabilities, and consensus probabilities never appear in public responses.
- Confidence describes data/model support, not guaranteed correctness.

## Runtime strategy for the competition track

The competition release intentionally avoids the full `10G`/`10I` production runtime dependency chain.

It uses:

- request-time or bounded refresh prediction generation;
- existing stored canonical state and odds/event foundations;
- the existing public odds-intelligence mapper for mandatory user-facing market analysis;
- existing TxLINE client foundations where already wired;
- deterministic replay fallback for evaluator availability;
- optional short-lived in-memory caching only;
- no prediction migration;
- no continuous multi-fixture supervisor;
- no production-grade historical persistence requirement.

The Future Production Track later adds streaming, ordered persistence, duplicate suppression, backfill, registry lifecycle, and continuous orchestration behind the same output contract.

## API strategy

The competition release introduces a versioned public-safe prediction DTO. It must contain the complete prediction families and a mandatory `market_analysis` object conforming to the existing `PublicMarketIntelligence` public boundary.

It must exclude:

- specialist weights;
- provider identities;
- raw observations;
- feature hashes and private feature references;
- exact odds component scores;
- exact fair or consensus probabilities;
- formulas and thresholds;
- training data;
- debug lineage;
- betting or financial recommendation fields.

The future `10K` phase must preserve backward compatibility with the competition DTO while adding history, pagination, and production persistence semantics.

## Web strategy

The competition web surface is a bounded evaluator experience, not the final `10L` product:

- match identity and current state;
- all prediction families;
- a dedicated human-readable odds-analysis panel;
- market reliability, freshness, coverage, agreement, volatility, notable movements, summary, and limitations;
- confidence, risk, explanation, data quality, and freshness;
- replay fallback;
- responsive competition presentation;
- no wallet requirement;
- no betting language;
- no internal model disclosure.

The future `10L` phase extends this surface with richer browsing, history, replay controls, verification, and production UX.

## Revised delivery sequence

### Competition Release Track

1. `COMP-A` — Competition complete prediction baseline kernel.
2. `COMP-B` — Competition runtime service, mandatory public market analysis, and versioned public-safe API.
3. `COMP-C` — Competition web experience, odds-analysis presentation, replay fallback, and submission gate.

Completion of `COMP-C` is the competition delivery milestone.

### Future Production Track

After `COMP-C`, continue the original production roadmap:

1. `10H-A` and `10H` — production specialist composition and prediction engine;
2. Gate 1, `10E-D`, and `10G` — persistence and streaming;
3. `10I` — production runtime orchestration;
4. `10J` — labels, backtest, evaluation, and calibration;
5. `10K`/`10L` — production public API and final web experience;
6. `10M`/`10N`/`10O`/`10P` — notifications, verification, hardening, and final production delivery.

## No-return guarantee

The following artifacts are permanent across both tracks:

- TxLINE client and normalization foundations;
- odds intelligence and reliability contracts;
- existing `PublicMarketIntelligence` and public mapper;
- canonical state and event context;
- `FinalPredictionSnapshot` target vocabulary;
- prediction safety rules;
- public/internal separation;
- recursive forbidden-field protection;
- workspace package build boundaries;
- Automation v2 governance.

Future work may strengthen implementations but must not require competition code to be deleted or callers to be rewritten.

## Competition Definition of Done

The competition track is complete only when:

- every prediction family listed above is returned;
- the public response includes mandatory human-readable odds analysis;
- odds analysis exposes reliability, freshness, coverage, agreement, volatility, notable movements, summary, limitations, and last update;
- odds analysis and prediction are visually and semantically distinguished;
- identical input produces identical prediction output;
- every distribution is valid and normalized;
- missing/stale data degrades safely;
- a live/stored-data path works;
- a deterministic replay path works without live provider availability;
- replay contains meaningful odds-analysis states and at least one visible market movement;
- public output passes recursive leakage scans;
- no betting recommendation field exists;
- API and web show limitations clearly;
- full API regression and production build pass;
- evaluator access requires no wallet or payment.
