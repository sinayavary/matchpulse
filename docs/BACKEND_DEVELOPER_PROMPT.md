# Backend Developer / AI Agent Prompt

Use this prompt for the backend developer or for an AI coding agent working on the backend/worker side of the project.

---

## Role

You are the backend engineer for a hackathon project with two separate submissions:

1. **Track 1:** `SignalCore Agent` — a standalone autonomous sports market intelligence agent.
2. **Track 2:** `MatchPulse App` — a user-facing sports intelligence app powered by SignalCore.

The final product name may change later. Use `SignalCore` and `MatchPulse` as working names only.

---

## Project Context

We are building a real-time World Cup sports intelligence product powered by TxLINE / TxODDS data.

The product combines:

- live sports data
- live odds / market movement data
- scenario probabilities
- risk and confidence scoring
- post-match evaluation
- a learning graph
- Telegram alerts
- a clear Solana/Web3 identity

The product must **not** execute betting, enable wagering, include bet buttons, link to betting sites, or promise profit. It is an informational sports intelligence and market insight tool.

---

## Required Files to Read First

Before writing code, read these files in the repo:

```text
PROJECT_SCOPE.md
API_CONTRACT.md
DATA_MODEL.md
AGENT_LOGIC.md
MOCK_DATA_SPEC.md
ROADMAP.md
TASK_BOARD.md
TXLINE_ACCESS_CHECKLIST.md
COMPLIANCE_GUIDELINES.md
BACKEND_BRIEF.md
UPDATED_DECISIONS.md
```

Do not start coding until you understand the API contract, data model, compliance constraints, and devnet-first approach.

---

## Non-Negotiable Decisions

- Use a **single monorepo**.
- Start with **devnet first**.
- Keep code configurable for mainnet later.
- Telegram bot / alerts are part of MVP.
- Leaderboard is **not** part of MVP.
- No direct betting, no wagering, no betting execution.
- Normal users do **not** need wallet connection.
- Wallet/keypair is only for TxLINE activation and backend access.
- Frontend must never call TxLINE directly.
- Backend/worker owns all TxLINE access.
- Every API response must include `{ data, meta }`.

---

## Recommended Stack

Use this unless the team explicitly changes it:

```text
Language: TypeScript
Runtime: Node.js
API: Fastify or NestJS
Worker: Node.js TypeScript process
Database: PostgreSQL
ORM: Prisma
Deployment: Railway for API/worker/database
Frontend: Next.js in same monorepo, deployed separately if needed
```

If choosing between Fastify and NestJS:

- Prefer Fastify for speed and smaller scope.
- Prefer NestJS only if the team wants heavier structure.

---

## Monorepo Structure

Create or follow this structure:

```text
matchpulse/
  apps/
    web/
    api/
    worker/

  packages/
    shared/
      src/
        types/
        schemas/
        constants/

  prisma/
    schema.prisma

  docs/

  mock-data/

  README.md
```

Backend owns:

```text
apps/api
apps/worker
packages/shared
prisma
mock-data integration
```

---

## Environment Strategy

Create `.env.example` files for API and worker.

Required variables:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=

TXLINE_NETWORK=devnet
TXLINE_SERVICE_LEVEL_ID=1
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_BASE_URL=https://txline-dev.txodds.com/api
TXLINE_GUEST_AUTH_URL=https://txline-dev.txodds.com/auth/guest/start
TXLINE_RPC_URL=https://api.devnet.solana.com
TXLINE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
TXLINE_TXL_TOKEN_MINT=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG
TXLINE_WALLET_SECRET_KEY=
TXLINE_API_TOKEN=
TXLINE_GUEST_JWT=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_APP_URL=
```

Rules:

- Never commit real secret keys.
- Never mix devnet and mainnet config.
- Make network switching centralized.
- Add clear comments in `.env.example`.

---

## Mainnet / Devnet Rule

Development starts on devnet:

```env
TXLINE_NETWORK=devnet
TXLINE_SERVICE_LEVEL_ID=1
```

Final submission can move to mainnet:

```env
TXLINE_NETWORK=mainnet
TXLINE_SERVICE_LEVEL_ID=12
```

Do not hardcode network values directly in business logic. Use a config module.

---

## Required API Response Format

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

Allowed `meta.status` values:

```text
live
reconnecting
degraded
stale
no_data
replay
error
```

Allowed `meta.mode` values:

```text
mock
live
replay
fallback
```

---

## Backend Endpoints — P0

Implement these first using mock data, then connect them to database, then TxLINE:

```text
GET /api/health

GET /api/matches
GET /api/matches/live
GET /api/matches/:fixtureId
GET /api/matches/:fixtureId/raw
GET /api/matches/:fixtureId/timeline
GET /api/matches/:fixtureId/odds
GET /api/matches/:fixtureId/signals
GET /api/matches/:fixtureId/scenarios
GET /api/matches/:fixtureId/recap

GET /api/agent/health
GET /api/agent/signals
GET /api/agent/evaluation
GET /api/agent/learning-graph

POST /api/replay/start
GET /api/replay/:sessionId
POST /api/replay/:sessionId/stop

POST /api/watchlist
GET /api/watchlist
DELETE /api/watchlist/:fixtureId

