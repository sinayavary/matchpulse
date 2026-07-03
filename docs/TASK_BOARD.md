# MatchPulse / SignalCore — Team Task Board

> Working names are temporary. Final product names can be changed near the end.  
> Repo strategy: **single monorepo**.  
> Development strategy: **devnet first**, configurable for mainnet later.  
> Product direction: a clear blend of **Solana/Web3 infrastructure + modern sports intelligence UI**.  
> Compliance rule: no direct betting, no bet buttons, no wagering, no promise of profit. The product shows sports data, market insights, scenario probabilities, and risk information.

---

## 0. Team Roles

| Role | Main Responsibility |
|---|---|
| Product / QA Lead | Scope control, acceptance tests, demo flow, compliance wording, docs review |
| Backend Developer | API, database, TxLINE access, SignalCore agent, Telegram bot, deployment |
| Frontend Developer | UI/UX, dashboard pages, live match room, agent dashboard, responsive design |

---

## 1. Kanban Columns

Use these columns in GitHub Projects, Notion, ClickUp, or Trello:

1. **Backlog**
2. **Ready**
3. **In Progress**
4. **Blocked**
5. **Review**
6. **QA / Testing**
7. **Done**

---

## 2. Priority Rules

| Priority | Meaning |
|---|---|
| P0 | Must be completed for submission. Without this, project is incomplete. |
| P1 | Important for a strong demo. Can be simplified if time is short. |
| P2 | Nice to have. Only build after all P0 and P1 items are stable. |

---

## 3. Phase Plan Overview

| Phase | Days | Goal |
|---|---:|---|
| Phase 1 | Day 1-2 | Monorepo, contracts, mock APIs, mock UI |
| Phase 2 | Day 3-5 | TxLINE devnet access, database, real ingestion basics |
| Phase 3 | Day 6-8 | SignalCore agent, scenario engine, risk/confidence, agent dashboard |
| Phase 4 | Day 9-10 | Replay mode, post-match evaluation, learning graph |
| Phase 5 | Day 11-12 | Telegram bot, polish user app, Web3/Solana visual identity |
| Phase 6 | Day 13-14 | QA, deployment, docs, submission readiness |

---

# 4. P0 Tasks — Must Have

## 4.1 Product / Project Setup

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-PROD-001 | Product | Finalize MVP scope | — | MVP includes Agent, App, Telegram, Replay; excludes leaderboard and live chat |
| P0-PROD-002 | Product | Confirm two separate submissions | P0-PROD-001 | Track 1 and Track 2 outputs are documented separately |
| P0-PROD-003 | Product | Freeze API response standard | — | All responses follow `{ data, meta }` format |
| P0-PROD-004 | Product | Freeze compliance wording | — | Product is described as sports intelligence / market insight, not betting advice |
| P0-PROD-005 | Product | Create demo acceptance checklist | P0-PROD-001 | Every critical screen and endpoint has a demo/test requirement |

---

