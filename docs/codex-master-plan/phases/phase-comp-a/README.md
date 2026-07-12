# Phase COMP-A v1 — Competition Complete Prediction Baseline Kernel

## Review status

This is a review-only phase definition. It must not become active until `BUILD-INFRA-A` is human-reviewed and the exact implementation payload and hashes are generated against the then-current `main` commit.

- Baseline candidate: `e33a8f4d8949ee219261350b1bd05836bc3c8878`
- Track: Competition Release
- Pack version: `COMP-A-v1`
- Successor: `COMP-B`

## Objective

Implement the first permanent prediction-engine profile, `competition_baseline_v1`, behind the existing `FinalPredictionSnapshot` boundary.

The model is deliberately bounded and deterministic, but it must return all required prediction families:

- final result 1X2;
- next goal side;
- goal in next 5/10/15 minutes;
- final score distribution;
- current-result survival/change;
- momentum shift;
- confidence;
- risk;
- explanation and limitations.

This is not a placeholder contract and must not return balanced defaults when usable score, time, odds, or event evidence is present.

## Architecture

Create a competition model profile whose specialists map directly to future production roles:

- state specialist;
- market specialist;
- event specialist;
- goal-hazard specialist;
- scoreline specialist;
- complete fallback specialist.

The engine must consume normalized, bounded inputs. It must not read Prisma, call TxLINE, register routes, mutate caller-owned input, or expose internal coefficients.

## Required behavior

### Final outcome

- Normalize to exactly one.
- Use reliable market evidence only within the existing approved market-weight cap.
- Apply bounded score/minute/phase evidence.
- Use conservative fallback when market/state inputs are missing.
- Finished matches become terminal deterministic outcomes.

### Next goal

- Normalize home/none/away to exactly one.
- Use remaining time, score state, event pressure, and usable market direction.
- `none` must increase as remaining time decreases when no stronger evidence exists.

### Goal horizons

- Produce bounded probabilities for 5, 10, and 15 minutes.
- Enforce `next_5m <= next_10m <= next_15m`.
- Finished matches return zero for all future goal horizons.

### Final score distribution

- Produce a bounded top scoreline set and `other_probability`.
- Preserve current score as the minimum reachable score.
- Normalize the complete distribution after truncation.
- Finished matches return the actual final score with probability one.

### Current result survival

- Normalize hold/change to exactly one.
- Finished matches return hold = one.
- Missing scoreboard produces conservative low-support output and explicit limitations.

### Momentum shift

- Normalize home-strengthens/neutral/away-strengthens to exactly one.
- Use only approved state, pressure, event-impact, and market direction inputs.
- Missing event evidence must not fabricate pressure.

### Confidence and risk

- Confidence is derived from coverage, freshness, reliability, and model agreement support.
- Confidence must not be described as guaranteed accuracy.
- Missing minute, stale data, missing odds/events, disagreement, and fallback use must be represented in risk reasons.

### Determinism and safety

- Identical canonical input yields an identical snapshot identity and output.
- No random source, wall-clock read, network, database, or mutable singleton is allowed in the pure engine.
- No provider identity, formula, exact internal weight, raw observation, betting recommendation, or expected-value field is emitted.

## Compatibility rules

- Do not replace or fork `FinalPredictionSnapshot`.
- Do not change public routes.
- Do not add a database migration.
- Do not remove `live-prediction-agent.ts`; COMP-B may adapt or deprecate it behind the permanent boundary.
- Future `10H-A` must be able to replace individual competition specialists without changing callers.

## Planned implementation targets

- `apps/api/src/competition-model-profile.ts`
- `apps/api/src/competition-model-profile.test.ts`
- `apps/api/src/competition-prediction-engine-v1.ts`
- `apps/api/src/competition-prediction-engine-v1.test.ts`
- `apps/api/package.json`
- `docs/phase-comp-a-competition-prediction-baseline.md`

## Validation gate

The activated phase pack must prove:

- all prediction target tests pass;
- all probability invariants pass;
- terminal, pre-match, partial-data, stale-data, missing-odds, missing-events, and high-disagreement fixtures are covered;
- deterministic snapshot tests pass;
- recursive forbidden-field checks pass;
- API typecheck and production build pass;
- full API regression passes;
- Prisma/migration diff is empty;
- no network access occurs;
- only exact allowlisted files change.

## Completion

After successful execution:

1. update only allowed `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `PHASE_COMPLETE_PREPARED`;
5. do not activate `COMP-B` in the same execution.
