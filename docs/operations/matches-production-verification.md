# Matches production verification runbook

Run only with an approved read-only production credential and a configured service origin. First record the API, Web, and Worker deployed commit SHAs, deployment creation time/status, service health, worker heartbeat, and discovery-health response. Reject the run with `DEPLOYMENT_VERSION_MISMATCH` if any deployed SHA differs from the implementation completion SHA.

For today UTC, tomorrow UTC, and the configured fourteen-day horizon, collect only sanitized counts and identifiers needed for reconciliation: TxLINE fixture count, persisted fixture count, public upcoming count, Web-visible count, missing IDs, duplicate IDs/canonical identities, lifecycle distribution, terminal/interrupted/unknown-in-upcoming counts, discovery attempts/failures/rate limits, and last discovery timestamps. Never store tokens or raw provider payloads.

A production acceptance report must also prove the same fixture through discovery, persistence, lifecycle, canonical identity, API range, cursor page, and Web local-day group. Any missing fixture must be assigned one cause: upstream return, unattempted day, upstream error/rate limit, ingestion skip, persistence gap, normalization error, lifecycle exclusion, API filtering, cursor exclusion, representative suppression, or Web grouping.

No apply/reconciliation write is allowed from this runbook. Apply requires a separate approved phase after backup verification, dry-run counts, bounded batches, resumability, and rollback evidence.