## 4.2 Monorepo Setup

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-REPO-001 | Backend | Initialize monorepo | — | Repo has `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `docs`, `mock-data` |
| P0-REPO-002 | Backend | Add TypeScript config | P0-REPO-001 | Shared TS config works across web/api/worker |
| P0-REPO-003 | Backend | Add environment example files | P0-REPO-001 | `.env.example` exists for web/api/worker |
| P0-REPO-004 | Backend | Add lint/format scripts | P0-REPO-001 | `lint`, `format`, `typecheck` scripts run successfully |
| P0-REPO-005 | Backend + Frontend | Add shared types package | P0-REPO-001 | `packages/shared` exports API types used by frontend and backend |

---

## 4.3 Backend API Foundation

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-BE-001 | Backend | Create API app | P0-REPO-001 | API runs locally and returns `/api/health` |
| P0-BE-002 | Backend | Add global API response wrapper | P0-BE-001 | All API responses include `data` and `meta` |
| P0-BE-003 | Backend | Implement mock matches endpoint | P0-BE-002 | `GET /api/matches` returns mock matches |
| P0-BE-004 | Backend | Implement mock match state endpoint | P0-BE-002 | `GET /api/matches/:fixtureId` returns mock match state |
| P0-BE-005 | Backend | Implement mock raw data endpoint | P0-BE-002 | `GET /api/matches/:fixtureId/raw` returns raw data mock |
| P0-BE-006 | Backend | Implement mock timeline endpoint | P0-BE-002 | `GET /api/matches/:fixtureId/timeline` returns timeline mock |
| P0-BE-007 | Backend | Implement mock odds endpoint | P0-BE-002 | `GET /api/matches/:fixtureId/odds` returns odds mock |
| P0-BE-008 | Backend | Implement mock signals endpoint | P0-BE-002 | `GET /api/matches/:fixtureId/signals` returns signal mock |
| P0-BE-009 | Backend | Implement mock scenarios endpoint | P0-BE-002 | `GET /api/matches/:fixtureId/scenarios` returns scenario mock |
| P0-BE-010 | Backend | Implement mock evaluation endpoint | P0-BE-002 | `GET /api/agent/evaluation` returns evaluation mock |

---

## 4.4 Database Foundation

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-DB-001 | Backend | Setup Postgres connection | P0-BE-001 | API can connect to local/dev database |
| P0-DB-002 | Backend | Add Prisma or ORM schema | P0-DB-001 | Schema includes core tables |
| P0-DB-003 | Backend | Create fixtures table | P0-DB-002 | Fixtures can be inserted and queried |
| P0-DB-004 | Backend | Create match_states table | P0-DB-002 | Latest match state can be stored |
| P0-DB-005 | Backend | Create match_events table | P0-DB-002 | Match events can be stored with unique keys |
| P0-DB-006 | Backend | Create odds_snapshots table | P0-DB-002 | Odds snapshots can be stored |
| P0-DB-007 | Backend | Create signals table | P0-DB-002 | Agent signals can be stored |
| P0-DB-008 | Backend | Create scenarios table | P0-DB-002 | Scenario probabilities can be stored |
| P0-DB-009 | Backend | Create health_status table | P0-DB-002 | Worker status can be tracked |
| P0-DB-010 | Backend | Add seed script | P0-DB-002 | Seed script loads demo data into DB |

---

## 4.5 TxLINE Access / Devnet First

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-TX-001 | Backend | Create dedicated project wallet/keypair | — | A separate dev wallet exists and private key is not committed |
| P0-TX-002 | Backend | Configure Solana devnet | P0-TX-001 | App has `TXLINE_NETWORK=devnet` config |
| P0-TX-003 | Backend | Get devnet SOL if needed | P0-TX-001 | Wallet can sign/send devnet transaction |
| P0-TX-004 | Backend | Implement TxLINE network config | P0-TX-002 | Mainnet/devnet config is switchable |
| P0-TX-005 | Backend | Implement guest auth | P0-TX-004 | Backend can call guest session endpoint |
| P0-TX-006 | Backend | Implement subscription activation flow | P0-TX-005 | API token can be activated or activation error is clearly logged |
| P0-TX-007 | Backend | Store TxLINE credentials safely | P0-TX-006 | JWT/API token are stored in env/secret manager, not code |
| P0-TX-008 | Backend | Fetch fixtures from TxLINE | P0-TX-006 | Fixtures are stored in DB |
| P0-TX-009 | Backend | Fetch scores snapshot | P0-TX-006 | Score snapshot can be stored and returned by API |
| P0-TX-010 | Backend | Fetch odds snapshot | P0-TX-006 | Odds snapshot can be stored and returned by API |

---

## 4.6 SignalCore Agent Foundation

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-AG-001 | Backend | Create worker app | P0-REPO-001 | Worker runs locally as a separate process |
| P0-AG-002 | Backend | Add worker health heartbeat | P0-AG-001, P0-DB-009 | Worker writes heartbeat to `health_status` |
| P0-AG-003 | Backend | Build match state builder | P0-TX-009, P0-TX-010 | Worker builds normalized match state |
| P0-AG-004 | Backend | Build event detector | P0-AG-003 | Detects goal/card/penalty/phase changes from data where available |
| P0-AG-005 | Backend | Build odds movement detector | P0-AG-003 | Detects odds rise/drop and percentage movement |
| P0-AG-006 | Backend | Build signal generator | P0-AG-004, P0-AG-005 | Creates signals from event + odds logic |
| P0-AG-007 | Backend | Build scenario engine v1 | P0-AG-006 | Produces 3 scenario probabilities per match state |
| P0-AG-008 | Backend | Build risk/confidence score v1 | P0-AG-006 | Each signal has risk and confidence |
| P0-AG-009 | Backend | Store signals/scenarios | P0-AG-007, P0-AG-008 | Signals and scenarios are saved in DB |
| P0-AG-010 | Backend | Expose agent API endpoints | P0-AG-009 | Frontend can read signals, scenarios, and agent health |

---

## 4.7 Replay Mode

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-RP-001 | Backend | Define replay data format | P0-BE-006, P0-BE-008 | Replay uses timeline/signals/scenarios mock or historical data |
| P0-RP-002 | Backend | Create replay session endpoint | P0-RP-001 | `POST /api/replay/start` creates a replay session |
| P0-RP-003 | Backend | Create replay state endpoint | P0-RP-002 | `GET /api/replay/:sessionId` returns current replay state |
| P0-RP-004 | Backend | Run Agent on replay data | P0-RP-002, P0-AG-006 | Replay produces live-like agent signals |
| P0-RP-005 | Frontend | Build replay controls UI | P0-RP-003 | User can start/pause/speed replay in UI |

---

## 4.8 Frontend Foundation

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-FE-001 | Frontend | Create Next.js app | P0-REPO-001 | Web app runs locally |
| P0-FE-002 | Frontend | Add Tailwind/shadcn setup | P0-FE-001 | UI system is ready |
| P0-FE-003 | Frontend | Add Web3/Solana visual direction | P0-FE-002 | UI uses Solana/Web3 motifs clearly without requiring user wallet |
| P0-FE-004 | Frontend | Build app layout | P0-FE-002 | Header/sidebar/main layout exists |
| P0-FE-005 | Frontend | Build landing page | P0-FE-004 | Landing explains sports intelligence + TxLINE/Solana angle |
| P0-FE-006 | Frontend | Build matches page | P0-BE-003 | Page lists available matches |
| P0-FE-007 | Frontend | Build live match room | P0-BE-004 | Page shows score, phase, teams, status |
| P0-FE-008 | Frontend | Build raw data panel | P0-BE-005 | UI displays raw data clearly |
| P0-FE-009 | Frontend | Build odds panel | P0-BE-007 | UI displays odds and movements |
| P0-FE-010 | Frontend | Build timeline panel | P0-BE-006 | UI displays events in timeline |
| P0-FE-011 | Frontend | Build agent insights panel | P0-BE-008, P0-BE-009 | UI shows signals and scenarios |
| P0-FE-012 | Frontend | Build risk/confidence cards | P0-AG-008 | UI shows risk and confidence safely |
| P0-FE-013 | Frontend | Build status banners | P0-BE-002 | UI shows live/replay/stale/error states |
| P0-FE-014 | Frontend | Build agent dashboard | P0-AG-010 | Track 1 has standalone technical dashboard |

---

## 4.9 Telegram Bot — Required MVP

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-TG-001 | Backend | Create Telegram bot | — | Bot token is configured securely |
| P0-TG-002 | Backend | Implement webhook endpoint | P0-BE-001, P0-TG-001 | Telegram can call backend webhook |
| P0-TG-003 | Backend | Implement `/start` | P0-TG-002 | User receives intro and commands |
| P0-TG-004 | Backend | Implement `/matches` | P0-BE-003, P0-TG-002 | User can see match list |
| P0-TG-005 | Backend | Implement `/watch <fixtureId>` | P0-TG-002 | User can subscribe to a match |
| P0-TG-006 | Backend | Implement `/unwatch <fixtureId>` | P0-TG-005 | User can unsubscribe |
| P0-TG-007 | Backend | Send big signal alerts | P0-AG-009, P0-TG-005 | Subscribed users receive important signal alerts |
| P0-TG-008 | Backend | Send replay/demo alert | P0-RP-004 | Telegram can demonstrate alert behavior during replay |
| P0-FE-TG-001 | Frontend | Build Telegram connect section | P0-TG-003 | UI explains how to use bot |

---

## 4.10 Compliance / Safety / Positioning

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-COMP-001 | Product | Add app disclaimer | P0-FE-005 | UI says product is informational, not betting advice |
| P0-COMP-002 | Product + Frontend | Remove all betting action language | — | No “bet now”, “guaranteed win”, “sure pick”, or wager language |
| P0-COMP-003 | Product + Backend | Ensure API has no betting action endpoint | — | API never places bets or links to betting services |
| P0-COMP-004 | Product | Review all copy before demo | P0-COMP-001 | All copy uses market insight / scenario / risk wording |

---

## 4.11 Deployment

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P0-DEP-001 | Backend | Deploy API to Railway | P0-BE-001 | Public API URL works |
| P0-DEP-002 | Backend | Deploy worker to Railway | P0-AG-001 | Worker runs and writes heartbeat |
| P0-DEP-003 | Backend | Deploy database | P0-DB-001 | Production DB is connected securely |
| P0-DEP-004 | Frontend | Deploy frontend to Vercel | P0-FE-001 | Public frontend URL works |
| P0-DEP-005 | Backend + Frontend | Configure production env variables | P0-DEP-001, P0-DEP-004 | Web/API/worker connect correctly |
| P0-DEP-006 | Product | Create judge test instructions | P0-DEP-005 | Judges can open app, API, replay, Telegram demo |

---

# 5. P1 Tasks — Strong Demo

## 5.1 Agent Improvements

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P1-AG-001 | Backend | Add adaptive timeout states | P0-AG-002 | Worker tracks live/stale/degraded states |
| P1-AG-002 | Backend | Add reconnect/backoff logic | P0-TX-009 | TxLINE errors are retried safely |
| P1-AG-003 | Backend | Add polling fallback | P1-AG-002 | Worker falls back to snapshot polling |
| P1-AG-004 | Backend | Build learning graph v1 | P0-AG-009 | Graph stores state → signal → scenario → outcome |
| P1-AG-005 | Backend | Build post-match evaluation | P1-AG-004 | Agent produces accuracy report |
| P1-AG-006 | Backend | Add weight adjustment log | P1-AG-005 | Agent explains what rule changed and why |

---

## 5.2 Frontend Improvements

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P1-FE-001 | Frontend | Add scenario cards with probability change | P0-FE-011 | UI shows before/after scenario probability |
| P1-FE-002 | Frontend | Add market reaction card | P0-FE-009 | UI explains odds movement in plain English |
| P1-FE-003 | Frontend | Add momentum meter | P0-FE-011 | UI shows team momentum visually |
| P1-FE-004 | Frontend | Add learning graph view | P1-AG-004 | UI shows agent learning path |
| P1-FE-005 | Frontend | Add post-match review page | P1-AG-005 | UI shows correct/wrong signals and reasons |
| P1-FE-006 | Frontend | Add mobile responsive polish | P0-FE-014 | Main screens work on mobile widths |

---

## 5.3 Web3/Solana Experience

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P1-W3-001 | Frontend | Add Solana-powered data badge | P0-FE-003 | UI clearly says data is anchored/verified by Solana/TxLINE where appropriate |
| P1-W3-002 | Frontend | Add network indicator | P0-FE-003 | UI shows devnet/mainnet mode for demo transparency |
| P1-W3-003 | Frontend | Add TxLINE data source panel | P0-FE-008 | User can see source, timestamp, mode, status |
| P1-W3-004 | Backend | Add validation/proof placeholder | P0-TX-010 | API has placeholder or basic proof metadata if full proof is not implemented |

---

# 6. P2 Tasks — Nice to Have

| ID | Owner | Task | Depends On | Done Criteria |
|---|---|---|---|---|
| P2-FE-001 | Frontend | Add theme toggle | P0-FE-004 | Dark/light mode works |
| P2-FE-002 | Frontend | Add shareable insight cards | P1-FE-002 | User can copy/share a signal summary |
| P2-BE-001 | Backend | Add Redis cache | P0-DB-001 | Latest match states can be cached |
| P2-AG-001 | Backend | Add advanced signal filters | P0-AG-006 | Agent can filter low-value signals |
| P2-TG-001 | Backend | Add Telegram recap command | P0-TG-003 | `/recap` returns latest match summary |
| P2-FE-003 | Frontend | Add watchlist UI | P0-FE-007 | User can save matches locally or via API |

---

# 7. Removed From MVP

These are intentionally excluded from MVP:

- Leaderboard
- Prize system
- Live chat
- Voice commentary / TTS
- Direct betting actions
- Bet placement
- Betting site integrations
- Paid plans
- Complex user authentication
- User wallet connection
- Full on-chain proof viewer
- Advanced admin panel

---

# 8. Daily Execution Plan

## Day 1 — Contract + Repo

| Owner | Tasks |
|---|---|
| Product | P0-PROD-001 to P0-PROD-005 |
| Backend | P0-REPO-001 to P0-REPO-005 |
| Frontend | Review API contract + prepare UI structure |

## Day 2 — Mock API + UI Skeleton

| Owner | Tasks |
|---|---|
| Backend | P0-BE-001 to P0-BE-010 |
| Frontend | P0-FE-001 to P0-FE-006 |
| Product | Test mock API responses and UI copy |

## Day 3 — Database + Core UI

| Owner | Tasks |
|---|---|
| Backend | P0-DB-001 to P0-DB-010 |
| Frontend | P0-FE-007 to P0-FE-010 |
| Product | Check live match room user flow |

## Day 4 — TxLINE Devnet Access

| Owner | Tasks |
|---|---|
| Backend | P0-TX-001 to P0-TX-007 |
| Frontend | P0-FE-011 to P0-FE-013 |
| Product | Verify devnet/mainnet wording and compliance text |

## Day 5 — Real Data Basics

| Owner | Tasks |
|---|---|
| Backend | P0-TX-008 to P0-TX-010 |
| Frontend | Connect screens to real API where available |
| Product | Test stale/no_data/error states |

## Day 6 — Agent v1

| Owner | Tasks |
|---|---|
| Backend | P0-AG-001 to P0-AG-006 |
| Frontend | P0-FE-014 |
| Product | Review generated signals for clarity and compliance |

## Day 7 — Scenarios + Risk

| Owner | Tasks |
|---|---|
| Backend | P0-AG-007 to P0-AG-010 |
| Frontend | P0-FE-011, P0-FE-012 refinements |
| Product | Check Track 1 standalone dashboard |

## Day 8 — Replay

| Owner | Tasks |
|---|---|
| Backend | P0-RP-001 to P0-RP-004 |
| Frontend | P0-RP-005 |
| Product | Test demo without live match |

## Day 9 — Telegram

| Owner | Tasks |
|---|---|
| Backend | P0-TG-001 to P0-TG-008 |
| Frontend | P0-FE-TG-001 |
| Product | Test Telegram alert demo flow |

## Day 10 — Learning Graph

| Owner | Tasks |
|---|---|
| Backend | P1-AG-004 to P1-AG-006 |
| Frontend | P1-FE-004, P1-FE-005 |
| Product | Review agent learning explanation |

## Day 11 — Web3/Solana Polish

| Owner | Tasks |
|---|---|
| Backend | P1-W3-004 |
| Frontend | P1-W3-001 to P1-W3-003 |
| Product | Ensure Web3 + sports blend is obvious |

## Day 12 — Reliability

| Owner | Tasks |
|---|---|
| Backend | P1-AG-001 to P1-AG-003 |
| Frontend | Error/stale/degraded UI polish |
| Product | End-to-end failure scenario testing |

## Day 13 — Deploy + QA

| Owner | Tasks |
|---|---|
| Backend | P0-DEP-001 to P0-DEP-003 |
| Frontend | P0-DEP-004 |
| Product | QA checklist, compliance review, docs review |

## Day 14 — Submission Ready

| Owner | Tasks |
|---|---|
| Backend | Fix API/worker issues |
| Frontend | Final UI polish |
| Product | Judge instructions, README, demo script outline |

---

# 9. Definition of Done

A task is only done when:

1. It works locally.
2. It has no obvious runtime errors.
3. It handles loading, empty, and error states where relevant.
4. It matches the API contract.
5. It does not violate compliance rules.
6. It can be shown in a demo or supports a demo-critical feature.

---

# 10. Immediate Next Actions

1. Create the monorepo.
2. Copy this task board into GitHub Projects or Notion.
3. Assign all P0 tasks to Backend, Frontend, or Product.
4. Start with mock API and mock UI in parallel.
5. Do not start advanced features until the P0 flow works end-to-end.
