# Target Ingestion Runtime Verification

Date: 2026-07-09

## Commands Run

- `git status --short --branch`
- `.\\node_modules\\.bin\\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit`
- `& ".\\apps\\api\\node_modules\\.bin\\tsx.CMD" "apps/api/src/scripts/ingest-targets.ts"`
- `curl.exe http://localhost:4000/api/internal/db/status`
- `curl.exe http://localhost:4000/api/internal/state/matches/17952170`
- `curl.exe "http://localhost:4000/api/internal/agent/matches/17952170/brief?includePressure=true&pressureWindowSize=10&pressureMaxEvidence=8&pressureMaxPayloadAgeMinutes=10080&format=full"`
- `curl.exe http://localhost:4000/api/internal/db/odds-snapshots/17588223`

## Ingestion Summary

- Status: `ok`
- Fixtures: attempted `true`, status `ok`, count `135`
- Scores: attempted `true`, status `ok`, count `1`
- Odds: attempted `true`, status `ok`, count `64`

## Verification Results

- DB configured/connected: `true`
- Fixture `17952170` exists.
- State route returned `Slovenia vs Cyprus`.
- Scoreboard is available.
- Pressure hint is present when `includePressure=true`.
- Odds snapshot verification for `17588223` returned stored odds.

## Notes

- No secrets were printed.
- No raw TxLINE payloads were captured.
- The local API was already running, so no restart was needed.
