# MATCH-LIFECYCLE-CATALOG-A v1

Implement one canonical lifecycle resolver used by ingestion, API, and Web-facing DTO construction.

Canonical states: `scheduled`, `prematch`, `live_first_half`, `halftime`, `live_second_half`, `extra_time`, `penalties`, `finished`, `postponed`, `cancelled`, `abandoned`, `unknown_in_progress`, and `finished_unconfirmed`.

Provider terminal/live status has priority over persisted phase, event/score evidence, and kickoff heuristics. Provider status is retained verbatim only in internal persistence and never exposed as raw provider payload. A past kickoff without terminal confirmation becomes `unknown_in_progress`, then `finished_unconfirmed` after capture tail. Future matches are never Upcoming when terminal/postponed/cancelled.

Resolver output must include lifecycle, source, confidence, reason code, provider status, normalized phase, active/terminal flags, and updated timestamp. All defaults are UTC and environment-overridable only where explicitly defined by the implementation.

Required tests cover future/prematch/kickoff/unknown/provider override/halftime/second half/extra time/penalties/finished/postponed/cancelled/abandoned/finished-unconfirmed, missing start time, stale status, and timezone boundaries.

Validation: focused lifecycle tests, API regression, worker typecheck/build, `git diff --check`, Prisma validate/diff, and forbidden public-field scan. No migration, seed, production write, or real network access.

Rollback: revert the single prepared phase commit; do not reset, clean, stash, or rewrite unrelated work.

## Definition of Done

The resolver is the sole lifecycle source for worker/API/Web contracts, Upcoming excludes terminal/past fixtures, and every listed test and safety gate passes.
