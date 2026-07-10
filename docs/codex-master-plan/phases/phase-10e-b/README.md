# Active Phase Pack — Phase 10E-B v1

## Baseline

The required repository baseline is:

`b7c7622a81fcf08fbfe79092367cc98aff4cde6f`

Commit message:

`Add MatchPulse architecture and Codex governance`

Codex must stop with `SPEC_CONFLICT` if `HEAD` does not equal this SHA.

## Objective

Install the exact tested implementation of:

- complete provider market snapshots
- implied and fair probabilities
- overround
- provider median consensus
- robust MAD/modified-z outlier handling
- deterministic epoch-aligned time buckets
- 1m/5m probability change
- velocity and acceleration
- volatility metrics
- explicit probability jump detection

## No Design Work Is Allowed

All production source, tests, package configuration, and phase documentation are already present under `payload/`.

Codex must copy them exactly. Codex must not rewrite, optimize, refactor, split, combine, rename, or reinterpret them.

## Allowed Target Files

Only these six target files may change:

1. `apps/api/package.json`
2. `apps/api/src/odds-mathematical-primitives.ts`
3. `apps/api/src/odds-mathematical-primitives.test.ts`
4. `apps/api/src/odds-temporal-primitives.ts`
5. `apps/api/src/odds-temporal-primitives.test.ts`
6. `docs/phase-10e-b-odds-mathematical-primitives.md`

No other file is allowed.

## Workspace Collision Rules

Before copying:

- `apps/api/package.json` must have no local modification.
- The other five target files must not already exist.
- Unrelated existing local changes must remain untouched.

If any condition fails, stop with `WORKSPACE_COLLISION`.

## Exact Payload Mapping

Copy:

- `payload/apps/api/package.json` → `apps/api/package.json`
- `payload/apps/api/src/odds-mathematical-primitives.ts` → `apps/api/src/odds-mathematical-primitives.ts`
- `payload/apps/api/src/odds-mathematical-primitives.test.ts` → `apps/api/src/odds-mathematical-primitives.test.ts`
- `payload/apps/api/src/odds-temporal-primitives.ts` → `apps/api/src/odds-temporal-primitives.ts`
- `payload/apps/api/src/odds-temporal-primitives.test.ts` → `apps/api/src/odds-temporal-primitives.test.ts`
- `payload/docs/phase-10e-b-odds-mathematical-primitives.md` → `docs/phase-10e-b-odds-mathematical-primitives.md`

After copying, SHA-256 hashes must match `EXPECTED_SHA256.json`.

## Required Validation Commands

Run from repository root:

```powershell
.\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit

.\apps\api\node_modules\.bin\tsx.CMD --test `
  apps/api/src/odds-mathematical-primitives.test.ts `
  apps/api/src/odds-temporal-primitives.test.ts

.\apps\api\node_modules\.bin\tsx.CMD --test `
  apps/api/src/odds-market-normalization.test.ts `
  apps/api/src/odds-intelligence-contract.test.ts

pnpm.cmd --filter @matchpulse/api test

git diff --check -- `
  apps/api/package.json `
  apps/api/src/odds-mathematical-primitives.ts `
  apps/api/src/odds-mathematical-primitives.test.ts `
  apps/api/src/odds-temporal-primitives.ts `
  apps/api/src/odds-temporal-primitives.test.ts `
  docs/phase-10e-b-odds-mathematical-primitives.md

git diff --name-only -- prisma prisma/migrations
git status --short
```

## Expected Results

- Typecheck: pass
- Focused Phase 10E-B: 68/68 pass
- Normalization + Odds contract regression: 120/120 pass
- Full API suite: expected 798/798 pass
  - Previous suite: 730
  - New tests: 68
- Prisma/migration diff: empty
- Existing unrelated local changes remain present and unchanged

## Stop Rule

After the report, return `PHASE_COMPLETE` and stop.
