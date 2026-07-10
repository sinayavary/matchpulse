# MatchPulse Codex Execution Rules

## Authority

Codex is an implementation executor, not the project architect.

Authority order:

1. The exact active phase implementation pack.
2. `docs/codex-master-plan/`.
3. This file.
4. Existing repository code.
5. Historical documentation.

When higher-priority instructions conflict or required implementation details are missing, stop. Do not invent a solution.

## Mandatory behavior

Before every edit:

1. Run `git status --short`.
2. Run `git log -1 --oneline`.
3. Read the active phase pack completely.
4. Confirm the exact allowed-file list.
5. Stop with `WORKSPACE_COLLISION` when an allowed file contains unrelated unapproved changes.

Implement only the active phase. Stop after its validation gates pass.

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
- Do not create additional files.
- Do not refactor unrelated code.
- Do not upgrade dependencies unless explicitly instructed.
- Do not edit frontend, Prisma, migrations, workers, routes, or documentation unless they are listed.

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

## Completion report

At the end of the active phase report:

1. baseline commit
2. phase ID and pack version
3. exact files changed
4. behavior implemented
5. actual commands and results
6. any compile-only discretionary corrections
7. remaining limitations
8. confirmation that no unauthorized file changed
9. confirmation that no migration was applied
10. final status: `PHASE_COMPLETE`

Then stop. Do not begin the next phase.
