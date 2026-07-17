# AUTO-DATA-REPLAY-RUNTIME-A

Implement always-on provider-backed ingestion and historical replay without schema or migration changes.

## Scope

- Dedicated env-driven worker with PostgreSQL advisory-lock singleton, discovery, adaptive polling, retry/backoff, restart catch-up, and persisted health.
- Persisted-only public replay endpoint: `GET /api/public/matches/:fixtureId/replay`.
- Automatic public-web refresh for match lists and detail pages, plus replay timeline controls.
- Agent toggle controls analysis generation only; ingestion remains active when the agent is disabled.
- No demo, mock, seed, or fabricated production fallback is introduced.

## Safety

Use existing Prisma models only. Do not edit `prisma/schema.prisma`, migrations, seeds, secrets, or `DATABASE_URL`. Raw provider payloads remain private and are never returned by public routes or logs. TxLINE access remains mainnet-only with service level 12.

## Validation

Run the focused worker/API/web tests, `pnpm typecheck`, `pnpm build`, `git diff --check`, and the Prisma diff check. No migration or seed may be applied.
