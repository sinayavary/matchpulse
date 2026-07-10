# 04 — Intelligence and Prediction Architecture

## 1. Design Objective

Produce useful, deterministic, calibrated-over-time scenario estimates without pretending unsupported certainty.

The system starts with a rigorous deterministic baseline and evolves through recorded evaluation. It does not claim a trained ML model before a sealed dataset and validated model registry entry exist.

## 2. Outputs

The final internal prediction snapshot contains:

- final outcome: home/draw/away
- next goal: home/none/away
- goal in next 5, 10, and 15 minutes
- current result holds/changes
- momentum: home strengthens/neutral/away strengthens
- bounded final-score distribution
- confidence
- risk
- specialist contributions
- evidence/explanation factors
- limitations
- coverage
- exact versions and references

## 3. Odds Intelligence Engine

### 3.1 Input

Normalized stored odds observations ordered by:

1. source timestamp
2. created timestamp
3. external sequence
4. stable row identity

### 3.2 Market reconstruction

Group by canonical market key and time/provider snapshot.

Required selection sets:

- 1X2: home, draw, away
- BTTS: yes, no
- totals: over, under for one line
- Asian handicap: home, away for one line
- next goal: home, none, away where supported

Incomplete markets remain visible internally but are not usable for probability calculation.

### 3.3 Implied probability

For decimal odds `o`:

`p_raw = 1 / o`

For a complete mutually exclusive market:

`overround = sum(p_raw) - 1`

Simple fair probability baseline:

`p_fair_i = p_raw_i / sum(p_raw)`

When TxLINE `Pct` is available and valid, use it as a separate documented consensus input; never silently mix formats.

### 3.4 Snapshot consensus

Because StablePrice is one consolidated source, “consensus” means the selected canonical probability for that timestamp, not a claim of MatchPulse combining independent bookmakers.

For multiple genuinely distinct provider keys, use robust aggregation:

- median fair probability
- median absolute deviation
- bounded outlier rejection
- minimum provider gate

### 3.5 Temporal movement

For each selection:

- 1-minute probability change
- 5-minute probability change
- velocity = change / elapsed minutes
- acceleration = velocity change / elapsed minutes
- stale-gap protection
- no interpolation across major missing intervals

### 3.6 Component scores

Each market receives scores in `[0,1]`:

- completeness
- source coverage
- freshness
- temporal stability
- anomaly quality
- event consistency

The exact formula and thresholds will be supplied in the Phase 10E implementation pack. Codex must not choose them.

### 3.7 Hard reliability gates

A market is unusable when:

- required selections are incomplete
- probabilities cannot be normalized
- timestamp is invalid
- data is beyond hard staleness limit
- selections conflict
- line is ambiguous
- anomaly severity exceeds hard gate
- event/phase inconsistency is critical

### 3.8 Root assessment

Aggregate usable markets with conservative weights.

The 1X2 market can be primary only when complete, usable, and present.

The assessment produces a recommended upper bound for market-model influence, never a betting recommendation.

## 4. Feature Layer

Feature groups:

### Match state

- normalized phase
- minute/seconds
- home/away score
- score difference
- time remaining bands
- red-card difference
- phase transitions

### Event/pressure

- decayed event pressure by side
- recent goal/card/penalty/VAR indicators
- dangerous action counts where supported
- event density
- pressure direction
- event freshness

### Market

- fair home/draw/away probabilities
- 1m/5m changes
- reliability
- volatility
- event consistency
- usable market weight
- market availability flags

### Coverage/quality

- fixture/score/event/odds availability
- freshness ages
- missing field masks
- provider/source coverage
- fallback indicators

Every feature is versioned and reconstructable.

## 5. Deterministic Specialist Architecture

### 5.1 State specialist

Purpose:

- derive phase-aware outcome baseline from score and remaining time
- operate without odds
- never return unavailable when score/phase are valid

### 5.2 Scoreline specialist

Purpose:

- estimate remaining goals
- generate final-score candidates
- derive final outcome and next-goal distributions

Baseline model:

- remaining-goal hazard by phase/time
- team-side share adjusted by score state and pressure
- bounded Poisson-style score increments
- explicit maximum goals for stable computation

Exact coefficients are fixed in the implementation pack.

### 5.3 Tempo/event specialist

Purpose:

- adjust near-term goal hazard
- estimate momentum direction
- react to major events
- decay evidence over time

### 5.4 Market specialist

Purpose:

- expose market-implied outcome probabilities only when the Odds Intelligence assessment is usable
- never exceed the assessment’s recommended weight
- become unavailable when market hard gates fail

### 5.5 Ensemble

The ensemble combines available specialists with:

- phase-specific base weights
- data-quality adjustment
- specialist output-quality adjustment
- market reliability cap
- normalized available weights
- deterministic fallback

No unavailable specialist receives weight.

## 6. Confidence

Confidence is not the maximum probability.

It reflects:

- data coverage
- freshness
- specialist agreement
- market reliability
- prediction stability
- calibration maturity
- fallback use

Public output uses:

- low
- medium
- high

The internal numeric score remains bounded and versioned.

## 7. Risk

Risk increases with:

- stale/missing data
- high volatility
- specialist disagreement
- major recent event
- unstable output
- low calibration maturity
- single-source dependence
- fallback path

Risk is informational uncertainty, not gambling risk.

## 8. Explanation

Explanations are generated from allowlisted structured factors, not free-form model reasoning.

Examples:

- “Home side leads with limited time remaining.”
- “Recent high-impact event increased short-term uncertainty.”
- “Market evidence is available but limited by freshness.”
- “State and market specialists agree.”
- “Odds input was excluded by reliability gates.”

No causal claim is made unless directly supported.

## 9. Identity and Determinism

IDs are SHA-256 hashes over canonical identity fields and version references.

Input permutation must not change:

- market assessment ID
- feature snapshot ID
- prediction snapshot ID

Identical content is idempotent. Same ID with different content is a conflict.

## 10. Labels and Evaluation

After enough future data is available:

- create immutable label revisions
- progress pending → partial → complete/invalid
- evaluate each prediction target
- calculate:
  - log loss
  - Brier score
  - calibration error
  - accuracy where meaningful
  - precision/recall for discrete events
  - replay stability
- segment by:
  - phase
  - score state
  - data coverage
  - odds reliability
  - competition
  - model version

## 11. Calibration Maturity

Stages:

1. `uncalibrated_baseline`
2. `evaluation_only`
3. `calibration_candidate`
4. `validated_calibration`
5. `production_calibrated`

The UI must not claim historical accuracy until supported by a sealed dataset and recorded evaluation.

## 12. Public Mapping

Public prediction DTO includes:

- timestamp
- distributions
- qualitative confidence
- risk
- limited explanation factors
- freshness and coverage
- version labels
- safety note

It excludes:

- exact private weights
- coefficients
- raw features
- raw provider rows
- internals of specialist arbitration
- training artifacts
