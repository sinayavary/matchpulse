# Matches Catalog Reconciliation

The worker command is dry-run by default:

```text
matches-catalog-reconcile --dry-run --competition=430 --batch-size=250
matches-catalog-reconcile --dry-run --resume --cursor=<fixture-id>
matches-catalog-reconcile --apply --competition=430
```

The job is bounded, cursor-resumable, restart-safe, idempotent, and row-failure isolated.
Checkpoint metadata is stored under `matchpulse-matches-catalog-reconcile` in HealthStatus;
it contains only version, mode, cursor, counts, failures, and timestamps. No source or
derived row is deleted, and no raw provider payload or secret is logged.

Production apply is outside this phase and requires separate authorization.
