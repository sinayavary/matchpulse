# MatchPulse Technical Enablement Checklist

Program mode may be enabled only after these technical checks are satisfied. Enabling it is a separate governance action.

## Authority and state

- [ ] Primary competition-product authority files parse or render correctly and contain no contradictions.
- [ ] `PROGRAM_PLAN.json` has `program_mode.enabled: false` before the explicit enablement commit and `max_parallel_phases: 1`.
- [ ] The active phase, queue, dependencies, baselines, allowlists and payload hashes are valid.
- [ ] Phase 10H-A remains review-only and is not selected or activated.

## Repository and toolchain

- [ ] Offline frozen dependency installation succeeds.
- [ ] Prisma client generation succeeds without applying a migration.
- [ ] Repository typecheck, required builds and tests pass.
- [ ] All retained JSON files parse.
- [ ] Automation and phase-pack schema checks pass.

## Local data safety

- [ ] PostgreSQL 16 runs locally or ephemerally with an isolated repository-owned database.
- [ ] A phase may create or apply a local migration only when its manifest explicitly permits it.
- [ ] Shared and remote database mutation is denied.
- [ ] Migration prechecks, rollback/forward-fix instructions and data-integrity tests are present where applicable.

## External adapters

- [ ] TxLINE, Telegram and private-model adapters have deterministic fixtures, local fakes and contract tests.
- [ ] Live access is disabled by default and requires explicit authorization plus configured credentials.
- [ ] Missing credentials are recorded as live verification not run and do not block other work.
- [ ] Timeouts, retry limits, concurrency limits and exact host allowlists are declared.

## Security and public boundary

- [ ] Secret scanning and public-leakage checks pass.
- [ ] Public contracts are versioned and exclude raw provider data, identities, private weights, coefficients, thresholds, proof blobs and debug lineage.
- [ ] Authentication, input limits, safe errors, log redaction, rate limits and dependency checks are covered where applicable.
- [ ] No gambling or ordinary-user wallet functionality is introduced.

## Product and release evidence

- [ ] Backend, persistence, ingestion, prediction, evaluation, API, bilingual web, watchlist and Telegram phases are represented.
- [ ] Docker/local startup, seeds, health/readiness and a seeded end-to-end scenario are defined.
- [ ] CI covers typecheck, tests, build, schema, security and public-redaction gates.
- [ ] Release notes, limitations, startup instructions and competition submission artifacts are defined.
- [ ] Solana/on-chain work is marked deferred and not required.
- [ ] Remote mutation and remote deployment remain separately authorized actions.
