# MatchPulse / SignalCore

**Real-time sports data intelligence platform** — ingests live fixture, score, and odds data via TxLINE on Solana, builds canonical match state, and surfaces actionable data-quality signals through a safe public demo.

## What It Is

MatchPulse is a **sports data intelligence** tool, not a betting platform. It answers the question: *"What do we actually know about this match right now, and how reliable is that data?"*

The system ingests structured sports data (fixtures, scores, odds) from the TxLINE oracle on Solana, persists it in Neon PostgreSQL, assembles a canonical match state, then runs it through SignalCore (data-quality analysis) and Agent Presenter (natural-language briefing). A safe public demo bridge exposes a curated subset of this pipeline to the frontend without exposing internals or secrets.

## Open Source Status

MatchPulse is publicly developed as an open-source project. The repository source code and documentation are licensed under the [Apache License 2.0](LICENSE), and contributions are welcome under the guidance in [CONTRIBUTING.md](CONTRIBUTING.md).

The project is still at an early adoption stage, so it does not claim large download numbers or established downstream dependencies. It does provide a working end-to-end implementation, evaluator-ready web flows, deterministic replay paths, automated tests, and structured release controls.

Third-party services and data remain subject to their own licenses and terms. The repository license does not relicense TxLINE, TxODDS, bookmaker, or other external data.

## Architecture

```
TxLINE (Solana Oracle)
    │
    ▼
Backend Ingestion (fixture / score / odds)
    │
    ▼
Neon PostgreSQL (Prisma ORM)
    │
    ▼
Canonical Match State Builder
    │
    ▼
SignalCore v0 — data-quality signal analysis
    │
    ▼
Agent Presenter v0 — natural-language brief
    │
    ▼
Demo Bundle — composite response assembly
    │
    ▼
Safe Public Demo Bridge — allowlisted fixtures, sanitized output
    │
    ▼
Demo UI (/demo) — Next.js frontend
```

## Monorepo Structure

```
apps/
  web/          Next.js 15 + React 19 frontend (port 3000)
  api/          Fastify backend API (port 4000)
packages/
  shared/       Shared TypeScript types and utilities
  txline-client/ TxLINE Solana client wrapper
prisma/         Prisma schema and migrations
mock-data/      Mock data for development
docs/           Documentation, contracts, and task boards
```

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo        |
| Frontend       | Next.js 15, React 19, TypeScript   |
| Backend API    | Fastify, TypeScript                 |
| Database       | PostgreSQL (Neon) via Prisma ORM    |
| Data Source    | TxLINE oracle on Solana (devnet)    |
| Build          | TypeScript strict mode              |

## What the Demo Shows

The demo page at `/demo` showcases the full data pipeline with two curated fixtures that demonstrate different data-availability scenarios:

1. **Slovenia vs Cyprus** (fixture 17952170) — Scoreboard data available, odds data missing. Demonstrates `DATA_READY` and `ODDS_MISSING` signals.

2. **Mexico vs South Korea** (fixture 17588223) — Odds data available, scoreboard data missing. Demonstrates `ODDS_AVAILABLE` and `SCOREBOARD_MISSING` signals.

For each fixture, the UI displays:
- **Match Intelligence Card** — readiness overview and key stats
- **Agent Brief** — natural-language summary of what data is available
- **Signal Feed** — categorized data-quality signals (info/warning/critical)
- **Data Quality Panel** — structured readiness breakdown
- **Raw JSON Toggle** — full API response for transparency

## How to Run Locally

### Prerequisites

- Node.js (v18+)
- pnpm (v9+)
- Access to the TxLINE oracle (devnet) — credentials configured in `.env`
- Neon PostgreSQL database — connection string configured in `.env`

### Start Backend

```powershell
cd D:\money\matchpulse_repo
pnpm.cmd --filter @matchpulse/api dev
```

Backend starts on **http://localhost:4000**.

### Start Frontend (separate terminal)

```powershell
cd D:\money\matchpulse_repo
pnpm.cmd --filter @matchpulse/web dev
```

Frontend starts on **http://localhost:3000**.

### Open the Demo

```
http://localhost:3000/demo
```

## Demo Routes

These are the **only** routes the demo page calls. Final product pages use `/api/public/*`. These demo routes are served by the Safe Public Demo Bridge — no internal routes, no secrets, no database credentials are exposed.

| Method | Route                                      | Description              |
| ------ | ------------------------------------------ | ------------------------ |
| GET    | `/api/health`                              | API health check         |
| GET    | `/api/demo/matches`                        | List demo fixture cards  |
| GET    | `/api/demo/matches/:fixtureId/bundle`      | Full bundle for a fixture |

All responses include `meta.source: "demo-bridge"` and `meta.mode: "public-demo"`.

The existing `/api/matches` endpoint remains mock-backed and independent of the demo pipeline.

## Public API for Final Frontend

Final product pages should use the public-safe API layer documented in [`docs/public-api-contract.md`](docs/public-api-contract.md).

Allowed final frontend routes:

