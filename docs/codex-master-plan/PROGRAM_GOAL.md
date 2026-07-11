# MatchPulse Competition Product Goal

> Status: review-only governance. Program mode remains disabled until separately enabled.

## Mission

Deliver one complete, reproducible MatchPulse competition product. It is a real software product, not a mock-only demonstration.

The release includes:

- a complete backend and canonical PostgreSQL persistence on isolated local PostgreSQL 16;
- TxLINE adapters with deterministic offline fixtures and optional credential-gated live checks;
- supervised ingestion, checkpointing, deduplication, replay and restart recovery;
- feature assembly, prediction composition, labeling, evaluation and calibration;
- a versioned public-safe API that never exposes provider payloads, secrets or private model policy;
- a complete Persian/English web application with accessible RTL/LTR layouts;
- watchlist and Telegram delivery through a locally testable adapter;
- Docker/local reproducible startup, health checks, logs and environment templates;
- CI, automated tests, documentation and a competition submission release.

## Completion

The product is complete when all applicable phases and quality gates pass, local migrations succeed in an isolated disposable database, the seeded end-to-end path works, both languages and directions are verified, configurable integrations have offline evidence, and there are no known P0/P1 defects.

Unavailable external credentials block only their live verification. Remote services remain disabled unless separately authorized. Solana/on-chain work is deferred and is not required.

## Permanent safeguards

- No wagering, stake, payout, profit, expected-value or trading features.
- No secrets, raw provider payloads, private coefficients, weights, thresholds or debug lineage in Git or public responses.
- No shared or remote database mutation, external-service access, deployment or other remote mutation without explicit authorization.
- Every phase uses exact allowlists, bounded retry/concurrency, deterministic evidence, migration isolation and exact-path staging.
- `ACTIVE_PHASE.json` and `PHASE_QUEUE.json` change only through their separately approved governance transition.

Company planning, budgets, staffing, procurement, commercial operations and external vendors are outside this product definition and are not completion gates.
