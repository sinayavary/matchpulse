# MatchPulse Repository-Controlled Execution Protocol

## 1. Purpose

This protocol removes repeated phase-specific chat prompts. The repository itself selects and defines the active work.

Codex receives one permanent instruction: read `CODEX_ENTRYPOINT.md` and execute the repository-selected phase.

## 2. Human-directed boundary

Codex may continue autonomously only inside one human-approved active phase.

Codex must not:

- select the next phase
- change queue order
- approve a phase
- cross a migration, public-contract, deployment, secret, paid-service, or commit/push gate
- reinterpret missing architecture or algorithms

This preserves human direction while eliminating repetitive prompt transfer.

## 3. Orchestration files

### `ACTIVE_PHASE.json`

The only source for current phase selection and authorization.

### `PHASE_QUEUE.json`

Read-only project sequence and dependency record. Codex never edits it.

### Active phase pack

Contains the exact implementation, files, formulas, tests, validation commands, and stop condition.

### `CODEX_ENTRYPOINT.md`

Permanent reusable instruction.

### `scripts/prepare-codex-run.ps1`

Validates orchestration state and workspace safety before execution.

## 4. Active-phase states

### `awaiting_pack`

The next phase is identified, but its exact pack is absent.

Result: `MISSING_SOURCE`.

### `awaiting_human_approval`

The pack exists, but execution has not been approved.

Result: `HUMAN_APPROVAL_REQUIRED`.

### `ready`

The pack exists, is committed, is approved, and may be executed.

Codex continues until the phase gate passes or a stop code applies.

### `paused`

Execution is intentionally suspended.

Result: `PHASE_PAUSED`.

### `completed_pending_review`

Implementation and validations completed. Human review, staging, commit, and push remain.

Codex must not rerun or activate the next phase.

## 5. Required active-phase fields

`ACTIVE_PHASE.json` must contain:

- `schema_version`
- `project`
- `state`
- `phase_id`
- `phase_title`
- `pack_path`
- `pack_version`
- `baseline_commit`
- `human_approved`
- `activation_note`
- `execution`
- `last_result`

For state `ready`:

- `pack_version` must be non-empty
- `baseline_commit` must be a valid ancestor of `HEAD`
- `human_approved` must be `true`
- the pack directory and required pack files must exist and be committed
- allowed target files must not contain unrelated local changes
- allowed targets must not have committed changes after the baseline unless the pack explicitly allows them

## 6. Pack manifest contract

Every future active phase manifest must contain:

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

## 7. Preflight algorithm

1. Verify repository root.
2. Parse orchestration JSON.
3. Verify schema versions and recognized state.
4. Verify the active phase exists in the queue.
5. For `ready`, verify human approval.
6. Load the referenced manifest.
7. Match phase ID, pack version, and baseline.
8. Verify baseline commit exists and is an ancestor of `HEAD`.
9. Verify active orchestration and pack files are tracked and clean.
10. Verify no allowed target has local changes.
11. Verify no allowed target changed in committed history after baseline.
12. Continue only when every check passes.

## 8. Continuous phase loop

Within a `ready` phase:

1. read all pack instructions
2. verify payload hashes
3. apply only exact allowed changes
4. run focused validation
5. fix only active-phase failures within allowed files
6. rerun focused validation
7. run typecheck
8. run required regression/full suites
9. run diff and migration/network checks
10. repeat only within scope until all required checks pass
11. report and stop

Routine test-fix-test cycles do not require a new human prompt.

## 9. Successful completion metadata transition

Only after all required validations pass, Codex may modify `ACTIVE_PHASE.json` as the global metadata exception.

It must preserve every existing field except:

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

- `status` must be `PHASE_COMPLETE`
- `phase_id`, `pack_version`, and `baseline_commit` must match the active file
- `completed_at` must be a valid UTC ISO timestamp
- `files_changed` must be a sorted unique list containing only allowed target files
- `validation_summary` must be a concise list of actual results
- `migration_applied` must be `false` unless an explicitly approved migration phase says otherwise
- `network_accessed` must be `false` unless an explicitly approved bounded network phase says otherwise

Codex must not modify `phase_id`, `pack_path`, queue state, or activate another phase.

## 10. Failure behavior

On any failure:

- do not change orchestration state
- do not broaden file scope
- do not weaken tests
- return the applicable stop code with evidence
- stop

## 11. Human review and next activation

After `completed_pending_review`, the human:

1. reviews exact changes and test evidence
2. stages only approved files, including the active metadata transition
3. commits and pushes
4. receives the next exact phase pack
5. commits the pack and the updated `ACTIVE_PHASE.json`
6. invokes the same permanent entrypoint again

No new long Codex prompt is required.
