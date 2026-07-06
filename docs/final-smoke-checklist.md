# MatchPulse Final Smoke Checklist

Run all commands from the repository root:

```powershell
cd D:\money\matchpulse_repo
```

This checklist covers public API smoke checks, demo bridge checks, worker safety checks, and repository hygiene checks.

## API Checks

### 1. API status

```powershell
curl.exe http://localhost:4000/api/public/status
```

Expected:

- `data.service` is `matchpulse-api`
- `data.ok` is `true`
- `data.public_api_version` is `public-v0`
- `meta.source` is `database`
- `meta.mode` is `public`

### 2. Public matches list

```powershell
curl.exe "http://localhost:4000/api/public/matches?range=all&limit=20"
```

Expected:

- response contains `data` array
- `meta.source` is `database`
- `meta.mode` is `public`
- output is the public-safe database-backed match summary list

### 3. Public match detail for 17952170

```powershell
curl.exe "http://localhost:4000/api/public/matches/17952170?includeOdds=true&oddsLimit=20"
```

Expected:

- `data.fixture_id` is `17952170`
- `data.scoreboard.available` is `true`
- `data.scoreboard.home_score` is `1`
- `data.scoreboard.away_score` is `1`
- `meta.source` is `database`
- `meta.mode` is `public`

### 4. Public bundle for 17952170

```powershell
curl.exe "http://localhost:4000/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20"
```

Expected:

- `data.fixture_id` is `17952170`
- `data.readiness.display_ready` is `true`
- `data.state` is present
- `data.brief` is present
- `data.signal_summary` is present
- signals include `DATA_READY`
- signals include `ODDS_MISSING`
- `meta.source` is `database`
- `meta.mode` is `public`

### 5. Legacy `/api/matches` remains mock

```powershell
curl.exe http://localhost:4000/api/matches
```

Expected:

- response is mock-backed
- it is intentionally preserved
- it is not the final frontend-safe API path

### 6. Demo bridge remains demo

```powershell
curl.exe http://localhost:4000/api/demo/matches
```

Expected:

- `meta.source` is `demo-bridge`
- `meta.mode` is `public-demo`
- response contains the two allowlisted demo fixtures

## Worker Checks

### 7. Worker schedule dry-run local command

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts schedule --dry-run
```

Expected:

- safe schedule plan output
- `mode: "schedule-dry-run"`
- `cycle_count: 1`
- no TxLINE call
- no database write
- no loop, cron, queue, or Redis usage

### 8. Worker rejected execute command

```powershell
.\apps\worker\node_modules\.bin\tsx.CMD apps/worker/src/index.ts --fixtureId 17952170 --competitionId 430 --startEpochDay 20608 --execute
```

Expected:

- fails safely
- requires `--confirm-db-write`
- does not call ingestion
- does not write the database

### 9. Worker tests

```powershell
pnpm.cmd --filter @matchpulse/worker test
```

Expected:

- worker tests pass

### 10. Worker typecheck

```powershell
pnpm.cmd --filter @matchpulse/worker typecheck
```

Expected:

- worker typecheck passes

### 11. Web typecheck

```powershell
pnpm.cmd --filter @matchpulse/web typecheck
```

Expected:

- web typecheck passes

### 12. Web build

```powershell
pnpm.cmd --filter @matchpulse/web build
```

Expected:

- web build succeeds

## Repository Hygiene

### 13. Git status

```powershell
git status --short
```

Expected:

- only intended docs changes appear before commit

### 14. Git log

```powershell
git log --oneline -5
```

Expected:

- recent history is visible for review

## Intentionally Not Run

- Confirmed execute command
- Any live execute command
- Any command that writes the database
- Any TxLINE activation command
- Any automatic DB-writing scheduler command

## Safety Notes

- Public frontend uses `/api/public/*`.
- `/api/matches` is mock and intentionally preserved.
- `/api/demo/*` is demo bridge only.
- `/api/internal/*` must not be used by the frontend.
- Worker dry-run is safe.
- Scheduled dry-run is safe.
- Confirmed execute exists but must not be run casually.
- No automatic DB-writing scheduler is enabled.
- No Redis or queue is currently used.
- Neon free-plan usage should stay low-frequency and controlled.
- No secrets should be printed or committed.
