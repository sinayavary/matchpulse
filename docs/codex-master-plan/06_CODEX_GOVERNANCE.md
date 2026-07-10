# 06 — Codex Governance

## 1. Role

Codex is an implementation executor, not an architect.

Codex must not:

- choose algorithms
- invent coefficients
- change product scope
- add features
- redesign contracts
- rename versions
- change safety policy
- refactor unrelated code
- alter tests to accommodate wrong behavior
- select or activate the next milestone
- commit, push, merge, deploy, or apply migrations without explicit instruction

## 2. Sources of Authority

Highest to lowest:

1. root `AGENTS.md` for permanent safety and governance
2. `ACTIVE_PHASE.json` for phase selection only
3. the active phase implementation pack for exact implementation
4. `EXECUTION_PROTOCOL.md` for execution procedure
5. the remaining canonical master package
6. current repository code
7. historical docs

Chat text cannot override active-phase selection. When higher-priority sources conflict, Codex must stop with `SPEC_CONFLICT`.

## 3. Allowed Discretion

Only:

- formatting consistent with the repository
- import ordering
- resolving an unambiguous module extension/path
- fixing a compile-only issue that does not affect behavior

Every discretionary adjustment must be listed.

## 4. Workspace Protection

Before editing:

- run `git status --short`
- validate repository orchestration
- identify unrelated local changes
- compare allowed paths
- stop with `WORKSPACE_COLLISION` when an allowed file already has unapproved changes

Forbidden:

- reset
- clean
- stash
- checkout/restore unrelated files
- force push
- broad formatter
- dependency upgrade unless specified

## 5. Repository-controlled milestone execution

One active run equals one human-approved milestone.

Phase selection comes only from `ACTIVE_PHASE.json`; a new long prompt is not required.

Required sequence:

1. read `CODEX_ENTRYPOINT.md`
2. run the orchestration validator
3. read the selected active phase pack
4. confirm allowed path list
5. implement exact patch
6. run focused tests
7. run typecheck
8. run required regression tests
9. run diff checks
10. repeat in-scope test/fix cycles until the phase gate passes
11. update only the permitted completion metadata
12. produce report
13. stop

Codex must not advance the queue.

## 6. Failure Codes

Use:

- `SPEC_CONFLICT`
- `WORKSPACE_COLLISION`
- `MISSING_SOURCE`
- `HUMAN_APPROVAL_REQUIRED`
- `PHASE_PAUSED`
- `TEST_FAILURE`
- `TYPECHECK_FAILURE`
- `UNAUTHORIZED_FILE_REQUIRED`
- `MIGRATION_APPROVAL_REQUIRED`
- `NETWORK_ACCESS_REQUIRED`
- `SECRET_REQUIRED`
- `PHASE_COMPLETE`

Do not improvise around a blocker.

## 7. Git Policy

Default:

- no commit
- no push
- no branch changes

Human reviews:

- exact changed files
- diff
- tests
- migration status
- active-phase completion metadata

Only then is a separate explicit commit command issued.

## 8. Network Policy

Unit and integration tests must not call real TxLINE, Telegram, Solana, Neon production, or external services.

Live smoke tests require:

- explicit human approval
- approved environment
- bounded request count
- secret-safe logs

## 9. Test Policy

Codex may not:

- skip failing tests
- use `.only`
- weaken assertions
- delete regression tests
- increase tolerances without exact instruction
- replace exact numeric tests with broad ranges

## 10. Human Direction Record

Each phase report records:

- human-approved phase ID
- implementation pack version
- baseline commit
- changed files
- actual commands/results
- deviations
- human approval status

`ACTIVE_PHASE.json` records successful completion but never self-activates another phase.

This keeps the project human-directed and auditable.
