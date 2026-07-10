# Phase 10E-C v1 — Odds Reliability and Assessment

## Authority

This directory is the exact active implementation pack selected by
`docs/codex-master-plan/ACTIVE_PHASE.json`.

Production baseline:

`fd5045eb109305242eef1cd847a007e93c28c87a`

Pack version:

`10E-C-v1`

Do not request or use a separate phase-specific chat prompt.

## Objective

Install the exact deterministic Odds Intelligence assessment engine and
public-safe mapper from this pack.

The implementation must provide:

- component scores
- hard reliability gates
- market usability
- conservative model-weight caps
- root assessment
- deterministic assessment ID
- existing internal-contract builder integration
- public-safe qualitative mapping

## Allowed implementation targets

Only these six production files may change:

- `apps/api/package.json`
- `apps/api/src/odds-intelligence-assessment.test.ts`
- `apps/api/src/odds-intelligence-assessment.ts`
- `apps/api/src/odds-intelligence-public-mapper.test.ts`
- `apps/api/src/odds-intelligence-public-mapper.ts`
- `docs/phase-10e-c-odds-reliability-assessment.md`

`docs/codex-master-plan/ACTIVE_PHASE.json` is the only global metadata
exception, and only the successful completion transition in
`EXECUTION_PROTOCOL.md` is allowed.

Do not change `PHASE_QUEUE.json`.

## Exact implementation

The complete source, tests, package file, and documentation are already present
under `payload/`.

Copy each payload file to the matching repository path. Do not redesign,
rewrite, simplify, refactor, or choose different constants.

## Required preflight

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\prepare-codex-run.ps1 -ValidateOnly
```

Continue only when it reports:

`Orchestration validation: PASS`

## Payload verification

Before copying, verify every file against `EXPECTED_SHA256.json`.

After copying, verify every target file against the same expected hash.

A mismatch is `SPEC_CONFLICT`.

## Validation sequence

Run exactly:

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/odds-intelligence-assessment.test.ts src/odds-intelligence-public-mapper.test.ts
```

Expected: `72/72` pass.

```powershell
pnpm.cmd --filter @matchpulse/api typecheck
```

Expected: pass.

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/odds-intelligence-contract.test.ts src/odds-market-normalization.test.ts src/odds-mathematical-primitives.test.ts src/odds-temporal-primitives.test.ts src/odds-intelligence-assessment.test.ts src/odds-intelligence-public-mapper.test.ts
```

Expected: `192/192` pass.

```powershell
pnpm.cmd --filter @matchpulse/api test
```

Expected: `870/870` pass.

Then run:

```powershell
git diff --check
git diff --name-only -- prisma
git status --short
```

Expected:

- no whitespace errors
- no Prisma or migration diff
- only the six authorized implementation targets plus the permitted
  `ACTIVE_PHASE.json` completion transition
- all unrelated local changes preserved

## Prohibited

Do not:

- modify Prisma or migrations
- modify routes, workers, DB services, frontend, Telegram, or deployment
- add dependencies
- run a network request
- apply a migration
- alter an existing test
- weaken a new test
- expose internal probabilities, formulas, thresholds, weights, providers, or
  raw observations through the public mapper
- commit or push
- activate another phase

## Completion

When and only when all required checks pass:

1. perform the exact `ACTIVE_PHASE.json` successful-completion transition from
   `EXECUTION_PROTOCOL.md`
2. list the six implementation files in sorted order in
   `last_result.files_changed`
3. record the actual validation results
4. keep migration and network flags false
5. return the required report ending with `PHASE_COMPLETE`
6. stop
