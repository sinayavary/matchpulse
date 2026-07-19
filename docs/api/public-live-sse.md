# Durable public live delivery

The source implementation provides `GET /api/public/live` and `GET /api/public/matches/:fixtureId/live` over Server-Sent Events. The browser same-origin proxy is `/api/bff/public/live` and `/api/bff/public/matches/:fixtureId/live`.

Events use `matchpulse-live-v1`. The envelope always serializes the database `BigInt` id as a decimal string. Supported types are `fixture.snapshot`, `fixture.state`, `fixture.event`, `fixture.odds`, `fixture.agent`, and `fixture.prediction`. Heartbeats are SSE comments and are never persisted.

Clients should load the current public snapshot first, then open `EventSource`. On reconnect the `Last-Event-ID` header is authoritative; `cursor` is the query fallback. If the cursor predates retained events, the stream emits `stream.reset` with `snapshot_required: true`.

The outbox stores only public presenter/DTO payloads. It has a 24-hour default retention and bounded cleanup. Source writes should append the outbox row in the same transaction where possible; non-transactional writers use the deterministic dedupe key and bounded reconciliation. The feature is source-prepared and is not a staging or production acceptance signal.

Worker roles remain isolated. Each Worker process enables exactly one of `MATCHPULSE_DATA_WORKER_ENABLED`, `MATCHPULSE_AGENT_WORKER_ENABLED`, or `MATCHPULSE_EVALUATION_WORKER_ENABLED`; API and Web enable none. The ingestion role publishes fixture snapshot/state/event/odds DTOs, the Agent role publishes Agent/prediction DTOs, and the evaluation role does not publish public live events. All flags default to `false`.
