# Phase COMP-A v1 — Competition Complete Prediction Baseline Kernel

## Review status

This is a review-only exact implementation pack. It must not become active until the payload, SHA-256 map, baseline ancestry, allowed targets, and validation plan are reviewed against the locked competition baseline.

- Baseline: `13c2e80ec40da1443048cd61bb020a501f4b9d22`
- Track: Competition Release
- Pack version: `COMP-A-v1`
- Successor: `COMP-B`
- Scope: locked; no optional capability may be added

## Objective

Implement `competition_baseline_v1` behind the existing `FinalPredictionSnapshot` boundary. The profile is deliberately bounded and deterministic, but it returns every competition prediction family:

- final result 1X2;
- next-goal side;
- goal probability in the next 5, 10, and 15 minutes;
- final-score distribution;
- current-result survival/change;
- momentum shift;
- confidence;
- risk;
- explanation and limitations.

This is not a placeholder contract. Usable score, time, odds, and event evidence must change the output from conservative fallback values.

## One permanent composition path

COMP-A must reuse the reviewed `prediction-engine-v1` payload already stored in the repository. It must not create a second composition engine or another prediction contract.

```text
normalized competition input
  ↓
competition_baseline_v1 specialists
  - state / pre-match prior
  - bounded market
  - event pressure
  - goal hazard
  - scoreline
  - complete fallback
  ↓
prediction-engine-v1
  ↓
FinalPredictionSnapshot
```

Future production phases may replace individual specialists without changing the composition engine, snapshot contract, service, public API, replay adapter, or web caller.

## Exact payload application

Apply only the six target files listed in `manifest.json`.

Copy these four files from this COMP-A pack:

- `payload/apps/api/package.json` → `apps/api/package.json`
- `payload/apps/api/src/competition-model-profile.ts` → `apps/api/src/competition-model-profile.ts`
- `payload/apps/api/src/competition-model-profile.test.ts` → `apps/api/src/competition-model-profile.test.ts`
- `payload/docs/phase-comp-a-competition-prediction-baseline.md` → `docs/phase-comp-a-competition-prediction-baseline.md`

Copy these two unchanged reviewed files from the canonical Phase 10H-A payload:

- `../phase-10h-a/payload/apps/api/src/prediction-engine-v1.ts` → `apps/api/src/prediction-engine-v1.ts`
- `../phase-10h-a/payload/apps/api/src/prediction-engine-v1.test.ts` → `apps/api/src/prediction-engine-v1.test.ts`

Before implementation and again before Prepare, verify the SHA-256 of all six target files against `EXPECTED_SHA256.json`. A mismatch is `SPEC_CONFLICT`; do not regenerate, reformat, or repair payload bytes ad hoc.

## Required behavior

### State and terminal behavior

- Apply bounded score/minute/phase evidence.
- Finished matches become deterministic terminal outputs.
- Final-score candidates never go below the current score.
- Missing score or minute activates explicit conservative support and limitations.

### Market and event behavior

- Use market distributions only when the normalized assessment is usable.
- Market contribution must not exceed the approved odds-intelligence cap and is additionally bounded by the competition profile.
- Unusable or missing odds receive zero market weight.
- Missing event evidence must not fabricate pressure or impact.

### Prediction invariants

- Normalize final outcome, next goal, result survival, and momentum distributions.
- Enforce `next_5m <= next_10m <= next_15m`.
- Normalize the bounded scoreline set plus `other_probability`.
- Identical canonical input must produce identical output and snapshot identity.
- Caller-owned input must remain unchanged.

### Confidence, risk, and explanation

- Confidence reflects coverage, freshness, reliability, and agreement support, not guaranteed accuracy.
- The baseline must identify itself as intentionally limited and not production calibrated.
- Missing minute, stale data, missing odds/events, disagreement, and fallback use must appear in bounded risk reasons where applicable.

## Boundaries

The pure profile must not:

- read Prisma or a database;
- call TxLINE or any external service;
- register a route, service, worker, or scheduler;
- add persistence or a migration;
- change a public DTO;
- modify frontend code;
- expose provider identity, raw observations, formulas, coefficients, exact private weights, or financial/betting recommendation fields.

COMP-A does not expose the human-readable odds panel. The existing odds intelligence becomes a mandatory public `market_analysis` object in COMP-B and is rendered independently from prediction in COMP-C.

## Validation gate

Run exactly the commands in `manifest.json`. The phase is complete only when evidence proves:

- focused prediction-domain, reused-engine, and competition-profile tests pass;
- every prediction target is produced;
- probability, monotonicity, scoreline, terminal, fallback, determinism, and immutability cases pass;
- partial, stale, missing-odds, missing-events, and disagreement cases degrade safely;
- API typecheck and production build pass;
- the full API regression suite passes;
- `git diff --check` passes;
- Prisma/migration diff is empty;
- no real network or database operation occurs;
- only exact allowlisted targets change.

A limited isolated test run of the new profile covered seven focused scenarios successfully while authoring this pack. This is supporting review evidence only; it does not replace the required repository typecheck, production build, or full regression commands.

## Completion

After every validation passes:

1. update only the permitted `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `PHASE_COMPLETE_PREPARED`;
5. do not activate `COMP-B` in the same execution.
