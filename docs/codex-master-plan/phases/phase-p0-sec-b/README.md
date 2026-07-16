# Phase P0-SEC-B v1 — Telegram Webhook, Raw Audit and Legacy Route Isolation

## Authority

Executable only while `ACTIVE_PHASE.json` selects `P0-SEC-B`, state is ready,
and the phase is approved by repository governance.

## Behavior

- Keep the existing central auth boundary for all internal routes.
- Never log Telegram request bodies or credentials.
- Keep `/api/matches/:fixtureId/raw` unavailable to public callers.
- Remove `raw_payloads` from the runtime audit HTTP response while retaining
  internal audit processing/storage for later authorized operations.
- Preserve public safe DTOs and all non-raw legacy route behavior.

## Allowlist

- `apps/api/src/security-route-isolation.test.ts`
- `apps/api/src/server.ts`
- `apps/api/src/txline-runtime-audit-routes.ts`
- `docs/codex-master-plan/ACTIVE_PHASE.json`
- `docs/codex-master-plan/PHASE_QUEUE.json`
- `docs/codex-master-plan/phases/phase-p0-sec-b/EXPECTED_SHA256.json`
- `docs/codex-master-plan/phases/phase-p0-sec-b/README.md`
- `docs/codex-master-plan/phases/phase-p0-sec-b/manifest.json`
- `docs/codex-master-plan/phases/phase-p0-sec-b/payload/README.md`
- `docs/phase-p0-sec-b-isolation.md`

No schema, migration, frontend, dependency, provider, deployment, or secret
file may change.

## Validation

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/security-route-isolation.test.ts src/internal-auth-boundary.test.ts
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api build
pnpm.cmd --filter @matchpulse/api test
git diff --check
git diff --name-only -- prisma
```

## Completion and rollback

Record exact evidence in `ACTIVE_PHASE.json`, commit only the allowlist, and
publish fast-forward without force. Rollback is a single revert; no data
migration exists. P0-SEC-C must remain inactive in this phase commit.
