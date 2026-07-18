# Matches Catalog Audit

## Scope and evidence boundary

This is a read-only discovery-to-Web audit for successor C. Evidence is repository code,
the Prisma schema, fixtures, and local test harnesses. No production credentials, origin,
database, or fabricated production dataset is used; production counts remain `not available`.

| Measure | Evidence status | C proof |
| --- | --- | --- |
| fixture and distinct-ID counts | production DB not authorized | bounded cursor scanner |
| unknown status/missing kickoff | local fixtures only | normalizer and reconciliation report |
| future/past/terminal Upcoming violations | local scenarios | lifecycle and API invariants |
| duplicate IDs/canonical groups/incomplete identity | local scenarios | identity and representative tests |
| missing MatchState/Odds/Events | local batch mocks | availability/query-count tests |
| pagination overlap/missing rows | local traversal harness | snapshot cursor tests |
| discovery coverage/retry | local worker harness | UTC, retry, rate-limit, health tests |

```mermaid
flowchart LR
  A[UTC provider discovery] --> B[normalize status and identity]
  B --> C[preserve Fixture source row]
  C --> D[worker lifecycle and enrichment]
  D --> E[bounded catalog snapshot scan]
  E --> F[batch state odds events]
  F --> G[range filter and representative]
  G --> H[opaque seek cursor]
  H --> I[Web tabs and refresh]
```

## Review closure

Successor C explicitly covers all eleven rejected findings: documentation, executable
reconciliation, runtime discovery, bounded retry/rate-limit handling, 48-hour recently
finished, removal of the 10,000-row ceiling, evidence-derived availability, deterministic
sorting and representatives, snapshot pagination, and the Live-first Web default.

## Limitations

Production read-only verification is not claimed. No production write, migration, seed,
deployment, or raw provider payload is included in this audit.
