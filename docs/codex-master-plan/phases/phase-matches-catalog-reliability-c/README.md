# MATCHES-CATALOG-RELIABILITY-C v1

## Purpose

Complete the Matches Catalog remediation from the official `origin/main` baseline
`75390e501164eff37998e4151b310ca2c81b9d1f`. The published B completion remains
review-rejected and is superseded for implementation purposes; its local branch is
reference-only. This successor preserves the B history and transfers only reviewed,
validated semantic deltas onto the official baseline.

## Source and provenance rules

- `origin/main` at the recorded baseline is authoritative.
- `D:\\money\\matchpulse_matches_catalog_reliability` is read-only reference material.
- No merge, cherry-pick, rebase, reset, restore, stash, or history rewrite is permitted.
- Every transferred delta must be recorded in `docs/matches-catalog-remediation-provenance.md`.
- `MATCHES-CATALOG-RELIABILITY-B` remains published but review-rejected; no other phase is activated.
- `PROD-LIVE-E2E-ACCEPTANCE-B` remains paused.

## Required outcomes

The successor must close all eleven review gaps: complete audit and operating documentation;
a real resumable reconciliation job; runtime/health-integrated fourteen-day discovery with
bounded retry and rate-limit handling; exact recently-finished boundaries; no global 10,000-row
ceiling; evidence-derived event availability; complete deterministic sorting and representative
selection; snapshot-stable pagination; and Live → Starting soon → Upcoming → Recently finished
Web auto-selection with manual-tab preservation.

## Invariants

- Upcoming never contains past, terminal, interrupted, or non-representative fixtures.
- Source and derived records are never deleted or merged destructively.
- Public responses contain no raw payloads, secrets, internal lineage, model detail, or betting fields.
- List enrichment is batched and bounded; no per-fixture N+1 query is introduced.
- Reconciliation is dry-run by default, explicit apply only, resumable, idempotent, and safe to restart.
- No Prisma schema change, migration, seed, deployment, production write, or fabricated evidence.

## Validation and completion

Run the full focused suites, API and Worker regression, Web typecheck/build, Prisma validate/diff,
public leakage scan, documentation checks, and `git diff --check` on this baseline. Record exact
results in `ACTIVE_PHASE.json`, set `completed_pending_review` only after the Definition of Done
is proven, then run Automation v2 Prepare. Stop before Publish unless explicitly instructed.

## Rollback

Rollback is the single scoped prepared completion commit. Never delete fixtures, MatchState,
Odds, Event, Replay, Prediction, or source payload records.
