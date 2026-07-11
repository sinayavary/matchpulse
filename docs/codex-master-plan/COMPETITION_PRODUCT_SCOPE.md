# MatchPulse Full-Product Competition Scope

> This scope supersedes enterprise/commercial planning requirements that are not necessary to finish the software product. It does not weaken repository safety, secret handling, data integrity, migration safety, or public redaction rules.

## Objective

Deliver MatchPulse as a complete, usable, testable, deployable football intelligence product for competition submission. This is not a mock-only demo and not a slideware prototype.

The completed product must include:

- TxLINE transport and normalization adapters with deterministic offline fixtures for CI;
- stream lifecycle, reconnect, catch-up, checkpoint and deduplication behavior;
- PostgreSQL-backed canonical data and odds persistence;
- feature assembly, prediction composition, fallback behavior and model-adapter boundary;
- labels, replay, evaluation and calibration reports;
- versioned public-safe API;
- bilingual Persian/English web application with RTL/LTR support;
- watchlist and Telegram integration behind environment configuration;
- health/readiness endpoints, structured logs and basic metrics;
- local reproducible execution using Docker Compose or the repository-equivalent tooling;
- CI for typecheck, build, tests, schema checks and public-leakage/security checks;
- seeded end-to-end scenario and complete operator/submission documentation.

## Explicitly not required for completion

The following are not program blockers and must not cause Codex to request information or stop:

- budget estimates;
- staffing plans or named engineering roles;
- legal counsel or compliance-consultant approval;
- company structure, billing owner or procurement workflow;
- paid cloud-account selection;
- independent penetration-test vendor;
- enterprise on-call rotation, commercial SLA or multi-region architecture;
- a fixed calendar schedule;
- production customer contracts;
- a purchased domain.

Codex may document sensible production considerations, but they are not acceptance gates for this competition product.

## Technical defaults

When no stronger repository decision exists, use these defaults:

- PostgreSQL 16 in local Docker Compose;
- local or containerized services with environment-variable configuration;
- configurable base URLs instead of hard-coded domains;
- deterministic fixtures and mocks only for tests and offline execution;
- real external adapters implemented completely but network calls disabled unless credentials are present and explicitly enabled;
- no secret values committed to Git;
- one repository owner acts as human approver when an irreversible action genuinely requires approval;
- use simple, maintainable deployment manifests rather than enterprise infrastructure;
- Solana/on-chain work remains deferred and is not required for completion;
- no betting, wagering, payout, profit, trading, prediction-market or gambling functionality.

## External credentials policy

Missing TxLINE, Telegram, database-hosting or model-service credentials must not block source completion.

Codex must:

1. implement and test the adapter through fixtures, contract tests and local fakes;
2. provide `.env.example` variable names and validation;
3. mark live verification as `NOT_RUN_CREDENTIALS_UNAVAILABLE` when credentials are absent;
4. continue every other eligible phase;
5. never claim live verification passed when it was not executed.

## Completion definition

The competition product is complete when:

- all applicable source phases are implemented;
- database migrations work on an isolated local PostgreSQL environment;
- repository-wide typecheck, build and required tests pass;
- the seeded local end-to-end flow works from ingestion through prediction API and web presentation;
- Persian and English layouts work with RTL/LTR;
- external integrations are implemented and configurable even if live credentials are unavailable;
- critical public-redaction, determinism, idempotency and data-integrity tests pass;
- Docker/local startup, environment template, architecture and submission instructions are current;
- no known P0/P1 product defect remains.

Commercial production deployment, paid accounts, legal review and enterprise operations are outside this completion definition.