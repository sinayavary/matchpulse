# Phase 10H-A â€” Prediction Composition Engine

## Architecture

This phase implements the deterministic internal composition boundary for MatchPulse predictions. It does not implement proprietary specialist formulas, private coefficients, persistence, routes, workers, or public API behavior.

Private inference policy remains runtime-injected. The repository receives only:

- validated specialist outputs
- explicit assigned weights
- an odds-intelligence market-weight cap
- a complete fallback output
- confidence, risk, and explanation objects supplied by an approved internal policy boundary

## Delivered behavior

- deterministic specialist ordering
- explicit global weight validation
- market weight cannot exceed the approved odds-reliability cap
- per-target re-normalized composition
- explicit fallback for missing specialist targets
- monotonic goal-horizon projection
- stable scoreline merge, ranking, truncation, and residual mass
- deterministic content-hash snapshot identity
- construction through the existing `FinalPredictionSnapshot` validator
- no mutation of caller-owned inputs
- no private policy coefficients committed to Git

## Security boundary

The engine is internal. Public mappers must continue to remove:

- specialist contributions
- assigned weights
- feature references
- odds-intelligence internal references
- exact confidence components
- model versions that reveal private policy
- raw provider observations

## Deferred

- feature assembly: 10H-B
- private policy adapter: 10H-C
- runtime orchestration and persistence: 10I
- labels, evaluation, and calibration: 10J
- public contract: 10K
