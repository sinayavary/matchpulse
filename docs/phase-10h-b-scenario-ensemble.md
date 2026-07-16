# Phase 10H-B — Scenario Ensemble, Confidence, Risk, and Explanation

## Architecture

This phase turns the 10H-A feature snapshot and specialist bundle into the existing internal `FinalPredictionSnapshot` contract.

```text
validated feature snapshot
        -> specialist bundle
        -> target-aware ensemble
        -> confidence / risk / explanation
        -> deterministic internal prediction snapshot
```

The engine combines live-state, reliable-market, tempo, score-distribution, and fallback evidence. Market influence is bounded by the sanitized cap produced by the odds reliability layer. Finished matches are terminal and suppress market influence. Missing data produces a bounded fallback rather than fabricated certainty.

The output includes:

- final outcome probabilities
- next-goal probabilities
- 5/10/15-minute goal horizons
- bounded final-score distribution
- current-result survival
- momentum-shift probabilities
- data coverage, confidence, and risk
- deterministic snapshot identity
- short explanation factors and limitations
- specialist contribution metadata without formulas or provider identities

## Safety and IP boundary

- internal backend contract only; no route or frontend change
- no persistence or orchestration in this phase
- no public odds decomposition, provider identity, raw payload, feature vector, or proof blob
- no bet, wager, stake, payout, profit, expected-value, or wallet behavior
- no claim that predictions are cryptographically verified
- no migration, database access, TxLINE call, Solana call, or dependency addition

Exact trained policies, calibration assets, and production parameters remain private server-side assets. Public responses must later pass through the dedicated public-safe mapping phase.

## Validation targets

- existing final prediction domain validation
- deterministic content-based snapshot IDs
- normalized specialist contribution weights
- bounded market influence
- terminal match behavior
- fallback/risk behavior for sparse data
- monotonic goal horizons and finite outputs
- no mutation
- recursive forbidden-field checks
