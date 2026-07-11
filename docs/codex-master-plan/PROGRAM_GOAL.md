# MatchPulse End-to-End Program Goal

> Status: review-only program specification. This document does not activate program mode, change the active phase, publish code, apply migrations, access networks, or deploy production.

## 1. Mission

Deliver MatchPulse as a production-ready, secure, deterministic, replayable, observable, and publicly safe live football scenario intelligence platform.

The finished system must:

1. ingest canonical live fixture, score, event, odds, history, freshness, and proof-state data from TxLINE;
2. recover from stream interruptions without silent data loss;
3. persist an auditable canonical match timeline;
4. assemble stable versioned model features;
5. run private specialist inference behind an explicit adapter boundary;
6. compose bounded scenario probabilities deterministically;
7. label, evaluate, replay, calibrate, and version predictions without future-data leakage;
8. expose only sanitized public contracts;
9. provide an accessible web experience and optional user-controlled notifications;
10. distinguish data proof state from prediction validity;
11. operate with documented security, observability, backup, rollback, and release procedures;
12. provide a reproducible demo mode and production runbook.

## 2. Non-goals and prohibited capabilities

The finished product must not provide or imply:

- betting recommendations or wagering instructions;
- stake, payout, profit, expected-value, edge, or trade-execution features;
- wallet requirements for ordinary product use;
- public disclosure of provider payloads, provider-specific weights, model coefficients, thresholds, formulas, private policy values, credentials, or debug lineage;
- unsupported claims that derived predictions are cryptographically verified;
- direct mutation of production systems without an explicit approved deployment gate.

## 3. Program completion criteria

The program is complete only when every applicable criterion below has objective evidence committed or linked from the repository.

### 3.1 Functional completeness

- TxLINE client lifecycle, authentication, retry, refresh, SSE, proof, and validation are complete.
- Stream supervision, catch-up, deduplication, checkpointing, and restart recovery are complete.
- Canonical persistence and odds persistence are complete after an approved migration gate.
- Feature assembly, private policy adapter, prediction composition, runtime orchestration, labeling, evaluation, replay, and calibration are complete.
- Public API, web experience, watchlist, and approved notification channels are complete.
- Verification states are structurally correct and on-chain verification is enabled only in an approved network mode.

### 3.2 Quality completeness

- Repository-wide typecheck passes.
- Every package build passes.
- Unit, contract, integration, replay, migration, security, and end-to-end suites pass according to the quality gate matrix.
- Determinism, idempotency, retry bounds, deduplication, timestamp ordering, probability invariants, and public redaction are tested.
- Coverage thresholds defined in `QUALITY_GATE_MATRIX.md` are met or an approved exception is recorded.
- No high or critical unresolved security finding remains.
- No unowned P0/P1 production risk remains.

### 3.3 Operational completeness

- Health, readiness, dependency status, metrics, structured logs, redaction, and tracing are implemented.
- Backup, restore, rollback, incident response, and degraded-mode procedures are documented and tested.
- Environment contracts and secret inventories exist without secret values in Git.
- Deployment and release are reproducible from immutable commits.

### 3.4 Public-safety completeness

- Public responses are versioned and sanitized.
- Internal specialist contributions, feature references, provider identities, assigned weights, proof blobs, and proprietary policy values are absent from public contracts.
- Product language remains informational sports analytics only.

### 3.5 Documentation completeness

- Architecture, ADRs, API contracts, schema/migration notes, threat model, operational runbook, release checklist, limitations, and demo instructions are current.
- Every phase has exact inputs, outputs, allowlist, tests, acceptance criteria, rollback notes, and completion evidence.

## 4. Autonomous execution objective

After program mode is explicitly approved and enabled, Codex should continue through the approved program plan without requiring a new prose prompt for every phase.

Codex must:

1. select only phases marked `ready` by the machine-readable plan;
2. respect dependencies, hard gates, soft gates, resource locks, and maximum parallelism;
3. generate or install one exact phase pack at a time;
4. validate before editing;
5. implement only declared target files;
6. run all required tests and repair only in-scope failures;
7. prepare and publish only when the program authorization permits it;
8. update evidence and program state atomically;
9. continue to the next eligible phase automatically;
10. stop only on a declared hard gate, missing human input, security concern, unrecoverable validation failure, or completed program.

## 5. Decision policy

Codex may decide implementation details autonomously when all of the following are true:

- the choice is reversible;
- the choice does not change a public contract, database schema, security boundary, production dependency, legal/privacy posture, or paid infrastructure commitment;
- the repository has an established pattern;
- tests can objectively verify the result;
- no user secret or external account is required.

Codex must stop for a recorded decision when a choice affects:

- Prisma schema or migration;
- public API compatibility;
- authentication or authorization model;
- data retention or privacy policy;
- provider credentials or paid quotas;
- real TxLINE, Telegram, Solana, database, cloud, DNS, or production access;
- production deployment or release;
- irreversible data mutation;
- licensing, branding, legal terms, or user-facing compliance text.

## 6. Definition of PROGRAM_COMPLETE

Codex may report `PROGRAM_COMPLETE` only when:

- every required phase in `PROGRAM_PLAN.json` is `completed`;
- every required human input is resolved or explicitly waived;
- every hard gate is approved and evidenced;
- all release gates pass;
- the final release commit and tag are immutable and verified;
- the production or approved demo deployment passes smoke tests;
- the final program report lists exact commits, migrations, environments, test results, known limitations, and rollback references.
