# Backend Developer Brief

## 1. Responsibility

Backend owns:

- TxLINE integration, devnet first
- database
- API contract
- SignalCore Agent
- replay mode
- health/status handling
- Telegram alert MVP

---

## 2. First Priority

Do not start with complex streams.

Start with:

0. monorepo backend setup
1. mock endpoints
2. DB schema
3. fixtures fetcher
4. scores snapshot reader
5. odds snapshot reader
6. SignalCore MVP
7. replay mode

Add SSE streams and advanced reconnect after MVP is stable.

---

## 3. Required Endpoints First

- `GET /api/health`
- `GET /api/matches`
- `GET /api/matches/:fixtureId`
- `GET /api/matches/:fixtureId/raw`
- `GET /api/matches/:fixtureId/timeline`
- `GET /api/matches/:fixtureId/odds`
- `GET /api/matches/:fixtureId/signals`
- `GET /api/matches/:fixtureId/scenarios`
- `GET /api/agent/health`
- `GET /api/agent/signals`
- `POST /api/replay/start`
- `GET /api/replay/:sessionId`

---

## 4. Response Rule

Every endpoint must return:

```json
{
  "data": {},
  "meta": {
    "status": "live",
    "last_updated": "2026-07-03T12:34:56Z",
    "seconds_since_update": 12,
    "source": "txline",
    "mode": "live"
  }
}
```

---

## 5. Core Modules

```text
src/
  api/
  db/
  txline/
  agent/
  replay/
  telegram/
  health/
  utils/
```

---

## 6. Agent MVP

Agent must generate:

- `GOAL_MARKET_CONFIRMATION`
- `SHARP_ODDS_MOVE`
- `MARKET_OVERREACTION`
- `MOMENTUM_SHIFT`
- `RISK_SPIKE`

Agent must output:

- signal
- scenarios
- confidence
- risk_level
- explanation
- technical_reasoning

---

## 7. Do Not Build First

Do not build these before MVP:

- advanced Redis cache
- full WebSocket infrastructure
- full admin panel
- full proof validation viewer
- complex authentication
- paid features



## 8. Devnet First Rule

Development must start with devnet configuration. Mainnet should only be used after the devnet activation flow, API token flow, and data ingestion are stable.

Do not mix devnet and mainnet values in the same environment.

## 9. Telegram Requirement

Telegram bot/alerts are part of MVP. Implement at least:

- webhook endpoint
- `/start` flow
- subscribe/unsubscribe to match alerts
- major signal alert format
- odds shift alert format

## 10. Leaderboard Exclusion

Leaderboard is not required for MVP. Do not implement leaderboard tables or endpoints unless core Agent/App/Telegram features are complete.
