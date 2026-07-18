# MatchPulse Project Status

The source tree now contains the production-remediation implementation for the Matches catalog. It is not a production-acceptance claim.

Implemented in source:

- additive nullable `Fixture.competitionId` schema and source-only migration;
- evidence-only, resumable catalog reconciliation and ID-based filtering;
- UTC `from`/`to`, query-bound snapshot cursors, and the public competitions endpoint;
- independent ingestion, intelligence, and evaluation loops with separate leases, heartbeats, checkpoints, retry isolation, and health records;
- shadow-only evaluation learning with no automatic model promotion;
- component-level public readiness and sanitized Presenter failures;
- production CORS/API URL fail-fast behavior and 410 legacy routes;
- local-day and competition filters, refresh/staleness UI, request cancellation, and pagination protection;
- ESLint, PostgreSQL CI validation, production build, forbidden-field checks, mojibake scanning, and Playwright coverage.

Still gated:

- applying the migration outside disposable CI databases;
- staging or production deployment;
- production secrets or provider access;
- Production Accepted status.

Production acceptance requires a deployed SHA, migration version, real component health, verified today/tomorrow coverage, and a read-only E2E run. Watchlist and Telegram remain disabled until their dedicated phase.
