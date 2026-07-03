# MatchPulse Project Scope

## 1. Project Name

**Temporary main product name:** MatchPulse  
**Temporary Track 1 name:** SignalCore Agent  
**Temporary Track 2 name:** MatchPulse Intelligence App  

> Final branding may change near the end of the project. Use these names as working names until then.

---

## 2. Core Idea

MatchPulse is a real-time World Cup intelligence platform powered by TxLINE. It combines raw match data, score events, StablePrice odds, market movement, scenario probabilities, risk levels, and agent-generated explanations in one product.

The project has two separate hackathon submissions:

1. **SignalCore Agent** — an autonomous sports market intelligence agent that ingests TxLINE data, detects signals, generates scenarios, tracks confidence/risk, and evaluates its own past predictions.
2. **MatchPulse Intelligence App** — a user-facing sports intelligence app that uses SignalCore outputs to show raw data, market reactions, scenario cards, prediction history, replay mode, and lightweight fan features.

---

## 3. Important Positioning

This project is **not a betting platform** and does not execute, facilitate, or route wagers.

The product may show:

- live scores
- raw TxLINE data
- odds data
- market movement
- scenario probabilities
- risk indicators
- agent insights
- historical performance of the agent

The product must not show:

- “bet on this” instructions
- guaranteed winning claims
- direct betting buttons
- links to betting operators
- financial advice
- real-money wagering features
- staking or prediction-market execution

Preferred public positioning:

> MatchPulse helps users understand live match conditions, market movement, and possible match scenarios using real-time sports data.

Avoid public positioning:

> MatchPulse helps bettors win.

---

## 4. Product Language

The product UI, demo, README, and submission docs should be in **English**.

Persian may be used only for internal planning if needed.

---

## 4.1 Web3 / Solana Product Direction

The UI must clearly show that this is a sports intelligence product built in a Solana/Web3 environment. This should be visible through:

- Solana-powered data-source badges
- TxLINE / TxODDS attribution
- on-chain anchored data messaging
- wallet/subscription status in the technical dashboard, not required for normal users
- dark sports dashboard style with subtle Solana/Web3 visual language
- clear explanation that users do not need to connect a wallet to use the consumer app

The product should feel like a modern sports analytics app with visible Web3 infrastructure underneath.

---

## 5. Track 1: SignalCore Agent

### Goal

Build a standalone autonomous agent that can be submitted even if the MatchPulse app does not exist.

### Required Output

SignalCore must have:

1. Technical dashboard
2. Public Agent API
3. Raw data view
4. Signal feed
5. Scenario probability output
6. Risk and confidence score
7. Learning graph
8. Post-match evaluation
9. Replay mode
10. Logs and technical documentation

### Agent Responsibilities

- ingest fixtures, scores, events, and odds from TxLINE
- keep a normalized match state
- detect important match events
- detect sharp odds movement
- generate signals
- calculate scenario probabilities
- assign confidence and risk levels
- store prediction history
- evaluate predictions against outcomes
- update rule weights in a controlled way
- support replay mode when no live match is available

---

## 6. Track 2: MatchPulse Intelligence App

### Goal

Build a complete user-facing sports intelligence experience powered by SignalCore.

### Required Output

MatchPulse App must have:

1. Landing page
2. Matches page
3. Live Match Intelligence Room
4. Raw Data Panel
5. Odds Panel
6. Agent Insights Panel
7. Scenario Cards
8. Market Reaction Card
9. Momentum Meter
10. Risk Level Card
11. Prediction History
12. Agent Accuracy summary
13. Replay Mode
14. Watchlist
15. Telegram Alerts, simple version
16. Web3/Solana context layer in UI and docs
17. Lightweight group room only if time allows

Not required for MVP: leaderboard or prize-based competition.

---

## 7. MVP Scope

### Must Have

- TxLINE access configuration
- fixture list
- selected match state
- score snapshot or score stream ingestion
- odds snapshot or odds stream ingestion
- raw data panel
- signal generation
- scenario cards
- confidence/risk scoring
- replay mode
- prediction history
- post-match evaluation
- technical dashboard for SignalCore
- user dashboard for MatchPulse
- public API endpoints
- deployment links
- README and technical docs

### Should Have

- Telegram alerts for major signals
- watchlist
- shareable match insight card
- visible Solana/Web3 data-source layer
- simple group room only if it does not delay the core product

### Not MVP

- live chat
- voice commentary
- complex auth
- paid plans
- wallet requirement for normal users
- direct betting/wagering
- WebSocket-heavy multiplayer
- full on-chain proof viewer
- admin panel
- leaderboard / prize-based competition

---

## 8. Network Decision

Development starts on **devnet** to avoid real costs and to test wallet/signing/activation flow safely.

Initial development target:

- `NETWORK=devnet`
- `SERVICE_LEVEL_ID=1`
- delayed World Cup / International Friendlies free tier where available

Final submission target, after devnet is stable and access is confirmed:

- `NETWORK=mainnet`
- `SERVICE_LEVEL_ID=12`
- free World Cup real-time tier when available

Fallback final submission target:

- `NETWORK=mainnet`
- `SERVICE_LEVEL_ID=1`
- 60-second delayed free tier

Development must keep network configurable:

- `NETWORK=mainnet | devnet`
- `SERVICE_LEVEL_ID=12 | 1`

Important rule: never mix mainnet and devnet credentials, program IDs, API hosts, JWTs, or activation endpoints.

---

## 9. Suggested Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Vercel deployment

### Backend/API

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Railway deployment

### Worker

- Node.js
- TypeScript
- Railway long-running service

### Repository

Use one public monorepo for the whole project.

Recommended structure:

```text
repo/
  apps/
    web/
    api/
    worker/
  packages/
    shared/
    types/
    txline-client/
  prisma/
  docs/
  mock-data/
```

### Optional Later

- Redis for latest fixture state and queues
- WebSocket/SSE from backend to frontend
- proof verification viewer

---

## 10. Success Criteria

The project is successful if:

- SignalCore can run independently and produce useful signals.
- MatchPulse can show raw data and agent insights in a clean UI.
- The demo works even without live matches through replay mode.
- The app clearly shows data status: live, replay, stale, no_data, degraded, or error.
- The system does not crash when TxLINE, DB, or network conditions fail.
- The product avoids direct betting functionality and uses responsible wording.

