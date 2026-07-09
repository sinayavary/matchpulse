# Pressure Engine v1

## Purpose

Pressure Engine v1 is a pure, rule-based pressure hint engine for ordered TxLINE score-like records. It inspects a short timeline window, applies sparse weights, and returns explainable evidence about pressure-like match states.

This is a foundation layer only. It is not a prediction model, probability system, betting signal, or user-facing feature.

## Input Fields

The engine accepts raw records with PascalCase or camelCase aliases for:

- `seq`
- `ts`
- `fixtureId`
- `gameState`
- `scoreSoccer`
- `dataSoccer`
- `possession`
- `possessionType`
- `possibleEvent`

## Allowed Fields

The engine may read and use:

- `seq`
- `ts`
- `fixtureId`
- `gameState` for debug lineage only
- `scoreSoccer` or `Score` for score-change detection
- `dataSoccer` or `Data` for sparse possession hints
- `possession`
- `possessionType`

## Blocked Fields

The engine must not use the following as output keys or scoring concepts:

- `confidence`
- `probability`
- `recommendation`
- `recommended_bet`
- `bet`
- `wager`
- `stake`
- `expected_value`
- `edge`
- `prediction`
- `winner`
- `deposit`
- `wallet`
- `payout`
- `profit`

`possibleEvent` is also blocked from scoring in v1. If it appears, it is only recorded in debug lineage and limitations.

## Weight Table

The engine uses only sparse, conservative weights:

| Signal | Weight | Notes |
| --- | ---: | --- |
| `SafePossession` | 0.5 | Weak pressure hint |
| `AttackPossession` | 2 | Moderate pressure hint |
| `DangerPossession` | 3 | Strong pressure hint |
| `HighDangerPossession` | 4 | Strongest pressure hint in v1 |
| `possession` without `possessionType` | 0.5 | Weak availability hint only |
| score change between consecutive readable score records | 3 | Only when consecutive records both expose a normalized score |

Unknown `possessionType` values do not score.

## Level Thresholds

The summed pressure score maps to a level using these thresholds:

- `0` => `none`
- `>0` to `2` => `low`
- `>2` to `6` => `medium`
- `>6` => `high`

The score is clamped to `0` to `10`.

## Limitations

Pressure Engine v1 is intentionally conservative:

- `possessionType` is sparse and treated as a discrete state flag, not possession percentage.
- `possibleEvent` is not used by Pressure Engine v1.
- This is a rule-based pressure hint, not a trained model.
- Pressure score is not a probability and does not predict match outcome.

## Debug Lineage

`debug_lineage` records how each evaluated record was interpreted after sorting and windowing.

Each entry includes:

- `seq`
- `ts`
- `extracted_fields`
- `used`
- `reason`

This is for traceability only. It is meant to show why a record did or did not contribute to pressure evidence.

## Why This Is Not a Model

The engine does not learn from data, optimize parameters, or estimate latent match state. It only applies fixed rules and fixed weights to observed fields.

## Why This Is Not Probability

The output score is a bounded heuristic sum. It is not calibrated, not a probability of any match event, and should not be interpreted as confidence.

## Why This Is Not Betting Advice

The engine does not produce recommendations, picks, stakes, or expected value. It is only a safe internal pressure hint.

## Next Integration Gate

Do not integrate this into `signalcore-v0` or `agent-presenter-v0` yet.

Recommended next phases:

- Phase 1B may connect this pure engine to stored score snapshot raw payloads.
- Phase 1C may expose a safe SignalCore signal only after the contract is updated.

That future integration should remain behind explicit contract review and should continue to avoid probability, betting, and prediction fields.
