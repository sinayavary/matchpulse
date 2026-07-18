# MatchPulse Repository-Controlled Execution Protocol — Automation v2

## 1. Purpose

The repository selects and defines the active phase. Automation v2 adds a guarded Git lifecycle around that phase so Codex can synchronize, implement, validate, create one scoped commit, and—only after a separate explicit human instruction—publish it to `origin/main`.

Automation v2 never selects or activates the next phase.

## 2. Human-directed boundary

Codex is an implementation executor, not the architect. It must not independently:

- select the next phase or change queue order
- approve or activate a phase
- cross a migration, network, public-contract, deployment, secret, paid-service, or production-data gate
- reinterpret missing architecture, formulas, thresholds, schemas, or contracts
- publish a prepared commit unless the human explicitly instructs `Publish`

## 3. Orchestration files

### `ACTIVE_PHASE.json`

The only source for active-phase selection and authorization.

### `PHASE_QUEUE.json`

Read-only dependency and order record. Codex never edits it during phase execution.

### Active phase pack

Contains the exact implementation, allowlist, tests, validation commands, expected results, and gate declarations.

### `CODEX_ENTRYPOINT.md`

Permanent reusable instruction and Automation v2 command sequence.

### `scripts/prepare-codex-run.ps1`

Implements Automation v2 with three explicit modes:

- `Validate`
- `Prepare`
- `Publish`

## 4. Active-phase states

- `awaiting_pack` → `MISSING_SOURCE`
- `awaiting_human_approval` → `HUMAN_APPROVAL_REQUIRED`
- `paused` → `PHASE_PAUSED`
- `completed_pending_review` → no implementation; only a previously prepared commit may be published
- `ready` → the approved pack may be implemented

The mandatory production stop condition remains for every phase except the exact `PROD-LIVE-E2E-ACCEPTANCE-A-v1` read-only exception and the exact gated `MATCHES-PRODUCTION-ROLLOUT-A-v1` exception. The rollout exception begins `awaiting_human_approval`; governance publication authorizes no external action. It may become executable only after explicit approval and then requires a separate explicit human instruction for every gate named in its README and manifest. Each instruction authorizes only one environment and one operation. Missing scope identity, gate approval, evidence, or secret availability produces the applicable stop code without broadening access.

For `MATCHES-PRODUCTION-ROLLOUT-A-v1`, migration, deployment, backfill and production acceptance are never inferred from `state=ready` or `human_approved=true`. They require their own gate instruction. Mutation attempts are single-attempt unless the pack explicitly classifies the operation as read-only. The migration is limited to `20260718210000_fixture_competition_id`, and rollback is forward-only without dropping source data.

Only `ready` authorizes implementation.

## 5. Pack manifest contract

Every phase manifest must contain:

```json
{
  "schema_version": "matchpulse-phase-pack-v1",
  "phase": "PHASE_ID",
  "pack_version": "PACK_VERSION",
  "baseline_commit": "40_CHARACTER_SHA",
  "allowed_target_files": ["path"],
  "required_validation_commands": ["command"],
  "expected_results": ["result"],
  "allows_migration": false,
  "allows_network": false
}
```

The pack also contains:

- `README.md`
- `manifest.json`
- `EXPECTED_SHA256.json`
- `payload/`

The phase README remains the exact implementation authority.

## 6. Automation v2 — Validate

Run before editing:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\prepare-codex-run.ps1 -Mode Validate
```

Validate performs these steps:

1. Require local branch `main`.
2. Run `git fetch --prune origin main`.
3. Synchronize local `main` only through `git merge --ff-only origin/main`.
4. Refuse a local-ahead or diverged branch.
5. Validate orchestration schemas, state, phase identity, pack identity, baseline ancestry, and unique safe allowlist paths.
6. Require `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, `CODEX_ENTRYPOINT.md`, and the active pack to be tracked and clean.
7. Require every allowed implementation target to be clean before execution.
8. Require allowed targets not to have committed changes after the pack baseline.
9. Record the exact unrelated working-tree status in `.git/codex-automation-v2-snapshot.json`.

The snapshot is local Git metadata, is never staged, and is used only to prove that unrelated work remains unchanged.

## 7. Phase execution

After Validate passes, Codex:

