# MatchPulse / SignalCore Monorepo

Working-name repository for the TxLINE / TxODDS World Cup Hackathon project.

This repo contains two related submissions:

1. **SignalCore Agent** — autonomous sports market intelligence agent for Track 1.
2. **MatchPulse Intelligence App** — user-facing sports intelligence product for Track 2.

The final product name can be changed near the end of the project.

## Current positioning

MatchPulse is a **sports intelligence and market insight tool** powered by TxLINE data and Solana/Web3 infrastructure.
It shows live match data, odds movement, scenario probabilities, risk/confidence levels, replay mode, and Telegram alerts.

It must **not** include direct betting, wagers, bet buttons, bookmaker links, or promises of winning.

## Monorepo structure

```txt
apps/
  web/       Next.js frontend
  api/       Fastify backend API
  worker/    SignalCore background worker
packages/
  shared/    Shared TypeScript types/utilities
  txline-client/ TxLINE client/config wrapper
prisma/      Prisma schema
mock-data/   Mock data for frontend/backend development
docs/        Project documentation, task board, prompts, contracts
```

## Tech stack

- Monorepo: pnpm workspaces + Turborepo
- Frontend: Next.js + TypeScript + Tailwind-ready CSS structure
- Backend API: Fastify + TypeScript
- Worker: Node.js + TypeScript
- Database: PostgreSQL + Prisma
- Deploy target:
  - Frontend: Vercel
  - API + Worker + DB: Railway

## First-time setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run apps separately:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

## Environment strategy

Development starts with TxLINE **devnet first**:

```env
TXLINE_NETWORK=devnet
TXLINE_SERVICE_LEVEL_ID=1
```

Final submission can switch to mainnet service level 12 if access is ready:

```env
TXLINE_NETWORK=mainnet
TXLINE_SERVICE_LEVEL_ID=12
```

Never mix devnet and mainnet TxLINE values.

## Important docs to read first

- `docs/PROJECT_SCOPE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/AGENT_LOGIC.md`
- `docs/TASK_BOARD.md`
- `docs/COMPLIANCE_GUIDELINES.md`
- `docs/BACKEND_DEVELOPER_PROMPT.md`
- `docs/FRONTEND_DEVELOPER_PROMPT.md`

## GitHub import

1. Unzip this package.
2. Create a new empty GitHub repository.
3. From the repo folder:

```bash
git init
git add .
git commit -m "Initial MatchPulse monorepo scaffold"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## MVP rule

Every feature is done only when it:

1. Works with mock data.
2. Works with API/replay data or has a clear integration TODO.
3. Has loading/error/empty states where relevant.
4. Is demoable.
5. Does not violate compliance guidelines.
