# Matches production defect audit

Phase: `MATCHES-PRODUCTION-DEFECT-ERADICATION-A`  
Source baseline: `7d99b1d59f1c5811943553cb4226cf05e62fac7a`  
Audit posture: read-only evidence only; no production acceptance is claimed.

## Production evidence boundary

The repository contains no configured Railway/Vercel deployment connector, production origin, deployment API credential, or production database credential. Environment-name inspection found no deployment or production credential variables. Therefore API/Web/Worker deployed SHAs, deployment timestamps/status, service health, worker heartbeat, discovery health, and the requested UTC date-window counts are **not available** in this run. No production request, provider request, database read, write, migration, seed, or deployment was issued.

The expected source commit for a future verification is `7d99b1d59f1c5811943553cb4226cf05e62fac7a`; after a future implementation completion, each service SHA must be compared with that completion SHA before any UI result is attributed to the source.

## Requested production windows

| Window | Result | Reason |
|---|---|---|
| Today UTC (`2026-07-18`) | not available | no production origin/credential |
| Tomorrow UTC (`2026-07-19`) | not available | no production origin/credential |
| Future horizon (`2026-07-19` through `2026-08-01`) | not available | no production origin/credential |
| Browser-local calendar equivalents | not available | no production Web origin/credential |

The following requested production metrics are all `not available`: TxLINE fixture count, persisted fixture count, public upcoming count, Web-visible count, missing fixture IDs, duplicate fixture IDs, duplicate canonical identities, lifecycle distribution, terminal/interrupted/unknown-in-upcoming counts, discovery attempts/failures/rate-limit responses, and last discovery timestamp.

## Root causes proven from source and local contract tests

1. Public catalog deduplication used equality of `Math.floor(start / 300000)` as the grouping key. A source pair at `14:59` and `15:01` therefore became separate rows even though it was within the stated tolerance.
2. Reconciliation repeated the same bucket-key defect, so a dry-run could report a different duplicate population than the public catalog.
3. Discovery coverage exposed aggregate arrays but not a per-UTC-day status, safe failure code, retry time, or attempt count. A missing tomorrow row could not be distinguished between upstream no-data, rate limiting, failed discovery, and a downstream persistence gap.
4. Web grouping used a full localized date string and did not label Today/Tomorrow. Load More keyed replacement only by `fixture_id`, so equivalent source fixtures with different provider IDs could remain as two cards.

## Local evidence after remediation

The implementation adds interval-based duplicate clustering with a five-minute maximum cluster span, stage/score/lifecycle conflict guards, opaque `catalog_identity`, daily discovery coverage, safe catalog diagnostics, local-calendar grouping, and client-side catalog-identity replacement. Focused tests cover the five-minute boundary, transitive tolerance control, discovery failure/no-data/rate-limit states, UTC/local dates, UTC+14, UTC-12, and DST.

Production counts remain `not available`; no fabricated counts are recorded.
