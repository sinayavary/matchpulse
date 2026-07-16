# Phase P0-SEC-A v1 — Internal Route Authentication Boundary

## Authority

This pack is repository-controlled and executable only while
`ACTIVE_PHASE.json` selects `P0-SEC-A`, `state=ready`, and `human_approved=true`.

## Baseline and behavior

- Baseline: `2d5c9958471e4a70d227b19ed78ec5424cc22662`
- No migration, database write, external provider call, or production network.
- Register one global Fastify `onRequest` boundary for `/api/internal/`.
- Use the existing `MATCHPULSE_INTERNAL_TOKEN` verifier and preserve its
  bearer/header compatibility.
- Return 401 for missing, malformed, or invalid request credentials.
- Return 503 when server authentication configuration is absent.
- Do not echo or log secrets; public routes remain unaffected.

## Exact allowlist

- `AGENTS.md`
- `apps/api/src/internal-auth-boundary.test.ts`
- `apps/api/src/internal-auth-boundary.ts`
- `apps/api/src/server.ts`
- `docs/codex-master-plan/ACTIVE_PHASE.json`
- `docs/codex-master-plan/CODEX_ENTRYPOINT.md`
- `docs/codex-master-plan/CODEX_MASTER_PROMPT.md`
- `docs/codex-master-plan/EXECUTION_PROTOCOL.md`
- `docs/codex-master-plan/PHASE_QUEUE.json`
- `docs/codex-master-plan/phases/phase-p0-sec-a/EXPECTED_SHA256.json`
- `docs/codex-master-plan/phases/phase-p0-sec-a/README.md`
- `docs/codex-master-plan/phases/phase-p0-sec-a/manifest.json`
- `docs/codex-master-plan/phases/phase-p0-sec-a/payload/README.md`
- `docs/phase-p0-sec-a-internal-route-auth.md`
- `scripts/codex-automation-v2.ps1`

No frontend, Prisma schema, migration, worker, TxLINE client, Telegram
transport, secret, dependency, or unrelated worktree file may change.

## Validation

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/internal-auth.test.ts src/internal-auth-boundary.test.ts
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api build
pnpm.cmd --filter @matchpulse/api test
git diff --check
git diff --name-only -- prisma
git status --short
```

Expected: focused security tests pass, API typecheck/build/regression pass,
Prisma diff is empty, no migration or production network is used, and the
primary dirty worktree remains unchanged.

## Stop codes

Use `HUMAN_GATE_DATABASE_MIGRATION_REQUIRED`,
`HUMAN_GATE_PRODUCTION_NETWORK_REQUIRED`, `HUMAN_GATE_PUBLIC_CONTRACT_REQUIRED`,
`WORKSPACE_COLLISION`, `REMOTE_DIVERGED`, or
`AUTONOMOUS_MATCHPULSE_TEST_BLOCKED` as applicable.

## Completion

Record exact changed paths and validation evidence in `ACTIVE_PHASE.json`,
run exact-path Prepare, and stop before Publish. Do not activate P0-SEC-B in
the same phase commit.
