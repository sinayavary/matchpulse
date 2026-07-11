# MatchPulse Permanent Codex Continuation Prompt

Use this instruction in Codex after the architecture/source branch has been reviewed. It does not override repository-selected phase state.

```text
Work directly inside D:\money\matchpulse_repo.

The repository is the only authority for active phase selection. Do not ask me for a phase-specific prompt. Do not invent, approve, activate, reorder, merge, publish, migrate, deploy, or begin a successor phase unless the repository and a separate explicit human instruction authorize that exact action.

Read in order:
1. AGENTS.md
2. docs/codex-master-plan/CODEX_ENTRYPOINT.md
3. docs/codex-master-plan/EXECUTION_PROTOCOL.md
4. docs/codex-master-plan/ACTIVE_PHASE.json
5. docs/codex-master-plan/PHASE_QUEUE.json
6. docs/codex-master-plan/MATCHPULSE_COMPLETION_BLUEPRINT.md when present
7. the exact active phase pack referenced by ACTIVE_PHASE.json

Run Automation v2 Validate before editing:

Set-ExecutionPolicy -Scope Process Bypass
.\scripts\codex-automation-v2.ps1 -Mode Validate

If the repository identifies scripts\prepare-codex-run.ps1 as the canonical Automation v2 entrypoint, use that exact script instead. Never run both paths speculatively.

When the active phase state is ready and human-approved:
- verify baseline ancestry, pack identity, payload hashes, allowlist, working-tree collisions, migration/network flags, and publication policy
- apply only the exact committed payload or exact implementation declared by the active pack
- modify only allowed_target_files plus the permitted successful ACTIVE_PHASE.json completion transition
- preserve every unrelated modified and untracked file exactly
- never modify PHASE_QUEUE.json during phase execution
- run every required validation command and report real evidence
- fix only failures caused by the active phase and only inside the allowlist
- do not expose credentials, provider payloads, private model formulas, coefficients, thresholds, assigned policy values, or internal lineage
- do not add betting recommendations, stake, payout, profit, expected value, wallet requirements, trading, or gambling UI
- do not use git add ., git add -A, reset, clean, stash, rebase, force push, broad formatting, or unrelated restore/checkout
- do not access real TxLINE, Solana, database, Telegram, or production services unless the active manifest explicitly allows network access and the required human gate is recorded
- do not create or apply Prisma changes unless Gate 1 and the exact migration phase are explicitly approved

After every declared validation passes:
- update ACTIVE_PHASE.json only to completed_pending_review
- set human_approved to false
- set last_result.status to PHASE_COMPLETE
- record exact sorted changed implementation paths, actual validation results, UTC completion time, migration_applied, and network_accessed
- run Automation v2 Prepare
- stop with PHASE_COMPLETE_PREPARED before Publish

Publish only after a separate explicit human instruction. Publish must be non-force HEAD:main, fast-forward-only, with exact filename verification and unchanged unrelated work.

After a phase is published, stop. A separate reviewed governance change must install and activate the next exact phase pack. Continue using the same permanent instruction for every later phase.

On any blocker, stop with the exact repository-defined stop code and concrete evidence. Never improvise around a gate or claim an unexecuted test, commit, push, migration, network check, or deployment.
```

## Intended continuation order

1. Complete and publish the currently active 10F-C phase.
2. Review and merge the architecture-only completion blueprint.
3. Review and activate exactly one source pack at a time.
4. Prefer pure non-database phases such as 10H-A and 10G-A/B while Gate 1 is blocked.
5. Keep database, public contract, notification, Solana/network, deployment, and release phases behind their explicit gates.
