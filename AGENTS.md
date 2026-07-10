# MatchPulse Codex Execution Rules

## Authority

Codex is an implementation executor, not the project architect.

Authority order:

1. This `AGENTS.md` for permanent safety and governance.
2. `docs/codex-master-plan/ACTIVE_PHASE.json` for active-phase selection only.
3. The implementation pack referenced by `ACTIVE_PHASE.json` for exact phase behavior.
4. `docs/codex-master-plan/EXECUTION_PROTOCOL.md` for execution procedure.
5. The remaining canonical files under `docs/codex-master-plan/`.
6. Existing repository code.
7. Historical documentation.

Chat text must not select a different phase from `ACTIVE_PHASE.json`. When sources conflict or required implementation details are missing, stop. Do not invent a solution.

## Mandatory behavior

Before every edit:

1. Run `git status --short`.
2. Run `git log -1 --oneline`.
3. Read `docs/codex-master-plan/CODEX_ENTRYPOINT.md`.
4. Read and validate `ACTIVE_PHASE.json`.
5. Read the referenced active phase pack completely.
6. Confirm the exact allowed-file list.
7. Stop with `WORKSPACE_COLLISION` when an allowed file contains unrelated unapproved changes.

When the active state is `ready`, continue implementing and correcting only the active phase until its validation gate passes or a declared blocker is reached. Do not ask for routine confirmation inside an approved phase.

Do not activate or begin another phase.

## Codex must not decide

Codex must not independently choose or change:

- product scope
- system architecture
- algorithms
- mathematical formulas
- coefficients, thresholds, tolerances, or model weights
- schemas or migrations
- public API contracts
- security boundaries
- naming/versioning
- deployment topology
- testing standards
- active phase or queue order

When one of these is not explicitly defined, stop with `MISSING_SOURCE`.

## Workspace protection

Never run:

- `git reset`
- `git clean`
- `git stash`
- `git checkout --`
- `git restore` on unrelated work
- force push
- broad workspace formatting

Preserve all unrelated local changes.

## File scope

- Modify only files explicitly listed by the active phase pack.
- Do not create additional implementation files.
- Do not refactor unrelated code.
- Do not upgrade dependencies unless explicitly instructed.
- Do not edit frontend, Prisma, migrations, workers, routes, or documentation unless they are listed.
- `ACTIVE_PHASE.json` is the only global metadata exception, and only the exact successful-completion transition defined by `EXECUTION_PROTOCOL.md` is allowed.
- Never modify `PHASE_QUEUE.json`.

## Safety and confidentiality

Never expose or add public fields containing:

- raw provider payloads
- credentials, tokens, keys, or secrets
- private provider weighting
- model coefficients or private weights
- proprietary formulas or thresholds
- internal debug lineage
- hidden reasoning

Do not add:

- bet execution
- betting recommendations
- stake, payout, profit, or expected-value features
- wallet requirements for normal users
- unsupported claims of verification or accuracy

MatchPulse is an informational sports-intelligence product.

## Testing

Run exactly the validation commands listed in the active phase pack.

Do not:

- claim tests were run without terminal evidence
- skip failures
- delete or weaken tests
- add `.only`
- increase tolerances
- replace exact assertions with broad assertions

Fix only failures caused by the active phase and only in allowed files.

## Database and network

Do not:

- apply migrations without a separate explicit human command
- access production services
- use real TxLINE, Telegram, Solana, or production Neon credentials
- perform unapproved network smoke tests

## Git

Do not commit, push, merge, rebase, deploy, or change branches unless explicitly instructed in a separate human message.

## Stop codes

Use only the applicable explicit status:

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

## Completion report

At the end of the active phase report:

1. baseline commit
2. phase ID and pack version
3. exact files changed
4. behavior implemented
5. actual commands and results
6. any compile-only discretionary corrections
7. remaining limitations
8. confirmation that no unauthorized implementation file changed
9. confirmation that no migration was applied
10. confirmation that `PHASE_QUEUE.json` was not changed
11. final status: `PHASE_COMPLETE`

On successful completion, perform only the exact `ACTIVE_PHASE.json` completion transition permitted by `EXECUTION_PROTOCOL.md`. Then stop. Do not begin the next phase.
