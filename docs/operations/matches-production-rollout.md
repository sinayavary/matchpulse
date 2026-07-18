# Matches Production Rollout

No step in this document is automatically authorized by the source change.

1. Review CI evidence: frozen install, Prisma format/validate/generate, migration diff, lint, tests, typecheck, production build, Playwright, safety scans, and `git diff --check`.
2. At a separate human gate, apply migration `20260718170000_fixture_competition_id`. It is additive and rollback must not drop the column or source evidence.
3. Deploy API and confirm `ok=true` while readiness stays degraded until dependencies are observed.
4. Deploy ingestion, intelligence, and evaluation workers. Confirm distinct fresh heartbeats and leases; learning must report `shadow_only`.
5. Run resumable evidence-only competition-ID backfill. Unproven rows remain null.
6. Deploy Web with explicit browser/SSR API origins and production CORS allowlist.
7. Run read-only E2E for today, tomorrow, competition, refresh, pagination, errors, and match detail.
8. Record deployed SHA, migration version, real status output, today/tomorrow coverage, and E2E evidence before declaring Production Accepted.

Roll back application versions independently. Never roll back by dropping `competition_id` or deleting ingestion/raw source data. Watchlist, Telegram, model coefficient changes, and automatic promotion remain out of scope.

