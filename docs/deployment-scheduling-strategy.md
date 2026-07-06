# MatchPulse Deployment and Scheduling Strategy

## Purpose

This document defines the current safe operating strategy for the MatchPulse worker and schedule foundation.
It is intentionally documentation-first.
It does not introduce a production scheduler, automatic database writes, cron, Redis, queues, or an always-on process.

## 1. Current State

The current worker system supports controlled one-shot execution only:

- Manual one-shot worker dry-run exists.
- Manual one-shot worker execute exists and requires `--confirm-db-write`.
- Schedule dry-run exists.
- Confirmed single-cycle schedule execute exists.
- No automatic scheduler exists yet.
- No Redis, Upstash, BullMQ, or queue exists.
- No cron exists.
- No always-on loop, daemon, watch process, or interval runner exists.

This means the ingestion path is available for intentional operator use, but scheduled production-style automation is not enabled in the current phase.

## 2. Safe Operating Modes

Run commands from `D:\money\matchpulse_repo`.

### One-shot Worker Dry-Run

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --dry-run
```

Use this as the default safe mode.
It prints a safe plan, does not call TxLINE, and does not write the database.

### One-shot Worker Rejected Execute Without Confirmation

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --execute
```

This should fail safely because `--confirm-db-write` is missing.
Use it only to verify the confirmation guard, not as a normal workflow.

### Schedule Dry-Run

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --dry-run
```

This is the safe schedule preview mode.
It prints the static plan for the known jobs, does not call TxLINE, does not write the database, and does not start a loop or cron.

### Schedule Rejected Execute Without Confirmation

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --execute
```

This should fail safely because `--confirm-db-write` is missing.

### Dangerous Confirmed Execute Modes

These commands are intentional and should not be the default operating path:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --execute --confirm-db-write
```

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --execute --confirm-db-write
```

Treat both commands as dangerous operator actions.
They may call TxLINE and may write refreshed data to Neon.
Use them only after a dry-run has been reviewed and only when a data refresh is intentionally required.

## 3. Deployment Options

This section compares safe deployment paths without enabling autonomous live writes yet.

### Option A: Manual Local Execution for Demo

Pros:
- Lowest operational complexity
- Easiest to audit
- Keeps human review in the loop before any write
- Good fit for hackathon demos and controlled refreshes

Risks:
- Manual process can be forgotten
- Data freshness depends on operator availability
- Not suitable for unattended production expectations

Required guard:
- Dry-run first
- Use confirmed execute only when intentionally refreshing data
- Follow public API smoke checks after refresh

Recommended now:
- Yes

### Option B: GitHub Actions Manual `workflow_dispatch` Only

Pros:
- Centralizes execution into a repeatable operator workflow
- Reduces dependence on one local machine
- Can add environment approval before confirmed execute in a later phase

Risks:
- Easy to over-automate if manual-only boundaries are not preserved
- Logs must stay sanitized
- If misconfigured later, could become an unreviewed write path

Required guard:
- Manual trigger only
- Environment approval for any confirmed execute phase
- Keep dry-run and confirmed execute as separate explicit workflow steps

Recommended now:
- Yes for dry-run only in Phase 29F

### Option C: Server Cron Disabled by Default

Pros:
- Familiar operational model
- Simple future path for low-frequency jobs on a controlled host

Risks:
- Cron can silently turn into automatic live writes
- Harder to guarantee review before each write
- Tight schedules could create unnecessary load on Neon and TxLINE

Required guard:
- Disabled by default
- Dry-run-first deployment posture
- Explicit approval before enabling any live write schedule

Recommended now:
- No

### Option D: Render, Railway, or Fly Scheduled Job in a Future Phase

Pros:
- Better fit than local execution for managed operations
- Can support low-frequency scheduled tasks later
- Easier to pair with approval, observability, and controlled environments

Risks:
- Scheduled jobs can become background live writes too early
- Needs careful logging, secrets handling, and frequency control
- Platform defaults may encourage automation before safeguards are mature

Required guard:
- Start with manual trigger or dry-run only
- Add environment gating before confirmed execute
- Keep frequency low until public API freshness proves a real need

Recommended now:
- Future phase only, not now

### Option E: Upstash or Redis Queue as a Future Optional Phase

Pros:
- Could support retries, buffering, and richer orchestration later

Risks:
- Adds significant infrastructure complexity
- Encourages always-on worker patterns before they are needed
- Expands operational and failure surface area

Required guard:
- Defer until there is a proven need for queue-based orchestration

Recommended now:
- No

