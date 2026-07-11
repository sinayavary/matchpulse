# Phase 10F-A v1 — TxLINE Client Foundation

## Authority

This is the exact active implementation pack selected by `ACTIVE_PHASE.json`.

- Baseline: `acea876b2a26c22e26a7390bf6520e2eb8e41a9d`
- Pack: `10F-A-v1`

## Objective

Consolidate TxLINE data access behind one secret-safe client while preserving the existing fixture, score, and odds snapshot contracts.

Deliver exactly:

- environment-driven REST transport
- explicit guest JWT and API-token headers
- fixture, score, and odds snapshot methods
- generic SSE connection and deterministic parser
- injected REST/SSE adapters for offline tests
- backward-compatible `createTxlineLiveClient`
- compatibility `TxlineClient` export

Do not invent a provider-specific SSE endpoint.

## Allowed targets

Only:

- `docs/phase-10f-a-txline-client-foundation.md`
- `packages/txline-client/package.json`
- `packages/txline-client/src/client.test.ts`
- `packages/txline-client/src/client.ts`
- `packages/txline-client/src/index.ts`
- `packages/txline-client/src/live.ts`

`ACTIVE_PHASE.json` is the only completion-metadata exception. Never edit `PHASE_QUEUE.json` during execution.

## Exact implementation

Copy every file under `payload/` to its matching repository path exactly. Verify hashes against `EXPECTED_SHA256.json` before and after copying. Do not redesign or refactor the payload.

## Automation v2

Before editing:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\codex-automation-v2.ps1 -Mode Validate
```

Continue only after `AUTOMATION_V2_VALIDATED`.

## Validation

Run exactly:

```powershell
pnpm.cmd --filter @matchpulse/txline-client test
pnpm.cmd --filter @matchpulse/txline-client typecheck
pnpm.cmd --filter @matchpulse/txline-client build
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api test
git diff --check
git diff --name-only -- prisma
git status --short
```

Expected: all tests/typechecks/build pass, Prisma diff empty, no real network access, no migration, and unrelated work remains byte-identical and unstaged.

## Prohibited

No migration, real TxLINE call, new dependency, lockfile edit, route/worker/frontend/Prisma/deployment change, public-contract expansion, secret exposure, raw provider payload exposure, successor activation, or publish without separate human instruction.

## Completion

After all checks pass, perform only the permitted `ACTIVE_PHASE.json` completion transition, run:

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Prepare
```

Report `PHASE_COMPLETE_PREPARED` and stop before Publish.
