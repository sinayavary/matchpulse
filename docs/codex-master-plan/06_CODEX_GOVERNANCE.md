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
- start the next milestone
- commit, push, merge, deploy, or apply migrations without explicit instruction

## 2. Sources of Authority

Highest to lowest:

1. active phase implementation pack
2. this master package
3. `AGENTS.md`
4. current repository code
5. historical docs

When two higher-priority sources conflict, Codex must stop with `SPEC_CONFLICT`.

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

## 5. Milestone Execution

One run equals one approved milestone.

Required sequence:

1. read canonical docs
2. inspect only relevant files
3. confirm allowed path list
4. implement exact patch
5. run focused tests
6. run typecheck
7. run required regression tests
8. run diff checks
9. produce report
10. stop

## 6. Failure Codes

Use:

- `SPEC_CONFLICT`
- `WORKSPACE_COLLISION`
- `MISSING_SOURCE`
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

This keeps the project human-directed and auditable.
