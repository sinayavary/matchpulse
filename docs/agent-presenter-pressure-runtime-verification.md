# Agent Presenter Pressure Runtime Verification

Phase 1K backend runtime check for the internal agent presenter route.

## Fixture

- `fixtureId`: `17952170`

## Commands Run

- `.\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit`
- `.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/server-agent-presenter-route.test.ts`
- `.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/agent-presenter-v0.test.ts`
- `.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/server-signalcore-route.test.ts`
- `curl.exe -sS -D - "http://localhost:4000/api/internal/agent/matches/17952170/brief?includePressure=false"`
- `curl.exe -sS -D - "http://localhost:4000/api/internal/agent/matches/17952170/brief?includePressure=true&pressureWindowSize=10&pressureMaxEvidence=8&pressureMaxPayloadAgeMinutes=10080&format=full"`
- `curl.exe -sS -D - "http://localhost:4000/api/internal/agent/matches/17952170/brief?includePressure=true&pressureWindowSize=abc&pressureMaxEvidence=abc&pressureMaxPayloadAgeMinutes=abc"`

## Runtime Findings

- `includePressure=false`: successful response from `meta.source=agent-presenter` and `meta.mode=internal`.
- `includePressure=false`: `data.pressure_hint` did not exist.
- `includePressure=true`: successful response from `meta.source=agent-presenter` and `meta.mode=internal`.
- `includePressure=true`: `data.pressure_hint` appeared.
- Invalid numeric params: response stayed successful and safe JSON still returned.

## `pressure_hint` Keys Observed

- `label`
- `level`
- `source`
- `evidence_count`
- `limitations`
- `safe_scope_note`

## Forbidden Field Check

- No forbidden internal fields were observed in the live responses.
- The live `pressure_hint` stayed compact and did not include:
  - `pressure_score`
  - `adapter_status`
  - `debug_lineage`
  - `raw_payload`
  - `primary_side`
  - `formula`
  - `probability`
  - `confidence`
  - `prediction`
  - `recommendation`
  - `recommended_bet`
  - `bet`
  - `wager`
  - `stake`
  - `expected_value`
  - `edge`
  - `winner`
  - `profit`
  - `payout`
  - `wallet`
  - `deposit`

## Conclusion

The internal Agent Presenter pressure path is working end-to-end for the verified fixture, stays safely compact, and tolerates invalid numeric pressure params without crashing.
