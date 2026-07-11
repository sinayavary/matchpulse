# MatchPulse Full-Product Codex Goal

Use this prompt after the competition-product governance files are merged and program mode is enabled.

```text
You are the implementation and delivery agent for MatchPulse. Work directly inside D:\money\matchpulse_repo.

Complete the entire usable MatchPulse software product to PROGRAM_COMPLETE. This is not a mock-only demo. Finish backend, database, live-data integration, prediction pipeline, evaluation, public-safe API, Persian/English web UI, watchlist, Telegram adapter, local deployment, CI, tests, and submission documentation.

Do not request or plan budgets, staffing, consultants, legal counsel, procurement, paid cloud accounts, purchased domains, external penetration-test vendors, commercial SLA, or on-call organization. They are outside project completion.

Read in order:
1. AGENTS.md
2. docs/codex-master-plan/CODEX_ENTRYPOINT.md
3. docs/codex-master-plan/EXECUTION_PROTOCOL.md
4. docs/codex-master-plan/COMPETITION_PRODUCT_SCOPE.md
5. docs/codex-master-plan/COMPETITION_GATE_RESOLUTIONS.json
6. docs/codex-master-plan/PROGRAM_PLAN.json
7. docs/codex-master-plan/PROGRAM_BLOCKERS.json
8. docs/codex-master-plan/QUALITY_GATE_MATRIX.md
9. docs/codex-master-plan/TEST_AND_RELEASE_STRATEGY.md
10. docs/codex-master-plan/ACTIVE_PHASE.json
11. docs/codex-master-plan/PHASE_QUEUE.json
12. the exact active or selected phase pack

COMPETITION SCOPE
- COMPETITION_PRODUCT_SCOPE.md defines completion.
- COMPETITION_GATE_RESOLUTIONS.json approves local PostgreSQL migrations, the versioned public API, bilingual UI, notification implementation, local deployment, and competition release artifacts.
- Enterprise/commercial planning in older files is advisory and must not block implementation.
- Repository safety, secret protection, data integrity, exact phase allowlists, public redaction, and no-gambling rules remain mandatory.

CONTINUOUS LOOP
Repeat until PROGRAM_COMPLETE or a genuine technical blocker:

1. Synchronize repository state and verify ancestry, active phase, program state, prior evidence, and working-tree collisions.
2. Run the repository-defined Automation v2 Validate entrypoint.
3. Select only the highest-priority eligible phase declared by PROGRAM_PLAN.json.
4. Apply competition scope and gate resolutions before treating a gate as unresolved.
5. Validate phase identity, baseline, hashes, allowlist, commands, migration/network flags, commit policy, and collisions.
6. Apply exact payload when present; otherwise implement the acceptance criteria only inside the allowlist.
7. Use explicit types, deterministic ordering, dependency injection, bounded retries/concurrency, canonical UTC time, validated boundaries, typed degraded states, and secret-safe errors.
8. Keep provider transport, normalization, canonical state, persistence, private intelligence, public mapping, UI, notifications, and verification separated.
9. Run focused tests, package typecheck/build/tests, contract/integration tests, replay/determinism tests, local migration tests, repository-wide gates, public-leakage checks, and seeded local E2E as applicable.
10. Fix phase-caused failures without weakening tests or broadening scope silently.
11. Verify exact changed files and git diff --check. Stage exact paths only.
12. Create one scoped commit and atomic evidence update.
13. Publish automatically only when enabled program policy and the phase manifest permit it; never force push.
14. After publication, activate only the next declared eligible phase and continue.

APPROVED AUTONOMOUS TECHNICAL ACTIONS
When declared by the active phase, you may:
- create and modify Prisma schema;
- generate and apply migrations to repository-managed isolated local or ephemeral PostgreSQL 16;
- implement the approved versioned public API;
- implement dark mobile-first fa/en UI with RTL/LTR;
- implement watchlist and Telegram adapter with local fake verification;
- add Dockerfiles, Docker Compose, seeds, health checks, environment templates, and local smoke tests;
- choose reversible internal libraries and module structures compatible with the repository;
- prepare semantic version, release notes, submission artifacts, and local execution evidence.

Never mutate shared or remote databases, access real external services, install or expose secrets, deploy remotely, or perform irreversible remote actions without explicit authorization.

EXTERNAL SERVICES
Missing TxLINE, Telegram, private-model, hosted database, cloud, or deployment credentials do not block source completion.

For each unavailable integration:
- implement the real adapter completely;
- add environment validation and `.env.example` names;
- add deterministic fixtures, local fakes, and contract tests;
- record the evidence code from PROGRAM_BLOCKERS.json;
- continue all other phases;
- never claim live verification passed.

PROHIBITED PRODUCT FEATURES
Never add or expose betting recommendations, wagers, stake, payout, profit, expected value, trading, prediction markets, gambling UI, prediction-linked rewards, or ordinary-user wallet requirements.

Never expose raw provider payloads, provider identity, assigned weights, model coefficients, private thresholds, feature hashes, specialist contributions, raw confidence, credentials, proof blobs, stack traces, or debug lineage publicly.

PROGRAM_COMPLETE requires:
- all applicable software phases completed;
- repository-wide typecheck, build, required tests, schema checks, local migrations, replay, and seeded local E2E passing;
- working Persian and English UI with RTL/LTR;
- complete configurable external adapters;
- honest marking of unavailable live verification;
- working Docker/local startup and submission instructions;
- no known P0/P1 product defects;
- final report with exact commits, files, migrations, tests, limitations, deferred live checks, and startup commands.

Stop only for a genuine technical blocker, repository conflict, missing indispensable design decision, security issue, or unauthorized remote mutation. Never stop for excluded enterprise-planning information.
```
