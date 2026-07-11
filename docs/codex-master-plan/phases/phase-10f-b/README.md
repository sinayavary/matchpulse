# Phase 10F-B v1 — TxLINE Provider Bindings and Historical/Proof Requests

## Review status

This pack is committed for review only. It is not active until a separate repository-controlled activation changes `ACTIVE_PHASE.json` after explicit human approval.

- Baseline: `791ea52e68537ae8d5eadc96f0d0c8cf6f72c2c8`
- Pack: `10F-B-v1`

## Objective

Extend the secret-safe TxLINE client with exact provider-documented request bindings for current and historical updates, official score/odds SSE streams, and proof retrieval operations.

Deliver exactly:

- hourly fixture updates
- current fixture-specific score and odds updates
- historical score history and five-minute score/odds interval updates
- official `/api/scores/stream` and `/api/odds/stream` bindings
- fixture update and fixture batch proof requests
- odds update proof requests
- legacy and V2 score-stat proof request modes
- offline request-contract and stream URL tests

Proof retrieval does not mean on-chain verification. Returned proof payloads remain internal and must not be exposed publicly. This phase does not assign `onchain_verified` status.

## Allowed targets

Only:

- `docs/phase-10f-b-txline-provider-bindings.md`
- `packages/txline-client/src/client.test.ts`
- `packages/txline-client/src/client.ts`
- `packages/txline-client/src/live.ts`

`ACTIVE_PHASE.json` is the only completion-metadata exception during a future approved execution. Never edit `PHASE_QUEUE.json` during execution.

## Exact implementation

Copy every file under `payload/` to its matching repository path exactly. `EXPECTED_SHA256.json` uses committed-payload-tree integrity: the committed payload on the activated pack commit is the exact implementation source of truth. Do not redesign the payload.

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

Expected: all tests/typechecks/build pass, Prisma diff empty, no real TxLINE or Solana call, no migration, and unrelated work remains byte-identical and unstaged.

## Prohibited

No production network request, credential acquisition, migration, Prisma edit, route/worker/frontend change, persistence, reconnect supervisor, REST catch-up, public proof exposure, on-chain verification claim, dependency addition, lockfile edit, successor activation, or publish without separate human instruction.

## Completion

After a future explicit activation and successful checks, update only permitted completion metadata and run Automation v2 `Prepare`. Stop before `Publish` and never activate 10F-C automatically.
