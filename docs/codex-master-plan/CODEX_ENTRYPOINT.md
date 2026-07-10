# MatchPulse Permanent Codex Entrypoint

Work directly inside:

`D:\money\matchpulse_repo`

This is the permanent repository-controlled entrypoint. Do not ask the human to paste a phase-specific prompt and do not infer the phase from chat text.

## Read order

1. `AGENTS.md`
2. `docs/codex-master-plan/EXECUTION_PROTOCOL.md`
3. `docs/codex-master-plan/ACTIVE_PHASE.json`
4. `docs/codex-master-plan/PHASE_QUEUE.json`
5. the exact implementation pack referenced by `ACTIVE_PHASE.json`
6. the remaining canonical master-plan documents required by that pack

## Preflight

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\prepare-codex-run.ps1 -ValidateOnly
```

A nonzero exit or explicit stop code ends the run.

## State handling

- `awaiting_pack` → return `MISSING_SOURCE`
- `awaiting_human_approval` → return `HUMAN_APPROVAL_REQUIRED`
- `paused` → return `PHASE_PAUSED`
- `completed_pending_review` → report that the active phase is already complete and stop
- `ready` → execute the referenced phase pack

Only `ready` authorizes implementation.

## Execution rule

Execute the active phase continuously until one of these occurs:

1. every required validation gate passes
2. a declared stop code applies
3. a human-only action is required

Do not pause for routine choices already resolved by the pack. Do not request a new prompt. Do not begin another phase.

## Completion

After all phase checks pass:

1. produce the report required by `AGENTS.md`
2. perform the exact successful-completion metadata transition in `ACTIVE_PHASE.json`
3. return `PHASE_COMPLETE`
4. stop

The human reviews, commits, pushes, and later activates the next phase through repository files.
