# MATCHES-LIVE-DELIVERY-A-v1

## Identity

This approved source phase implements durable public Server-Sent Events delivery and automatic publication of public intelligence DTOs. Baseline: `669fc8b3ab2140fe8da3fb50b0607f1d7800946f`.

Railway transport diagnosis remains paused and must resume before staging. This phase authorizes no Railway, staging, production, deployment, secret, or external database access.

## Required implementation

- Add the additive PostgreSQL `public_live_events` outbox with migration `20260719130000_public_live_events`.
- Implement deterministic, public-DTO-only event publication for six fixture event types, bounded cleanup, and sanitized failures.
- Implement `/api/public/live` and `/api/public/matches/:fixtureId/live` SSE delivery with cursor replay, filtering, heartbeat, retention reset, connection limits, and disconnect cleanup.
- Add a streaming same-origin BFF path and client helper without buffering.
- Preserve safe worker defaults and document the role matrix.

## Gates and validation

Migration may be applied only to a disposable local PostgreSQL 16 database. Network, deployment, staging, production, Railway, external databases, and secrets remain disabled. Run the manifest validation commands, focused tests, regressions, typechecks, builds, Prisma checks, scans, and exact changed-path validation. Update only `ACTIVE_PHASE.json` for completion metadata; governance files are not source targets.
