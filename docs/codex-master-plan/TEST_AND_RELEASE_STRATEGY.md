# MatchPulse Test and Release Strategy

## 1. Test pyramid and evidence

Every test command must be reproducible from a clean checkout. Evidence must include command, environment, commit SHA, exit code, duration, test counts, and generated artifact references.

### 1.1 Static gates

- TypeScript strict typecheck for every workspace.
- Package builds.
- JSON/YAML/schema validation.
- lint and formatting checks where configured.
- forbidden-field, secret, dependency, and license scans.
- Prisma schema validation and migration diff when applicable.

### 1.2 Unit and invariant tests

Required for deterministic domain logic:

- valid and invalid boundaries;
- timestamp ordering;
- sorting and canonicalization;
- probability range and sum invariants;
- monotonic horizons;
- idempotent identities;
- no mutation of caller-owned input;
- unavailable and fallback behavior;
- maximum retry, batch, pagination, queue, and concurrency bounds.

Use fake clocks, deterministic random sources, injected sleepers, mock transports, and isolated storage adapters.

### 1.3 Contract tests

Contract suites must protect:

- TxLINE transport and normalized domain boundaries;
- internal intelligence contracts;
- persistence interfaces;
- public API response versions;
- Telegram message mapping;
- proof-state mapping;
- environment variable and configuration schemas.

Breaking contract changes require an explicit versioning phase and human approval when public.

### 1.4 Integration tests

Run against disposable or isolated dependencies:

- PostgreSQL-compatible test database for persistence phases;
- local mock TxLINE HTTP/SSE server;
- mock Telegram endpoint or approved sandbox;
- mock Solana RPC before any approved live cluster test;
- application server with real serialization and route boundaries.

Integration tests must verify cleanup and avoid dependence on execution order.

### 1.5 Replay and determinism tests

Maintain canonical fixtures covering:

- pre-match to finish;
- goals, corrections, red cards, penalties, halftime and extra time;
- out-of-order and duplicate events;
- stream gaps and reconnect catch-up;
- missing and stale odds;
- provider disagreement and anomaly states;
- partial feature coverage;
- proof unavailable/invalid/verified states.

The same canonical input and version set must produce the same features, snapshot identity, prediction output, labels, and public response.

### 1.6 End-to-end tests

Critical flows:

1. ingest a seeded match timeline;
2. recover from an injected stream disconnect;
3. build features and prediction snapshots;
4. persist and retrieve internal state;
5. map to the public API;
6. render the match list and detail experience;
7. opt into a watchlist and generate a deduplicated notification in an approved test channel;
8. show verification state without leaking proof or internal policy.

### 1.7 Security tests

- input validation and injection resistance;
- authentication/authorization negative cases;
- SSRF and origin enforcement for provider/network clients;
- rate-limit and body-size enforcement;
- secret and sensitive-field log redaction;
- public recursive forbidden-field scan;
- dependency, container, and secret scanning;
- error-response stack and internal-lineage exclusion.

### 1.8 Performance and reliability tests

Define fixture-scale profiles from approved product inputs.

At minimum test:

- concurrent live fixtures;
- events per second;
- prediction triggers per fixture;
- database write/read latency;
- reconnect storms;
- provider slowdown and timeout;
- queue saturation;
- application restart and dependency outage;
- notification burst with cooldown and dedupe;
- load, soak, and failure injection in staging.

## 2. Environment strategy

### Development

- local or isolated database;
- mock provider and network dependencies by default;
- no production credentials;
- deterministic seed and replay fixtures.

### CI

- clean checkout;
- pinned Node and pnpm versions;
- generated Prisma client;
- isolated services;
- no real provider, Telegram, Solana, or production access;
- upload machine-readable test and coverage artifacts.

### Staging

- production-like configuration and topology;
- separate data and credentials;
- approved limited real-service tests only;
- migration rehearsal;
- backup/restore and rollback exercise;
- load, soak, smoke, security, and alert-routing verification.

### Production

- immutable artifacts;
- least-privilege identities;
- managed secrets;
- explicit release gate;
- observable rollout;
- tested rollback;
- post-release smoke and monitoring window.

## 3. Release branches and artifacts

- `main` remains the reviewed integration authority.
- Phase branches contain one exact scoped phase.
- Draft source branches may provide reviewed payloads but do not substitute for active-phase execution evidence.
- Releases use immutable commit SHAs and tags.
- Container images, when used, are referenced by digest, not floating tag alone.
- Generated public schemas, migration checksums, SBOM, dependency scan, and test reports are attached or referenced in release evidence.

## 4. Deployment sequence

1. verify approved release commit and clean repository state;
2. verify all required gates and human inputs;
3. build immutable artifacts;
4. run static, unit, contract, integration, replay, security, and build gates;
5. deploy to staging;
6. apply approved staging migrations with backup and verification;
7. run staging smoke, end-to-end, load/soak, failure-injection, and alert tests;
8. approve exact production plan;
9. create or verify production backup;
10. deploy application using approved rollout method;
11. apply production migration only when separately authorized;
12. run production smoke tests;
13. verify health, readiness, metrics, logs, errors, provider connectivity, and data freshness;
14. observe during the approved monitoring window;
15. complete or roll back according to objective thresholds;
16. publish release evidence and known limitations.

## 5. Rollback triggers

Rollback or halt rollout on:

- failed health or readiness;
- migration verification failure;
- unexpected data loss, duplication, ordering regression, or corruption;
- critical public contract regression;
- secret or internal-field exposure;
- sustained error-rate, latency, queue, or freshness breach;
- provider quota or reconnect storm outside bound;
- failed core smoke flow;
- high or critical security finding introduced by the release.

## 6. Final release evidence

The final report must include:

- release version and tag;
- source and artifact SHAs/digests;
- included phase IDs and PRs;
- schema and migration identifiers;
- environment names and regions;
- configuration and secret variable names, never values;
- test and scan results;
- performance and reliability results;
- backup and rollback evidence;
- production smoke results;
- known limitations and deferred P2/P3 issues;
- public contract version;
- model, feature, label, calibration, and policy version references;
- operator runbook link;
- release approver and timestamp.
