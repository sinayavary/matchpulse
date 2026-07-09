# Phase 3F Odds Reliability Runtime Verification

Date: 2026-07-09

## Scope

Verified the internal runtime path only:

`Odds Reliability Foundation -> SignalCore ODDS_RELIABILITY_ASSESSED -> Agent Presenter odds_reliability_hint`

No frontend, public API, Telegram, Prisma schema, or migration changes were made.

## Commands Run

```powershell
git status --short
curl.exe http://localhost:4000/api/internal/db/status
curl.exe "http://localhost:4000/api/internal/signalcore/matches/17952170?includeOddsReliability=true"
curl.exe "http://localhost:4000/api/internal/agent/matches/17952170/brief?includeOddsReliability=true"
curl.exe "http://localhost:4000/api/internal/signalcore/matches/17588223?includeOddsReliability=true"
curl.exe "http://localhost:4000/api/internal/agent/matches/17588223/brief?includeOddsReliability=true"
.\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/agent-presenter-v0.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/server-agent-presenter-route.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/signalcore-v0.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/server-signalcore-route.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/odds-reliability-foundation.test.ts
```

## DB Status

- `configured=true`
- `connected=true`

## Fixture Summaries

### `17952170`

- SignalCore source/mode: `signalcore` / `internal`
- `ODDS_RELIABILITY_ASSESSED`: present
- status: `unavailable`
- counts: `snapshot_count=0`, `market_count=0`, `provider_count=0`
- `latest_timestamp=null`
- `limitation_count=3`
- detail source: `database`

- Agent Presenter source/mode: `agent-presenter` / `internal`
- `odds_reliability_hint`: present
- status: `unavailable`
- label: `odds_data_unavailable`
- counts: `snapshot_count=0`, `market_count=0`, `provider_count=0`
- `latest_timestamp=null`
- `limitation_count=3`
- hint source: `database`

### `17588223`

- SignalCore source/mode: `signalcore` / `internal`
- `ODDS_RELIABILITY_ASSESSED`: present
- status: `limited`
- counts: `snapshot_count=64`, `market_count=31`, `provider_count=1`
- `latest_timestamp=2026-06-12T00:46:20.916Z`
- `limitation_count=2`
- detail source: `database`

- Agent Presenter source/mode: `agent-presenter` / `internal`
- `odds_reliability_hint`: present
- status: `limited`
- label: `odds_data_limited`
- counts: `snapshot_count=64`, `market_count=31`, `provider_count=1`
- `latest_timestamp=2026-06-12T00:46:20.916Z`
- `limitation_count=2`
- hint source: `database`

## Forbidden Field Scan

Checked the four internal responses for these JSON property keys:

`probability`, `prediction`, `confidence`, `winner`, `edge`, `expected_value`, `recommended_bet`, `bet`, `wager`, `stake`, `profit`, `payout`, `wallet`, `deposit`, `formula`, `raw_payload`, `debug_lineage`, `primary_side`, `pressure_score`, `adapter_status`

Result: no forbidden keys found.

## Known Limitations

- Fixture `17952170` currently has no stored local odds snapshots, so the runtime result is expected to remain `unavailable`.
- Fixture `17588223` has local stored odds snapshots, but reliability is still `limited` because coverage/diversity constraints remain in the stored data.
