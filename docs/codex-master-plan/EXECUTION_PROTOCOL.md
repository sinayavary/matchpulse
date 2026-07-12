# MatchPulse Repository-Controlled Execution Protocol — Automation v2

## Modes and selection

Automation v2 always requires exact phase identity, an exact safe allowlist, manifest declarations, acceptance criteria, validation commands, expected results, and collision checks.

In **phase mode**, only `ACTIVE_PHASE.json` selects work. Validate, execute, update permitted completion metadata, and Prepare. Publish requires separate human instruction. The phase may not alter `PHASE_QUEUE.json` or activate a successor.

In **enabled program mode**, execute the ready active phase first. After its scoped commit is published and remote equality is verified, a separate program-transition commit records its queue completion and selects the first phase in `PROGRAM_PLAN.json` listed order that is not completed or deferred, whose dependencies are completed, and whose exact canonical gate IDs have one approved canonical resolution in `COMPETITION_GATE_RESOLUTIONS.json`. Legacy aliases are descriptive only and never authorize activation. Unknown, duplicate, pending, blocked, or unresolved gate identities fail closed. Maximum parallel execution is one.

If that phase lacks a pack, author an exact pack from the authorized sources listed in `AGENTS.md`. It must contain exact targets, acceptance criteria, commands, expected results, rollback or degraded behavior, applicable payload SHA-256 hashes, migration/network declarations, and publication policy. Reversible implementation choices are autonomous; safety and product boundaries are immutable.

## Validate, execute, and Prepare

Validate fetches `origin/main`, permits synchronization only by fast-forward, verifies ancestry, state, pack identity, hashes, allowlist uniqueness, dependencies, gates, and clean targets, and snapshots unrelated work in local Git metadata.

Execute only allowed targets, run every manifest command, fix only phase-caused failures in scope, and accurately record migration and network behavior. Successful completion metadata may be updated as declared by the active execution policy. It must preserve phase identity and include status, UTC completion time, sorted changed files, validation evidence, and accurate migration/network flags.

Prepare refetches, requires the baseline and unrelated snapshot to be unchanged, stages exact paths individually, verifies the staged set, runs `git diff --check`, and creates exactly one scoped phase commit. It never pushes by itself.

## Publish

Phase-mode Publish requires explicit human instruction. Enabled-program Publish may run automatically only if both manifest and program policy allow it. It must refetch; require all validations passed; require only allowlisted implementation plus permitted completion metadata; prove no external service, shared/remote database, secret, deployment, or irreversible operation occurred; require `origin/main` unchanged; require exactly fast-forward-safe history; and push without force.

Migration publication additionally requires explicit manifest permission, isolated local or ephemeral PostgreSQL 16, schema validation, migration diff and test, data-integrity verification, and rollback or forward-fix instructions.

After push, fetch and verify remote equality. Only then may a separate governance-only transition commit update queue completion and activate the deterministic successor. Phase execution itself never activates it.

## Failure and stop codes

Do not broaden scope or weaken a gate. Preserve unrelated work and stop with evidence using: `SPEC_CONFLICT`, `WORKSPACE_COLLISION`, `MISSING_SOURCE`, `HUMAN_APPROVAL_REQUIRED`, `PHASE_PAUSED`, `TEST_FAILURE`, `TYPECHECK_FAILURE`, `UNAUTHORIZED_FILE_REQUIRED`, `MIGRATION_APPROVAL_REQUIRED`, `NETWORK_ACCESS_REQUIRED`, `SECRET_REQUIRED`, `NON_FAST_FORWARD`, `UNRELATED_WORK_CHANGED`, `STAGING_SCOPE_VIOLATION`, `SECURITY_BLOCKER`, `DATA_INTEGRITY_RISK`, `IRREVERSIBLE_OPERATION_REQUIRED`, or `PHASE_COMPLETE_PREPARED`. Successful continuous completion ends with `PROGRAM_COMPLETE`.
