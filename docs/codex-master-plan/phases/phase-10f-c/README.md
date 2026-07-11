# Phase 10F-C v1 — TxLINE Stream Supervision and Complete Client Regression Closure

Phase: 10F-C
Pack: 10F-C-v1
Baseline: c1b2461ec42db2af1d93bfb5af7dcdb714bb2c7e

## Review boundary

This pack is for review only. Merging it does not activate it. `ACTIVE_PHASE.json` and `PHASE_QUEUE.json` are unchanged. Payload execution is permitted only after separate human approval and repository-controlled activation; Codex will exact-copy the payload without redesign. A future run begins with Automation v2 Validate, may only Prepare after successful validation, and stops before Publish. No successor phase is activated automatically, and no migration or real network call is permitted.

## Objective

Deliver cancellation-aware SSE transport, Last-Event-ID resume support, consistent stream error sanitization in the live wrapper, deterministic reconnect supervision, fixed bounded backoff, heartbeat/inactivity timeout, graceful abort and reader cleanup, an optional bounded REST catch-up hook, bounded event-ID duplicate suppression, score/odds convenience supervisors, and regression coverage. This adds no persistence, worker or route integration, or on-chain proof verification.

## Exact target allowlist

- `docs/phase-10f-c-txline-stream-supervision.md`
- `packages/txline-client/package.json`
- `packages/txline-client/src/client.test.ts`
- `packages/txline-client/src/client.ts`
- `packages/txline-client/src/index.ts`
- `packages/txline-client/src/live.ts`
- `packages/txline-client/src/supervisor.test.ts`
- `packages/txline-client/src/supervisor.ts`

## Validation commands

```powershell
pnpm.cmd --filter @matchpulse/txline-client test
pnpm.cmd --filter @matchpulse/txline-client typecheck
pnpm.cmd --filter @matchpulse/txline-client build
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api test
git diff --check
git diff --name-only -- prisma
```
