# Matches reconciliation dry-run

The reconciliation report is a source-preserving dry-run. It groups only compatible normalized sport/competition/team candidates, compares kickoff intervals with a five-minute maximum cluster span, and keeps stage conflicts separate. It never deletes fixtures, score, odds, event, prediction, or replay rows.

Before any separately authorized apply, record a backup verification, exact rows scanned, duplicate groups, selected representatives, lifecycle/status corrections, batch size, cursor/checkpoint, and rollback identifier. Apply must be idempotent, resumable, bounded, and limited to canonical metadata/lifecycle corrections. A failed or rate-limited discovery day must not be hidden by a later successful day.
