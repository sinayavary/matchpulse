# MatchPulse Practical Risk, Security and Operations

## Security boundaries

- Keep credentials and raw TxLINE payloads backend-only; commit variable names, never values.
- Validate every external input and use exact outbound host allowlists, TLS, bounded timeouts, retries and concurrency.
- Redact authorization data, provider payloads, private model policy, proof blobs and stack traces from logs and public responses.
- Keep public API contracts versioned, rate-limited and covered by forbidden-field tests.
- Keep authentication and operator-only controls separate from ordinary product access.
- Run dependency, secret, container and public-leakage scans appropriate to each changed surface.

## Data integrity and migrations

- Use PostgreSQL 16 in an isolated local or ephemeral environment.
- Create or apply migrations only when the active phase explicitly permits them.
- Never mutate shared or remote databases without separate authorization.
- Require idempotency keys, unique constraints, canonical UTC ordering, transaction boundaries and restart/replay tests.
- Record migration prechecks, generated artifacts, verification and rollback or forward-fix instructions.

## External-service safety

- Real TxLINE, Telegram, model-service and deployment access is disabled by default.
- Missing credentials block only live verification; fixtures, fakes and contract tests remain mandatory.
- Never manufacture live evidence or silently fall back from a failed live integration.
- Solana/on-chain access is deferred and not required for the competition release.

## Reliability and observability

- Provide health and readiness checks, dependency status, structured redacted logs and basic metrics.
- Bound queues, retries, reconnects and shutdown; test stale data, duplicates, gaps and dependency failure.
- Provide backup/restore and migration rollback exercises for the isolated release environment.
- Preserve deterministic replay evidence and immutable source/version references.

## Release controls

- CI must run typecheck, build, unit/contract/integration tests, schema checks and security/public-boundary checks.
- A seeded local end-to-end test must cover ingestion through persistence, prediction, API and web presentation.
- Release documentation must state limitations and identify live checks not run.
- Commits use exact-path staging; force push, history rewriting and unauthorized remote mutation are prohibited.

Stop only for a genuine technical conflict, unsafe data action, indispensable missing specification, security failure or unauthorized remote action.