POST /api/telegram/webhook
```

Do not build leaderboard endpoints in MVP.

---

## Database Tables — MVP

Implement these first:

```text
fixtures
match_states
match_events
odds_snapshots
signals
scenarios
prediction_history
agent_evaluations
learning_edges
replay_sessions
watchlist_items
health_status
telegram_users
alert_subscriptions
```

Do not implement these unless P0 is done:

```text
leaderboard_entries
rooms
validation_proofs
advanced_api_logs
billing_or_payments
```

---

## SignalCore Agent — MVP Behavior

The Agent must consume match state and odds state, then produce signals.

Required signal types:

```text
GOAL_MARKET_CONFIRMATION
SHARP_ODDS_MOVE
MARKET_OVERREACTION
MOMENTUM_SHIFT
RISK_SPIKE
RED_CARD_IMPACT
PENALTY_IMPACT
PHASE_CHANGE
FULL_TIME_EVALUATION
```

Each signal must include:

```json
{
  "id": "sig_001",
  "fixture_id": "18175918",
  "type": "GOAL_MARKET_CONFIRMATION",
  "minute": 63,
  "team": "Argentina",
  "impact_level": "high",
  "confidence": 0.78,
  "risk_level": "medium",
  "explanation": "Goal and market movement are aligned.",
  "technical_reasoning": "Goal event was followed by a 28.6% odds drop in favor of Argentina.",
  "created_at": "2026-07-03T12:34:56Z"
}
```

---

## Scenario Engine — MVP Behavior

For each active/replay match, generate 3 to 5 scenario cards.

Example:

```json
[
  {
    "label": "Team A controls the match",
    "probability": 0.62,
    "confidence": "medium_high",
    "reason": "Goal event and odds movement confirm market support."
  },
  {
    "label": "Team B comeback pressure",
    "probability": 0.23,
    "confidence": "medium",
    "reason": "Recent pressure signals exist but market confirmation is weak."
  },
  {
    "label": "Market overreaction",
    "probability": 0.15,
    "confidence": "low_medium",
    "reason": "Odds movement was sharper than matching event impact."
  }
]
```

Important:

- These are scenario probabilities, not betting recommendations.
- Never output “bet on X” or “guaranteed win”.

---

## Learning Graph — MVP Behavior

Build a simple rule-based learning graph, not heavy ML.

Graph relationship:

```text
match_state
→ event
→ market_reaction
→ signal
→ scenario_prediction
→ actual_outcome
→ weight_adjustment
```

Each edge should store:

```text
source_node
target_node
relationship_type
weight
confidence
created_at
```

Post-match evaluation should compare predictions with actual outcome and create weight adjustment logs.

Do not implement complex ML training in MVP. Use deterministic rules and transparent weight updates.

---

## Replay Mode — Required

Replay mode is critical because judges may review when no live match exists.

Implement:

```text
POST /api/replay/start
GET /api/replay/:sessionId
POST /api/replay/:sessionId/stop
```

Replay must simulate:

- match timeline
- score changes
- odds movement
- generated signals
- scenario changes
- post-match evaluation

Replay can start from mock data first, then historical TxLINE data later.

---

## Telegram Bot — Required MVP

Implement basic Telegram alert flows.

Commands:

```text
/start
/matches
/subscribe <fixtureId>
/unsubscribe <fixtureId>
/status
```

Alerts:

```text
Big signal alert
Sharp odds movement alert
Risk spike alert
Scenario changed alert
Full-time evaluation alert
```

Telegram message rules:

- Informational only.
- No betting instruction.
- Include risk/confidence when relevant.
- Include link back to app if available.

Example alert:

```text
⚡ SignalCore Alert
Match: Argentina vs Cape Verde
Signal: Goal + Market Confirmation
Scenario: Argentina control increased to 78%
Risk Level: Medium
This is an informational market insight, not betting advice.
```

---

## Implementation Order

Follow this exact order:

1. Monorepo setup.
2. Shared types package.
3. API app setup.
4. Mock endpoints using `mock-data`.
5. Prisma schema and database connection.
6. Persist mock data into DB.
7. TxLINE config module.
8. Devnet guest auth / activation checklist support.
9. Fixtures fetcher.
10. Scores snapshot reader.
11. Odds snapshot reader.
12. Match state builder.
13. Signal detector.
14. Scenario engine.
15. Risk/confidence engine.
16. Signal APIs.
17. Replay mode.
18. Learning graph and evaluation.
19. Telegram bot.
20. Deployment config.
21. Health/status hardening.

---

## Quality Rules

- Use TypeScript strictly.
- Validate API responses before saving if possible.
- Use idempotent writes where possible.
- Use `fixture_id + seq/timestamp` uniqueness where appropriate.
- One bad TxLINE message must not crash the worker.
- Backend should return stale data with status instead of crashing.
- Every route must handle error state.
- Every route must return `{ data, meta }`.
- Do not expose TxLINE credentials to frontend.
- Do not put secrets in logs.

---

## Acceptance Criteria

Backend MVP is done when:

- Mock endpoints work.
- Database schema is migrated.
- Fixtures, odds, scores can be read from mock or TxLINE/devnet.
- Agent produces signals.
- Scenario endpoint returns useful probabilities.
- Replay works without live data.
- Evaluation endpoint returns accuracy and learning graph basics.
- Telegram bot sends at least one alert type.
- All APIs follow `{ data, meta }`.
- Frontend can consume all endpoints without knowing TxLINE internals.

---

## What Not To Do

Do not build:

- betting execution
- bet placement
- wallet connect for normal users
- payment system
- leaderboard
- live chat
- full WebSocket infrastructure
- complex auth
- advanced proof viewer before MVP
- heavy machine learning before deterministic logic works

---

## First Response Expected From Developer / AI Agent

When you start, first output:

1. The repo structure you will create.
2. The exact backend stack selected.
3. The first 10 tasks you will implement.
4. Any missing environment variables or access requirements.
5. A risk list if any requirement is blocked.

Then begin implementation.
