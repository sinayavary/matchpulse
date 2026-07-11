# MatchPulse Test and Competition Release Strategy

## Test layers

1. Unit tests cover validation, deterministic ordering, probability invariants, redaction and degraded states.
2. Contract tests cover TxLINE, model, Telegram and public API boundaries using deterministic fixtures and local fakes.
3. Integration tests cover supervised ingestion, PostgreSQL persistence, restart recovery, prediction storage and API mapping against isolated local PostgreSQL.
4. Replay/evaluation tests prove strict temporal ordering, no future leakage, repeatability and segmented metrics.
5. Web tests cover Persian/English content, RTL/LTR layout, accessibility and all loading/failure states.
6. A seeded local end-to-end test covers ingestion through persistence, prediction, public API and web presentation.

Live external checks run only when separately authorized credentials are available. Their absence is reported and does not fail the competition release if fixture, contract and local evidence passes.

## CI

CI installs from the frozen lockfile and runs Prisma generation, typecheck, builds, unit/contract/integration tests, JSON/schema checks, migration checks where applicable, secret/dependency scans, public forbidden-field checks, Docker build and the seeded smoke test.

Tests must not use `.only`, hidden-success shell constructs, unbounded waits, real secrets or uncontrolled external services.

## Local release

The release candidate is built from an immutable commit and starts through documented Docker/local commands with PostgreSQL 16 isolated to the release environment. Environment templates contain names and safe defaults only. Startup verification includes migrations explicitly permitted for the release phase, seed, health/readiness, API/web smoke and clean shutdown.

## Submission evidence

Record the exact commit, changed files, migration identifiers, commands/results, artifact hashes, supported startup commands, API version, browser/language coverage, known limitations and every live integration not run. Prepare semantic version and release notes; publishing a tag or any remote artifact remains separately authorized.

Solana/on-chain work is deferred and not required.
