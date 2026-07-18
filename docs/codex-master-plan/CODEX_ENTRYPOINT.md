# MatchPulse Permanent Codex Entrypoint — Automation v2

Use the repository's clean execution worktree. Preserve `D:\money\matchpulse_repo` as read-only when it contains user changes; the active root must be reported by the executor.

The repository selects the active phase. Autonomous recovery may install and activate a successor only after recording the review, rationale, dependency, and exact pack in repository governance.

## Read order

1. `AGENTS.md`
2. `docs/codex-master-plan/EXECUTION_PROTOCOL.md`
3. `docs/codex-master-plan/ACTIVE_PHASE.json`
4. `docs/codex-master-plan/PHASE_QUEUE.json`
5. the exact implementation pack referenced by `ACTIVE_PHASE.json`
6. the remaining canonical documents required by that pack

## Automation v2 sequence

### 1. Validate before editing

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\codex-automation-v2.ps1 -Mode Validate
```

This fetches `origin/main`, synchronizes local `main` only by fast-forward, validates the active pack and allowlist, and records the exact unrelated working-tree state inside `.git`.

A nonzero result or explicit stop code ends the run.

### 2. Execute only the active phase

When state is `ready`:

- read the full pack
- verify payload hashes
- modify only explicit allowed implementation files
- run every validation command in the pack
- perform only the permitted `ACTIVE_PHASE.json` completion transition
- preserve all unrelated local modified and untracked files
- do not change `PHASE_QUEUE.json`
- after successful completion, a clean recovery worktree may select and activate the next repository-recorded phase unless a human gate or blocker is reached

### 3. Prepare one scoped commit

After every phase gate passes:

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Prepare
```

Prepare verifies that `origin/main` did not move, confirms unrelated local work exactly matches the pre-execution snapshot, stages only explicit approved paths, and creates one phase completion commit. It does not push.

### 4. Stop for human review

Report:

1. baseline commit
2. phase ID and pack version
3. exact files committed
4. behavior implemented
5. actual commands and results
6. migration/network status
7. confirmation that unrelated work remains unchanged and unstaged
8. confirmation that no next phase was activated
9. final status: `PHASE_COMPLETE_PREPARED`

### 5. Publish only on explicit human instruction

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Publish
```

Publish fetches again, requires exactly one prepared commit directly above `origin/main`, validates its filenames against completion metadata, and pushes `HEAD:main` without force.

## State handling

Before production acceptance, verify the phase-specific exception in `EXECUTION_PROTOCOL.md`; only `PROD-LIVE-E2E-ACCEPTANCE-A-v1` may use its read-only production allowlist. Normal production stops remain unchanged for all other phases.

- `awaiting_pack` → `MISSING_SOURCE`
- `awaiting_human_approval` → `HUMAN_APPROVAL_REQUIRED`
- `paused` → `PHASE_PAUSED`
- `completed_pending_review` → review completion evidence; if valid, record the approved terminal transition and activate the next repository-recorded phase in a clean recovery worktree
- `ready` → execute the exact referenced pack

## Permanent instruction

```text
Work directly inside D:\money\matchpulse_repo. Read AGENTS.md and docs/codex-master-plan/CODEX_ENTRYPOINT.md. Run Automation v2 Validate, execute only the repository-selected active phase and all pack validations, update only permitted completion metadata, then run Automation v2 Prepare. Stop before Publish and never activate the next phase.
```
