# MatchPulse 14-Day Roadmap

## 1. Team Setup

Team size: 2 developers + project/product lead. One public monorepo will be used.

Recommended split:

- Developer 1: Backend/API/Worker/TxLINE/Agent
- Developer 2: Frontend/UI/UX/Dashboard
- Product lead: Scope, QA, docs, demo flow, coordination

---

## 2. Main Rule

Backend and frontend must work in parallel.

Frontend starts from mock data and API contract. Backend starts by exposing mock endpoints before real TxLINE integration.

---

## 3. Day 1 — Project Contract + Monorepo

### Product Lead

- finalize project scope
- finalize MVP features
- approve API contract
- approve mock data spec
- create task board
- create one monorepo structure
- create initial devnet environment plan

### Backend

- create backend project inside monorepo
- create mock API endpoints
- define env variables
- create first health endpoint

### Frontend

- create Next.js project inside monorepo
- create design direction
- create base layout
- load mock JSON locally

### Done When

- frontend can render mock matches
- backend has `/api/health`
- API contract is accepted by both developers

---

## 4. Days 2-3 — Skeleton Build

### Backend

- setup PostgreSQL
- setup Prisma
- implement core database schema
- implement `/api/matches`
- implement `/api/matches/:fixtureId`
- implement `/api/matches/:fixtureId/timeline`
- implement `/api/matches/:fixtureId/signals`

### Frontend

- build Landing Page
- build Matches Page
- build Live Match Room shell
- build Score Card
- build Status Banner
- build Timeline UI

### Done When

- UI works using backend mock endpoints
- loading/error/empty states exist

---

## 5. Days 4-5 — TxLINE Integration

### Backend

- implement TxLINE config, devnet first
- implement guest JWT flow
- implement API token config
- implement fixtures fetcher
- implement score snapshot reader
- implement odds snapshot reader
- store normalized data in DB

### Frontend

- connect to real backend API
- build Raw Data Panel
- build Odds Panel
- build Market Mood Badge
- handle live/stale/no_data statuses

### Done When

- at least one real or configured match appears in the app
- raw data panel shows backend output

---

## 6. Days 6-7 — SignalCore Agent MVP

### Backend

- build Event Detector
- build Odds Movement Detector
- build Signal Generator
- build Scenario Engine
- build Risk Score
- build Confidence Score
- implement `/api/agent/signals`
- implement `/api/matches/:fixtureId/scenarios`

### Frontend

- build Agent Insights Panel
- build Scenario Cards
- build Risk Level Card
- build Momentum Meter
- build Signal Feed

### Done When

- Agent produces at least 4 signal types
- UI clearly displays signals and scenarios

---

## 7. Days 8-9 — Replay Mode

### Backend

- create replay session model
- seed replay data
- implement replay progression
- run SignalCore on replay data
- implement `/api/replay/start`
- implement `/api/replay/:sessionId`

### Frontend

- build Replay Page
- build replay controls
- build replay progress bar
- add Demo Mode badge

### Done When

- demo works without live match
- replay produces timeline + signals + scenarios

---

## 8. Days 10-11 — Learning and Evaluation

### Backend

- implement prediction history
- implement post-match evaluation
- implement agent accuracy summary
- implement learning graph output
- implement `/api/agent/evaluation`
- implement `/api/agent/learning-graph`

### Frontend

- build Prediction History
- build Agent Accuracy Card
- build Post-Match Review
- build Learning Graph View

### Done When

- Agent can evaluate replay predictions
- dashboard shows accuracy and adjustment summary

---

## 9. Day 12 — Telegram Alerts and Watchlist

### Backend

- implement watchlist API
- implement Telegram webhook skeleton
- implement major signal alert
- implement /start and basic subscribe/unsubscribe flow

### Frontend

- build Watchlist button
- build Telegram connect card
- build Alert Preferences simple UI
- show Telegram alert preview in UI

### Done When

- user can watch a match
- backend can trigger at least one alert format

---

## 10. Day 13 — Stabilization

### Everyone

- end-to-end testing
- stale/no_data/error testing
- replay testing
- mobile responsive check
- bug fixing
- copy cleanup
- compliance wording review

### Done When

- app works through the full demo flow
- no direct betting instructions appear anywhere

---

## 11. Day 14 — Submission Preparation

### Backend

- deploy API and worker
- verify public endpoints
- prepare API endpoint list

### Frontend

- deploy frontend
- polish UI
- verify public demo link

### Product Lead

- write README
- write technical documentation
- write API feedback
- prepare demo script
- final QA

### Done When

- SignalCore standalone link works
- MatchPulse app link works
- public repo is ready
- docs are ready

---

## 12. Definition of Done for Every Feature

A feature is done only when:

1. It works with mock data.
2. It works with backend API or replay data.
3. It has loading state.
4. It has error state.
5. It has empty/no_data state.
6. It is visible in the demo flow.
7. It does not violate the no-direct-betting rule.
8. It fits the visible Solana/Web3 + modern sports design direction.

