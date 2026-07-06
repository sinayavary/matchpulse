# MatchPulse Worker Runbook

## Purpose

The worker provides a controlled ingestion entrypoint for one fixture at a time.
It is the safe bridge between TxLINE-backed ingestion logic, persisted Neon data, the public API, and the frontend.

This phase adds guarded execute controls around the controlled CLI worker foundation.
It is not a scheduler, cron service, queue worker, or always-on background process.

For deployment posture and scheduling guidance, see [`docs/deployment-scheduling-strategy.md`](docs/deployment-scheduling-strategy.md).

## Dry-Run Command

Run from `D:\money\matchpulse_repo`:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --dry-run
```

Expected behavior:
- prints a safe worker plan
- shows `mode: "dry-run"` in a structured JSON envelope
- includes a safe `run_id`
- shows `db_write_enabled: false`
- shows `txline_call_enabled: false`
- shows `scheduler_enabled: false`
- does not call TxLINE
- does not run ingestion
- does not write the database

## Rejected Execute Command

This command must fail safely because confirmation is missing:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --execute
```

Expected behavior:
- returns a non-zero exit code
- prints a safe configuration error
- says execute mode requires `--confirm-db-write`
- does not call ingestion
- does not write the database

## Confirmed Execute Command

Do not run this during verification.
Only use it intentionally after a dry-run looks correct:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --execute --confirm-db-write
```

Confirmed execute mode is explicit opt-in only.
It reuses the existing API ingestion runner and performs one controlled ingestion pass for the requested fixture.
It may call TxLINE and may write refreshed data to the database.

## Required Inputs

- `--fixtureId` is required
- `--competitionId` is required
- `--startEpochDay` is required
- `--asOf` is optional
- `--oddsLimit` is optional and defaults to `20`
- `--includeFixture` defaults to `true`
- `--includeScore` defaults to `true`
- `--includeOdds` defaults to `true`
- `--runId` is optional and will be sanitized for safe logging
- `--dry-run` is the safe default mode
- `--execute` is required to run ingestion
- `--confirm-db-write` is required with `--execute`

## Safety Boundaries

- The worker remains one-shot and one-fixture only.
- The worker does not start automatically forever by default.
- The worker does not start cron, intervals, or loops.
- The worker does not add Redis, BullMQ, Upstash, or queue infrastructure.
- Dry-run prints only safe request fields and no secret-like config values.
- Worker output is checked against secret-like key patterns before it is printed.
- Tests use injection and do not call TxLINE, do not run live ingestion, and do not write the database.
- The schedule foundation is disabled by default and single-cycle only in this phase.
- Schedule output is checked against the same secret-like key patterns before it is printed.
- Scheduled execute requires explicit confirmation, and cron, loop, Redis, and queue modes are rejected in this phase.

## What Not To Run

- Do not run execute mode during automated verification.
- Do not run confirmed execute unless you intentionally want persisted data refreshed.
- Do not use this worker as a scheduler in this phase.
- Do not use it to trigger migrations, seeds, wallet actions, or TxLINE activation.

## Public API Relationship

The worker is an internal ingestion entrypoint only.
It does not change `/api/public/*`, `/api/matches`, or `/api/demo/*`.
Its role is to refresh persisted backend data that the existing public-safe API can later serve.

## Future Scheduler Phase Notes

The next scheduler-oriented phase can build on this worker foundation by adding an explicit orchestration layer for controlled schedules, retries, and operational visibility.
That future phase should still preserve safe dry-run behavior and explicit execution controls.

## Schedule Dry-Run Foundation

This phase adds a disabled-by-default schedule orchestration layer on top of the controlled worker.
It supports safe dry-run plus an explicit confirmed single-cycle execute mode. It is **not** a real scheduler.

Run from `D:\money\matchpulse_repo`:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --dry-run
```

Expected behavior:
- prints a safe schedule plan envelope
- shows `mode: "schedule-dry-run"`
- shows `cycle_count: 1`
- lists the known demo jobs (`17952170` primary, optionally `17588223`)
- shows `db_write_enabled: false`
- shows `txline_call_enabled: false`
- shows `scheduler_enabled: false`
- shows `redis_enabled: false`
- shows `queue_enabled: false`
- does not call TxLINE
- does not call the ingestion runner
- does not write the database
- does not start any loop, interval, or cron

Optional flags:
- `--runId <value>` overrides the sanitized run id

### Static Schedule Plan

The schedule plan is static and built only from known-safe demo fixtures.
No live data is fetched and no database is read while building the plan.
Each scheduled job contains only safe non-secret fields:

- `fixtureId`
- `competitionId`
- `startEpochDay`
- `includeFixture`
- `includeScore`
- `includeOdds`
- `oddsLimit`

### Rejected Schedule Execute

Scheduled execute without confirmation must fail safely:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --execute
```

Expected behavior:
- returns a non-zero exit code
- prints `Schedule error: scheduled execute mode requires --confirm-db-write.`
- does not call TxLINE
- does not write the database
- does not print any secrets

### Confirmed Single-Cycle Schedule Execute

Do not run this during verification.
Only use it intentionally when you want to refresh persisted data from the static schedule plan:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --execute --confirm-db-write
```

Expected behavior:
- runs exactly one schedule cycle
- processes the static plan one time only
- reuses the existing worker execution logic for each planned job
- prints `mode: "schedule-execute"`
- prints `cycle_count: 1`
- prints `job_count`
- prints only safe per-job summaries
- may call TxLINE
- may write refreshed data to the database
- does not start any loop, interval, cron, watcher, daemon, Redis backend, or queue backend

### Warnings

- **Confirmed schedule execute is dangerous and intentional.** Do not run
  `schedule --execute --confirm-db-write` unless you explicitly want to refresh
  persisted data.
- **No Redis, cron, or always-on loop exists yet.** Do not deploy this as a
  background daemon. No `--loop`, `--interval`, `--cron`, `--watch`, `--daemon`,
  `--redis`, `--queue`, `--bullmq`, or `--upstash` flag is supported.
- **No always-on scheduler exists yet.** There is no cron, interval, daemon,
  Redis, queue, or watch process in this phase. A future phase will cover
  deployment and scheduling strategy.

### Future Phase Notes for Real Scheduler Deployment

A future phase may introduce:
- a real always-on orchestration loop (opt-in only, not default)
- retry, backoff, and operational visibility for scheduled jobs

That future phase must continue to preserve:
- dry-run-first behavior
- secret redaction on all schedule output
- no automatic DB writes without explicit confirmation
- no automatic TxLINE activation

## Manual CI Dry-Run Workflow

Phase 29F adds a manual GitHub Actions workflow at `.github/workflows/worker-schedule-dry-run.yml`.

Use it only for schedule dry-run preview:

- trigger: `workflow_dispatch` only
- runs worker tests
- runs worker typecheck
- runs `pnpm --filter @matchpulse/worker dev -- schedule --dry-run`
- requires no secrets
- does not write the database
- does not call TxLINE
- does not run `schedule --execute`

Local PowerShell usage stays the same:

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --dry-run
```
