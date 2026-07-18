# Matches Catalog Remediation Provenance

## Baseline and references

| Item | Value |
| --- | --- |
| official baseline | `75390e501164eff37998e4151b310ca2c81b9d1f` |
| successor | `MATCHES-CATALOG-RELIABILITY-C-v1` |
| local reference | `ada33af` plus its uncommitted remediation worktree |
| rejected published completion | `MATCHES-CATALOG-RELIABILITY-B-v1` / `75390e5` |
| transfer policy | manual review and semantic adaptation; no merge/cherry-pick/rebase/reset |

The B branch is reference-only. The C worktree starts at the official baseline and changes
only allowlisted files. No file from the diverged branch is copied wholesale without review.

## Reviewed delta decisions

| Gap | Reference evidence | Decision on C baseline | Proof required |
| --- | --- | --- | --- |
| runtime discovery and health | `automatic-data-runtime.ts` | adapt the fourteen-day window, coverage ledger, cadence, and discovered fixture handoff | runtime tests and health fields |
| reconciliation | runtime reference and worker CLI | adapt dry-run/apply, bounded cursor, HealthStatus checkpoint, row isolation, and no-delete behavior | reconciliation tests |
| catalog ceiling/pagination | `public-api.ts` | adapt bounded 250-row snapshot scan, v2 cursor, batch enrichment, and stable sort | >10k and cursor tests |
| lifecycle/ranges | `public-api.ts` and lifecycle reference | retain terminal precedence and add exact 48-hour recently-finished filtering | lifecycle/range tests |
| availability | public API reference | derive score/odds/events from batch evidence and expose safe reasons | availability/query-count tests |
| Web UX | `MatchesBrowser.tsx` | adapt Live-first fallback chain while preserving manual selection and cancellation | Web typecheck/build and UX tests |
| documentation | v2 documentation reference | re-create and update all required audit, architecture, API, product, and operations documents | path/index/documentation checks |

## Safety boundary

Production verification, migration, seed, deployment, provider writes, and fabricated
production counts are not part of this phase. The diverged reference worktree and primary
checkout remain untouched.
