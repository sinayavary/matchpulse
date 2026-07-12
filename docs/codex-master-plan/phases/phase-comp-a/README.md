# Phase COMP-A v1 — Competition Complete Prediction Baseline Kernel

## Review status

This is a review-only phase definition. It must not become active until the exact implementation payload and hashes are generated against the locked competition baseline.

- Baseline candidate: `13c2e80ec40da1443048cd61bb020a501f4b9d22`
- Track: Competition Release
- Pack version: `COMP-A-v1`
- Successor: `COMP-B`
- Scope: locked; no optional capability may be added

## Objective

Implement the first permanent prediction-engine profile, `competition_baseline_v1`, behind the existing `FinalPredictionSnapshot` boundary.

To minimize time and avoid duplicate work, COMP-A must reuse the already reviewed `prediction-engine-v1` composition kernel from the prepared `10H-A` source payload. COMP-A must not create a second competing composition engine. It adds only the bounded competition specialist profile required to feed the permanent composition boundary.

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

Use one permanent composition path:

```text
normalized competition input
  ↓
competition_baseline_v1 specialists
  - state
  - market
  - event
  - goal hazard
  - scoreline
  - complete fallback
  ↓
prediction-engine-v1 composition kernel
  ↓
FinalPredictionSnapshot
```

The competition profile specialists map directly to future production roles. Future production phases may replace individual specialist implementations without changing the composition kernel, snapshot contract, service, API, or web caller.

The pure engine must consume normalized, bounded inputs. It must not read Prisma, call TxLINE, register routes, mutate caller-owned input, expose internal coefficients, or introduce another prediction contract.

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
- Use only approved state, pressure, event-impact, and market-direction inputs.
- Missing event evidence must not fabricate pressure.

### Confidence and risk

- Confidence is derived from coverage, freshness, reliability, and model-agreement support.
- Confidence must not be described as guaranteed accuracy.
- Missing minute, stale data, missing odds/events, disagreement, and fallback use must be represented in risk reasons.

### Determinism and safety

- Identical canonical input yields an identical snapshot identity and output.
- No random source, wall-clock read, network, database, or mutable singleton is allowed in the pure engine.
- No provider identity, formula, exact internal weight, raw observation, betting recommendation, or expected-value field is emitted.

## Compatibility rules

- Do not replace or fork `FinalPredictionSnapshot`.
- Do not create a parallel competition prediction contract.
- Do not create a second composition engine when `prediction-engine-v1` can be reused.
- Do not change public routes.
- Do not add a database migration.
- Do not remove `live-prediction-agent.ts`; COMP-B may adapt or deprecate it behind the permanent boundary.
- Future production work must strengthen specialists without requiring caller rewrites.

## Exact implementation scope

Only these implementation targets are allowed:

- `apps/api/src/prediction-engine-v1.ts`
- `apps/api/src/prediction-engine-v1.test.ts`
- `apps/api/src/competition-model-profile.ts`
- `apps/api/src/competition-model-profile.test.ts`
- `apps/api/package.json`
- `docs/phase-comp-a-competition-prediction-baseline.md`

No route, service, worker, frontend, Prisma, migration, public mapper, persistence, network, or notification file may change in COMP-A.

## Validation gate

The activated phase pack must prove:

- the reused composition-kernel tests pass;
- all competition prediction targets are produced;
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
