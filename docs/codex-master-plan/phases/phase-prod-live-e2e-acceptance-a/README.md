# Phase PROD-LIVE-E2E-ACCEPTANCE-A

## Production live automatic-ingestion and historical-replay acceptance

This phase is evidence-only production read-only acceptance. It does not authorize runtime code, database, environment variable, Railway configuration, deployment, migration, schema, seed, dependency, or Agent configuration changes.

Acceptance covers real competition 430 fixture discovery, natural capture-window entry, polling of score/odds/events, Web auto-refresh without manual refresh, ingestion while the browser is closed, persistence after the window, historical replay, no future leakage, and absence of mock/fallback/demo/fabricated production data.

Permitted operations are Railway service status, sanitized Railway logs, public API/Web GETs, authenticated internal status GETs using an existing environment secret without printing it, read-only TxLINE mainnet level-12 validation, public-Web Playwright/browser automation, waiting/monitoring for a real fixture, and public-safe evidence written only to `docs/production-live-e2e-acceptance-evidence.md`.

Forbidden operations are manual ingestion; POST/PUT/PATCH/DELETE; direct database writes; inserting fixtures, scores, odds, events, or predictions; Railway configuration changes; restart/redeploy; replica/domain changes; migration/seed; printing JWTs, tokens, headers, or `DATABASE_URL`; raw provider payload logging; mock/demo/fallback/fabricated data; capture-window or fixture-time changes; and Agent configuration changes.

If a real fixture does not enter the capture window, record `WAITING_FOR_REAL_FIXTURE` and do not declare success.

Definition of Done requires real evidence of an active fixture, at least three live cycles, healthy heartbeat, released lock, upstream attempts for score/odds/events, managed no-data, Web change without manual refresh, replay from persisted points, no public leakage, and no fabricated data.

Governance-transition validation is structural only. No runtime test, network request, or production command is authorized during this transition; `migration_applied=false` is required.
