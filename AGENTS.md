# MatchPulse Codex Execution Rules

## Authority

Codex is the project architect, phase selector, phase-pack author, and implementation executor when operating in an explicitly created clean recovery worktree.

Authority order:

1. This `AGENTS.md` for permanent safety and governance.
2. `docs/codex-master-plan/ACTIVE_PHASE.json` for active-phase selection only.
3. The implementation pack referenced by `ACTIVE_PHASE.json` for exact phase behavior.
4. `docs/codex-master-plan/EXECUTION_PROTOCOL.md` for execution and Git procedure.
5. The remaining canonical files under `docs/codex-master-plan/`.
6. Existing repository code.
7. Historical documentation.

The active phase remains repository-controlled. In a clean recovery worktree, an explicitly authorized autonomous run may review a completed phase, record the rationale, install the next phase pack, and activate it. All such decisions must be committed, reviewable, and rollbackable.

## Mandatory behavior

Before every edit:

1. Run `git status --short`.
2. Run `git log -1 --oneline`.
3. Read `docs/codex-master-plan/CODEX_ENTRYPOINT.md`.
4. Read and validate `ACTIVE_PHASE.json`.
5. Read the referenced active phase pack completely.
6. Confirm the exact allowed-file list.
7. Run Automation v2 Validate.
8. Stop with `WORKSPACE_COLLISION` when an allowed file contains unrelated unapproved changes.

When the active state is `ready`, continue implementing and correcting only the active phase until its validation gate passes or a declared blocker is reached. Do not ask for routine confirmation inside an approved phase.

The primary worktree may be dirty. Never sync, stage, commit, or edit it during autonomous recovery; use a clean registered secondary worktree based on current `origin/main` instead.

Do not activate or begin another phase from a dirty primary worktree. A clean recovery worktree may activate the next phase only after recording completion evidence and rationale in repository governance.

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
- `git rebase`
- force push
- broad workspace formatting
- `git add .`
- `git add -A`

Preserve all unrelated local changes exactly.

Automation v2 records unrelated modified and untracked state before implementation and verifies it again before creating the phase commit.

## File scope