1. reads the full active pack
2. verifies payload hashes
3. modifies only `allowed_target_files`
4. runs every required focused, typecheck, regression, diff, migration, and network check
5. fixes only active-phase failures and only within the allowlist
6. performs the exact permitted successful-completion transition in `ACTIVE_PHASE.json`
7. does not edit `PHASE_QUEUE.json`
8. does not activate another phase

Routine in-scope test/fix cycles do not require another human prompt.

## 8. Successful completion metadata

Only after all required validations pass, Codex may change `ACTIVE_PHASE.json` as the global metadata exception:

```text
state = "completed_pending_review"
human_approved = false
last_result = {
  status,
  phase_id,
  pack_version,
  baseline_commit,
  completed_at,
  files_changed,
  validation_summary,
  migration_applied,
  network_accessed
}
```

Requirements:

- `status` is `PHASE_COMPLETE`
- phase identity fields remain unchanged
- `completed_at` is a valid UTC ISO timestamp
- `files_changed` is a sorted unique list containing only changed allowed implementation targets
- migration/network flags reflect actual approved behavior
- no next-phase state is installed

## 9. Automation v2 — Prepare

After successful implementation and validation, run:

```powershell
.\scripts\prepare-codex-run.ps1 -Mode Prepare
```

Prepare:

1. fetches `origin/main` again
2. requires local `HEAD`, fetched `origin/main`, and the Validate snapshot baseline to remain identical
3. requires protected orchestration sources other than the permitted `ACTIVE_PHASE.json` transition to remain clean
4. compares all unrelated local status lines with the Validate snapshot and stops if any unrelated work was added, removed, or modified
5. derives changed phase files only from the manifest allowlist plus `ACTIVE_PHASE.json`
6. validates the completion metadata against the actual implementation diff
7. runs `git diff --check` on the exact changed phase paths
8. stages each approved path through an explicit `git add -- <path>` call
9. verifies the staged filename set exactly matches the approved changed-file set
10. creates one phase completion commit whose parent is the fetched `origin/main`
11. leaves every unrelated modified or untracked file unchanged and unstaged

Forbidden commands remain forbidden: `git add .`, `git add -A`, reset, clean, stash, rebase, unrelated checkout/restore, and force push.

## 10. Human review boundary

After Prepare, Codex stops. The human reviews:

- commit and parent
- exact changed filenames
- full diff
- test evidence
- migration/network evidence
- completion metadata
- confirmation that unrelated local work is still present and unstaged

Automation v2 does not automatically publish after Prepare.

## 11. Automation v2 — Publish

Only after explicit human instruction, run:

```powershell
.\scripts\prepare-codex-run.ps1 -Mode Publish
```

Publish:

1. requires branch `main`
2. fetches `origin/main` again
3. requires an empty index
4. requires exactly one local commit ahead of `origin/main`
5. requires that commit's parent to equal the fetched `origin/main`
6. requires the commit's filenames to equal `last_result.files_changed` plus `ACTIVE_PHASE.json`
7. runs `git push origin HEAD:main` without force
8. refuses the push if `origin/main` moved or history diverged
9. preserves unrelated unstaged and untracked local work

## 12. Failure behavior

On any failure:

- do not broaden file scope
- do not weaken tests
- do not alter unrelated local work
- do not activate another phase
- do not force push
- return the applicable explicit stop code with evidence
- stop

## 13. Next phase

After the completion commit is published and reviewed, a separate governance change may install and activate the next exact phase pack on a separate branch. Phase execution itself never edits queue order or self-activates a successor.

## 14. Autonomous recovery worktree

When the primary worktree contains unrelated user changes or an incoming overlap, it is read-only for the run. The executor must fetch `origin/main`, verify `git worktree list`, and create or reuse a clean secondary worktree from the fetched `origin/main` on a unique `agent/autonomous-*` branch. No files, index entries, or refs belonging to the primary worktree may be reset, stashed, cleaned, restored, staged, committed, or deleted.

In that clean recovery worktree, an explicitly authorized autonomous run may review a valid `completed_pending_review` phase, record its completion evidence and rationale, install a repository-controlled successor pack, activate it, and execute it. The transition must preserve queue integrity, exact allowlists, hashes, rollback instructions, and all human gates. Production network, production database writes, migrations, secrets, breaking public contracts, destructive operations, licensing, retention, wallet, and unresolved product ownership decisions remain mandatory stop conditions.