- `GET /api/public/status`
- `GET /api/public/matches`
- `GET /api/public/matches/:fixtureId`
- `GET /api/public/matches/:fixtureId/bundle`

`/api/public/*` is the final frontend-safe API layer. `/api/demo/*` is only for the demo page, `/api/matches` is legacy/mock and not final product data, and `/api/internal/*` must never be called by the frontend.

## Expected Demo Output

### `/api/demo/matches`

Returns two fixture cards:
```json
{
  "data": [
    { "fixture_id": "17952170", "label": "Slovenia vs Cyprus", "demo_case": "scoreboard_available" },
    { "fixture_id": "17588223", "label": "Mexico vs South Korea", "demo_case": "odds_available" }
  ],
  "meta": { "source": "demo-bridge", "mode": "public-demo", "status": "live" }
}
```

### `/api/demo/matches/17952170/bundle`

Returns `display_ready: true`, scoreboard showing `1 – 1`, and signals including `DATA_READY` and `ODDS_MISSING`.

### `/api/demo/matches/17588223/bundle`

Returns `display_ready: true`, odds data present, and signals including `ODDS_AVAILABLE` and `SCOREBOARD_MISSING`.

### `/api/demo/matches/not-real/bundle`

Returns `data: null` with `meta.status: "no_data"` and a safe message — no errors leaked.

## Safety Boundaries

MatchPulse is explicitly **not** any of the following:

- ❌ A betting or wagering platform
- ❌ A prediction or recommendation engine
- ❌ A wallet, payment, deposit, or payout system
- ❌ A probability, confidence, edge, or expected-value calculator
- ❌ A source of betting advice

The system reports **what data exists and its quality** — nothing more. All output passes through `assertNoForbiddenSignalFields` which rejects any content that could be interpreted as betting guidance.

Additional safety measures:
- The public demo bridge uses a **hardcoded allowlist** of two fixtures — no arbitrary fixture IDs are served.
- The demo page calls **only** public demo bridge routes (`/api/demo/*`). Final product pages use `/api/public/*`. Internal routes (`/api/internal/*`) are never exposed to the client.
- Raw JSON output is available for **transparency**, not for automated consumption.
- Signal fields are **sanitized** to `{ type, severity, title, message }` only.

## Current Limitations

- Demo fixtures are hardcoded — no dynamic fixture discovery in the demo.
- Only two demo fixtures are available; the full database may contain more.
- The `/api/matches` endpoint is mock-backed, not connected to the live pipeline.
- No authentication, no user accounts, no persistent watchlists.
- No automated worker/scheduler — data ingestion is manual or script-driven.
- No production deployment configured.

## Next Steps

Future development could include:
- Production deployment (Vercel + Railway)
- Full match browser backed by the database
- Automated ingestion worker/scheduler
- Watchlist persistence and Telegram alerts
- Authentication and user accounts
- Expanded demo fixtures with more data scenarios

## Important Documentation

| Document | Purpose |
| -------- | ------- |
| `CONTRIBUTING.md` | Contribution workflow, safety boundaries, and validation expectations |
| `docs/final-demo-readiness.md` | Final readiness status, demo flow, and judge-facing narrative |
| `docs/final-smoke-checklist.md` | Command-by-command smoke checklist for public API, demo bridge, and worker safety |
| `docs/submission-checklist.md` | Final submission and pitch preparation checklist |
| `docs/demo-script.md` | Step-by-step demo walkthrough for judges/reviewers |
| `docs/public-api-contract.md` | Public-safe API contract for final frontend pages |
| `docs/worker-runbook.md` | Safe worker and schedule command reference |
| `docs/deployment-scheduling-strategy.md` | Controlled deployment and scheduling strategy |
| `docs/project-status.md` | Current build status and what is/isn't built |
| `docs/PROJECT_SCOPE.md` | Full project scope and decisions |
| `docs/API_CONTRACT.md` | Backend API contract specification |
| `docs/DATA_MODEL.md` | Database schema and data model |
| `docs/COMPLIANCE_GUIDELINES.md` | Compliance and safety guidelines |

## Final Demo / Readiness Docs

For the final demo and submission review, start with:

- [`docs/final-demo-readiness.md`](docs/final-demo-readiness.md)
- [`docs/final-smoke-checklist.md`](docs/final-smoke-checklist.md)
- [`docs/submission-checklist.md`](docs/submission-checklist.md)
- [`docs/public-api-contract.md`](docs/public-api-contract.md)
- [`docs/worker-runbook.md`](docs/worker-runbook.md)
- [`docs/deployment-scheduling-strategy.md`](docs/deployment-scheduling-strategy.md)

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a substantial pull request, and preserve the project's public-safety, secret-handling, provider-data, and repository-governance boundaries.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Phase 29G Safety Note

The repository is public. GitHub Environment required reviewers and deployment protection can still depend on the repository plan and settings.

Until the `controlled-ingestion` environment protection is confirmed and verified, use the dry-run workflow only and do not treat environment presence alone as enough approval protection for confirmed execute.