- Modify only files explicitly listed by the active phase pack.
- Do not create additional implementation files unless explicitly listed.
- Do not refactor unrelated code.
- Do not upgrade dependencies unless explicitly instructed.
- Do not edit frontend, Prisma, migrations, workers, routes, or documentation unless they are listed.
- `ACTIVE_PHASE.json` is the only global metadata exception, and only the exact successful-completion transition defined by `EXECUTION_PROTOCOL.md` is allowed.
- Governance transition exception: on a separately authorized clean governance branch, an explicit human instruction that names the successor phase ID, pack version, baseline, rollout order and human-gate boundaries may update only `AGENTS.md`, `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, `CODEX_ENTRYPOINT.md`, `EXECUTION_PROTOCOL.md`, and the new phase-pack directory. The transition must begin at `awaiting_human_approval` unless execution is separately authorized. It does not authorize implementation, migration, database access, network access, deployment, secret access, or phase execution.
- Never modify `PHASE_QUEUE.json` during phase execution.

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

### Production live E2E acceptance exception

The only read-only production acceptance exception is the exact identity `PROD-LIVE-E2E-ACCEPTANCE-A` / `PROD-LIVE-E2E-ACCEPTANCE-A-v1`, with `human_approved=true`, `allows_network=true`, and `allows_migration=false`. It permits only Railway status and sanitized logs, public GETs, authenticated internal status GETs without printing secrets, read-only TxLINE level-12 validation, public-Web browser automation, waiting for a real fixture, and public-safe evidence written to the allowlisted repository file. It is not reusable by another phase.

### Matches production rollout exception

The exact identity `MATCHES-PRODUCTION-ROLLOUT-A` / `MATCHES-PRODUCTION-ROLLOUT-A-v1`, baseline `03f308be14a330d269c484efc853e307ffb9c7ce`, is the only exception that may orchestrate the approved Matches staging and production rollout. Installing or publishing its governance pack authorizes no external action. The phase must begin `awaiting_human_approval` with `human_approved=false`.

Every scope-discovery, staging preflight, staging migration, staging deployment, staging backfill, staging acceptance, production preflight, production migration, production deployment, production backfill, and production acceptance gate requires its own explicit human instruction. A gate authorizes only its named operation and environment. Exact Railway project, environment, service and public-origin identifiers must be verified and recorded before any environment action. Secrets may be consumed only from existing secure environment or platform storage and must never be printed, copied into Git, or returned to the user.

The only permitted migration is the already committed additive `20260718210000_fixture_competition_id`; migration preflight must prove it is the sole expected pending migration before one non-retried apply attempt. Rollback must be forward-only and must never drop `competition_id` or delete source/raw data. Deployment order is API, ingestion worker, agent worker, evaluation worker, then Web, one service at a time. Backfill is the evidence-only, resumable competition-ID reconciliation; unknown values remain null. Learning remains `shadow_only`, and watchlist and Telegram remain disabled. Production acceptance is read-only and cannot be declared without deployed-SHA, migration-version, component-heartbeat, today/tomorrow coverage and E2E evidence.

### Matches Railway topology governance exception

The exact identity `MATCHES-RAILWAY-TOPOLOGY-A` / `MATCHES-RAILWAY-TOPOLOGY-A-v1`, baseline `accbd80d6e5a796a19aebea4bfaab1a2b50703c3`, is the only exception that may establish the missing Railway topology required by the Matches rollout. Installing or publishing its governance pack authorizes no external action. The phase must begin `awaiting_human_approval` with `human_approved=false`.

Every topology preflight, staging-environment create, staging-services create, production-workers create, staging-domains configure, production-domains configure and topology acceptance gate requires its own explicit human instruction. The scope is additive only: preserve production `mathpluse-api` and `matchpulse-web`; never delete, rename or reuse the ambiguous existing services. Railway variables, migrations, database access, deployments and domain changes remain forbidden unless their exact separately approved gate authorizes only that operation. Secrets may be consumed only from existing secure environment or platform storage and must never be printed, copied into Git, or returned to the user.

### Matches Railway topology retry exception

The exact identity `MATCHES-RAILWAY-TOPOLOGY-RETRY-A` / `MATCHES-RAILWAY-TOPOLOGY-RETRY-A-v1`, baseline `25156b8d22d1488f27da6bafeee9b6d88ece6773`, may diagnose the failed staging-environment create attempt and, only after a separate gate, make one new create attempt for `staging`. It starts `awaiting_human_approval`; governance publication authorizes no Railway action. Variables, domains, services, databases, deployments, migrations and source connections remain forbidden.

### Free Access security governance exception

The exact future identity `FREE-ACCESS-SECURITY-A` / `FREE-ACCESS-SECURITY-A-v4` is a source-governance exception only. During its explicitly approved implementation it permits only the exact manifest allowlist, source-level Prisma schema edits, SQL migration source creation, Prisma format/validate/generate without a database connection, offline-only lockfile resolution, and local tests. It does not permit applying migrations, database connection or writes, registry or application network access, production/Railway access, deployment, secret access, blockchain transactions or wallet-asset authorization, payment/billing/paywall behavior, private keys or seed phrases, or public leakage.

This exception forbids all writes and deployments: production POST/PUT/PATCH/DELETE, manual ingestion, database or fixture writes, Railway configuration changes, restart/redeploy, replica/domain changes, migration/seed, secret/token/header output, raw provider payloads, mock/demo/fallback/fabricated data, capture-window or Agent-configuration changes. Any write or deployment operation must stop.

## Git and Automation v2

Automation v2 is the only permitted automated Git path.

### Validate

Codex may run:

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Validate
```

Validate may fetch `origin/main` and fast-forward local `main` only through `git merge --ff-only origin/main`. It must refuse local-ahead or diverged history.

### Prepare

After every active-phase validation passes and the exact completion metadata is written, Codex may run:

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Prepare
```

Prepare may stage only explicitly changed allowlisted paths plus `ACTIVE_PHASE.json` and create exactly one phase completion commit. This permission is part of an already human-approved active phase. Prepare must not push.

### Publish

Codex must not publish merely because Prepare succeeded. Publish requires a separate explicit human instruction after review:

```powershell
.\scripts\codex-automation-v2.ps1 -Mode Publish
```

Publish must fetch again, require exactly one prepared commit directly above `origin/main`, verify its filenames, and push `HEAD:main` without force.

Do not merge pull requests, deploy, apply migrations, or activate another phase unless separately and explicitly instructed.

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
- `NON_FAST_FORWARD`
- `UNRELATED_WORK_CHANGED`
- `STAGING_SCOPE_VIOLATION`
- `PHASE_COMPLETE_PREPARED`

Do not improvise around a blocker.

## Completion report

At the end of the active phase report:

1. baseline commit
2. phase ID and pack version
3. exact files committed
4. behavior implemented
5. actual commands and results
6. any compile-only discretionary corrections
7. remaining limitations
8. confirmation that no unauthorized implementation file changed
9. confirmation that unrelated local work remains unchanged and unstaged
10. confirmation that no migration was applied unless explicitly approved
11. confirmation that `PHASE_QUEUE.json` was not changed
12. confirmation that no next phase was activated
13. final status: `PHASE_COMPLETE_PREPARED`

Then stop. Publish only after a separate explicit human instruction.
