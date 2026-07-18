# Matches full production remediation implementation contract

## Data and API

- Add nullable string `competitionId` mapped to `competition_id` with an index on `Fixture`.
- Create one additive SQL migration containing only the nullable column and index.
- Normalization and fixture ingestion carry both provider competition ID and display name.
- Reconciliation may fill only evidence-backed IDs and must remain dry-run by default, resumable, idempotent, and batch-isolated.
- `/api/public/matches` filters `competitionId` by the ID column and accepts validated UTC `from`/`to` instants.
  Explicit dates intersect lifecycle range; cursor identity includes every filter.
- `/api/public/competitions` returns sorted unique safe `{competition_id,name}` rows.

## Runtime and health

- Independent ingestion, intelligence, and evaluation loops use distinct lock names, renewable leases, heartbeat,
  checkpoints, bounded batches, safe error summaries, and independent health records.
- Retry only timeout/network/429/5xx, honor Retry-After, use bounded jittered exponential backoff, and do not retry
  ordinary 4xx errors.
- Intelligence selects lifecycle-eligible fixtures, runs Product Agent/Presenter/prediction idempotently.
- Evaluation processes finalized unevaluated predictions and never promotes beyond shadow-only.
- Public status exposes API liveness plus derived `product_ready` and component readiness for database, ingestion,
  intelligence, evaluation, and upstream with safe reason codes and timestamps.
- Presenter returns no_data only for genuine absence; dependency failures return sanitized 503.

## Security and Web

- Legacy match/agent mocks, watchlist, and Telegram webhook return 410 JSON with deprecation metadata where applicable.
- Production CORS requires an explicit allowlist; localhost defaults exist only in development.
- Browser uses `NEXT_PUBLIC_API_BASE_URL`; SSR prefers `MATCHPULSE_API_BASE_URL`; production missing configuration fails fast.
- Matches UX adds browser-local Today/Tomorrow, custom dates, competition selection, refresh, last-success time,
  stale/degraded reasons, request cancellation/generation guards, and correct UTF-8 text.

## Quality and rollout

- Add real ESLint, complete CI, PostgreSQL-backed checks, Prisma validate/diff, full tests/typecheck/build,
  Playwright critical Matches flows, forbidden-field/mojibake scans, and diff checks.
- Document additive migration -> API -> workers -> Web rollout and read-only deployed-SHA acceptance.
- The migration is source-only in this phase and production acceptance stays false.
