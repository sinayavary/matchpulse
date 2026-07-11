# Phase 10H-A — Prediction Feature Snapshot and Specialist Models

## Architecture

This phase establishes a pure, backend-only inference foundation. It does not read the database, call TxLINE, persist predictions, register routes, or expose a public DTO.

The data flow is:

```text
canonical match/event state + sanitized odds assessment
        -> deterministic feature snapshot
        -> state / tempo / market / score-distribution / fallback specialists
        -> internal specialist bundle
```

`prediction-engine-features.ts` is the only adapter from upstream intelligence contracts into model-ready features. It validates timestamps and distributions, derives coverage and freshness, computes a deterministic content hash, and reduces odds intelligence to a provider-free signal. An unusable market contributes neither probabilities nor weight.

`prediction-specialists.ts` contains deterministic soccer specialists:

- live-state final-outcome and current-result survival
- tempo, next-goal, goal-horizon, and momentum context
- reliable-market final-outcome evidence
- bounded final-score distribution
- neutral or pre-match fallback

## Security and product boundary

- no raw TxLINE or bookmaker payload enters the feature snapshot
- no provider identity or component score is emitted
- no public API, frontend field, or user-facing recommendation is added
- no bet, wager, stake, payout, profit, expected-value, or wallet behavior
- no migration, persistence, worker integration, or real network access
- feature hashes are lineage identifiers, not cryptographic verification claims

The source implementation is an internal deterministic baseline. Production deployment must keep proprietary trained policies and calibration assets in private server-side storage and must never serialize them through public contracts.

## Validation targets

- deterministic hashing and output ordering
- missing-data degradation
- future timestamp and inconsistent-score rejection
- market hard-gate enforcement
- normalized probability distributions
- monotonic goal horizons
- finished-match terminal behavior
- contextual red-card influence
- no input mutation
- recursive absence of wagering/provider internals
