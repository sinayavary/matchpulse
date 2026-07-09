# Phase 4C Public Match Intelligence Card Runtime Verification

- Date: 2026-07-09
- Scope: Runtime verification of `/api/public/matches/:fixtureId/intelligence-card`
- Commands run:
  - `git status --short --branch`
  - `curl.exe http://localhost:4000/api/public/status`
  - `curl.exe "http://localhost:4000/api/public/matches/17588223/intelligence-card"`
  - `curl.exe "http://localhost:4000/api/public/matches/17952170/intelligence-card"`
  - `curl.exe "http://localhost:4000/api/public/matches/17588223/intelligence-card?includeState=true&includeSignals=true&oddsLimit=999&staleAfterMinutes=999999"`
  - `curl.exe "http://localhost:4000/api/public/matches/not-real/intelligence-card"`
  - `.\\node_modules\\.bin\\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit`
  - `.\\apps\\api\\node_modules\\.bin\\tsx.CMD --test apps/api/src/public-api.test.ts`
  - `.\\apps\\api\\node_modules\\.bin\\tsx.CMD --test apps/api/src/agent-presenter-v0.test.ts`
  - `.\\apps\\api\\node_modules\\.bin\\tsx.CMD --test apps/api/src/signalcore-v0.test.ts`

- Public status result: `ok=true`, `public_api_version=public-v0`, `meta.mode=public`
- `17588223` result summary: `200` response; `meta.mode=public`; `meta.source=database`; `data.fixture_id=17588223`; `data.agent_version=presenter-v0`; `brief` and `signal_summary` present; `odds_reliability_hint.status=limited`; `snapshot_count=64`; `market_count=31`; `provider_count=1`
- `17952170` result summary: `200` response; `meta.mode=public`; `meta.source=database`; `data.fixture_id=17952170`; `data.agent_version=presenter-v0`; `brief` and `signal_summary` present; `odds_reliability_hint.status=unavailable`; `snapshot_count=0`; `market_count=0`; `provider_count=0`; `pressure_hint` present
- Query hardening result: `includeState=true`, `includeSignals=true`, `oddsLimit=999`, and `staleAfterMinutes=999999` did not expose `signals`, `state`, or `insight`; response stayed public-safe and the odds cap remained enforced internally
- Unknown fixture safety result: `not-real` returned a safe `404` with no stack trace, no raw payload, and no internal error details
- Forbidden key scan result: no forbidden JSON keys were found in the runtime responses
- Tests/typecheck result: typecheck passed; `public-api.test.ts`, `agent-presenter-v0.test.ts`, and `signalcore-v0.test.ts` all passed
- Real TxLINE call: no
- Known limitations: this was a runtime verification pass only; no frontend inspection, no DB migration work, and no backend code changes were required
- Confirmation no frontend/UI changes: confirmed
- Confirmation no Prisma/Telegram/backend runtime changes: confirmed