## 4. Recommended Current Strategy

Recommended operating strategy for the current phase:

- For hackathon and demo use, run manual dry-run commands and verify the public API with smoke checks.
- For controlled database refreshes, use manual confirmed single-cycle execution only when data intentionally needs to be refreshed.
- Use the manual GitHub Actions workflow at `.github/workflows/worker-schedule-dry-run.yml` for operator-triggered schedule preview only.
- Keep GitHub Actions limited to `workflow_dispatch` for this phase.
- Keep the CI workflow secret-free because schedule dry-run does not require database access or TxLINE credentials.
- Reserve any later confirmed execute workflow for a separate phase with environment approval.
- Do not enable automatic scheduled database writes yet.

This keeps the current system operator-controlled, auditable, and aligned with the existing safety guards already built into the worker CLI.

## 5. Neon Free Plan Considerations

Operate cautiously with Neon, especially on a free or lower-capacity plan:

- Keep writes controlled and intentional.
- Avoid tight polling or frequent refresh loops.
- Prefer a small fixture allowlist initially.
- Avoid always-on background loops.
- Avoid high-frequency schedules until there is clear operational need.
- Monitor public API freshness and stale responses before increasing refresh frequency.

If Neon plan limits are discussed later, verify the current provider documentation at that time rather than assuming fixed limits here.

## 6. Safety Boundaries

These boundaries apply to both local operation and any future deployment work:

- No secrets in logs
- No `.env` commits
- No raw TxLINE payloads in logs
- No database URLs printed
- No JWT, token, wallet JSON, private key, or secret key output
- No public access to worker commands
- Public API is for frontend consumption
- Internal routes are not for frontend use

Additional operating rules:

- Do not expose worker execution through public routes.
- Do not turn schedule commands into background services in this phase.
- Do not treat `/api/demo/*` or `/api/matches` as production ingestion control surfaces.

## 7. Future Phase Plan

Planned follow-on phases:

- `29F`: manual `workflow_dispatch` dry-run CI job
- `29G`: manual `workflow_dispatch` confirmed execute with environment approval
- `29H`: low-frequency scheduled dry-run only
- Later: production scheduler or queue only if operational need is proven

## 8. Phase 29F Manual Dry-Run Workflow

Phase 29F adds `.github/workflows/worker-schedule-dry-run.yml`.

Behavior:

- trigger is `workflow_dispatch` only
- no cron schedule is configured
- no push trigger is configured
- no secrets are required
- worker tests and worker typecheck run before the dry-run command
- the workflow runs `pnpm --filter @matchpulse/worker dev -- schedule --dry-run`

Safety posture:

- this workflow is dry-run only
- it does not use `schedule --execute`
- it does not use `--confirm-db-write`
- it does not write the database
- it does not call TxLINE
- it is not a production scheduler

This phase implements only the manual preview workflow.
Any future execute workflow must remain separate and explicitly gated.

## 9. Phase 29G Manual Confirmed Execute Workflow

Phase 29G adds `.github/workflows/worker-schedule-confirmed-execute.yml`.

Behavior:

- trigger is `workflow_dispatch` only
- no cron schedule is configured
- no push trigger is configured
- no `pull_request` trigger is configured
- the job uses GitHub Environment `controlled-ingestion`
- the workflow requires `confirm_db_write: true`
- the workflow requires `confirmation_phrase: CONFIRM_MATCHPULSE_DB_WRITE`
- the workflow requires a non-empty human reason
- the workflow keeps `dry_run_first: true`
- worker tests and worker typecheck run before any execute step
- the workflow runs schedule dry-run before confirmed execute
- the confirmed command is `./apps/worker/node_modules/.bin/tsx apps/worker/src/index.ts schedule --execute --confirm-db-write`

Safety posture:

- this workflow is manual only and is not a scheduler
- this workflow is not cron and does not create any automatic schedule
- this workflow should only be used for intentional DB refresh operations
- this workflow should not be used until the repository owner configures GitHub Environment `controlled-ingestion` with required reviewers
- the separate dry-run workflow at `.github/workflows/worker-schedule-dry-run.yml` should be used first
- no secrets are added by this phase
- any future runtime secrets should be configured as GitHub Actions environment secrets by name only, never documented by value
- workflow logs must remain sanitized and must not print DB URLs, JWTs, API keys, wallet keys, or raw secret payloads

Operational note:

- environment approval is the core safety gate for this phase
- the workflow exists as a controlled operator tool, not as deployment automation
- do not run it casually, and do not treat it as a replacement for a real future scheduler
