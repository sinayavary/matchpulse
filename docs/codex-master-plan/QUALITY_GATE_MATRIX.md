# MatchPulse Quality Gate Matrix

This matrix defines minimum evidence for each phase risk class. A phase may add stricter gates but may not silently weaken these gates.

## 1. Universal gates

Required for every source-changing phase:

- active manifest and baseline verified;
- exact allowlist verified before and after implementation;
- no unexpected modified or untracked file collision;
- payload integrity verified when payload exists;
- focused tests pass;
- affected package typecheck passes;
- affected package build passes;
- `git diff --check` passes;
- forbidden public-field and secret scans pass;
- no unrelated path in prepared commit;
- completion evidence records actual commands and exit codes.

## 2. Risk-class requirements

### R0 — Documentation/read-only

Required:

- link and filename validation;
- JSON/YAML/schema validation where applicable;
- consistency check against current repository state;
- no change to active phase unless the governance change explicitly authorizes it.

### R1 — Reversible source change

Required:

- all universal gates;
- repository-wide typecheck;
- affected package full unit/contract suite;
- dependent package contract suite;
- deterministic repeat-run test for hash, ordering, or probability logic;
- no migration diff;
- no network access;
- branch CI success.

Suggested minimum test coverage for new deterministic domain modules:

- statements: 90%;
- branches: 85%;
- functions: 90%;
- lines: 90%.

Coverage is not a substitute for invariant tests.

### R2 — Internal integration or prepared persistence

Required:

- all R1 gates;
- integration tests with test doubles or isolated services;
- idempotency test;
- concurrency/cancellation test where applicable;
- restart/replay equivalence test;
- failure-injection test;
- resource-bound test for queue, retry, pagination, or batch size;
- documented rollback and degraded-mode behavior.

### R3 — Public contract, schema, auth, real network, notifications or mutation

Required before prepare:

- all R2 gates;
- approved human gate evidence;
- contract compatibility tests;
- schema/migration dry run and diff review when applicable;
- security review and threat-model delta;
- secret and log-redaction tests;
- rate-limit, timeout, retry and quota tests;
- privacy/retention review when personal data is involved;
- staging integration evidence;
- rollback procedure tested in a safe environment;
- no high or critical unresolved security finding.

Required before publish or environment mutation:

- exact approved commit SHA;
- exact environment and credentials-by-name;
- backup evidence when data may change;
- maintenance or rollout plan;
- post-change verification plan;
- explicit operator authorization.

### R4 — Production deployment or release

Required:

- all R3 gates;
- immutable artifact digest;
- signed or otherwise verifiable release metadata where supported;
- staging smoke and end-to-end success;
- backup/restore verification;
- rollback exercise;
- load and soak evidence;
- alert routing test;
- runbook review;
- known-limitations approval;
- exact release window and owner;
- production smoke success;
- release tag and final evidence report.

## 3. Domain-specific gates

### 3.1 TxLINE client and streams

- invalid input rejected before transport;
- same-host and approved-origin enforcement;
- guest JWT refresh bounded to the declared limit;
- retry only for classified transient failures;
- reconnect bounds and heartbeat timeouts tested with a fake clock;
- stream cancellation and graceful shutdown tested;
- duplicate and gap behavior deterministic;
- provider credentials and raw payloads absent from logs.

### 3.2 Canonical timeline and persistence

- unique idempotency key semantics documented and tested;
- source/observed/received/persisted timestamps distinct;
- ordering regressions rejected or quarantined;
- transaction boundaries tested;
- restart recovery produces replay-equivalent state;
- retention and deletion behavior tested;
- migration down/rollback or compensating strategy documented.

### 3.3 Prediction and probability

- all probabilities finite and within 0..1;
- distributions sum to one within declared tolerance;
- horizon probabilities monotonic;
- unavailable specialist has zero assigned weight and no output;
- specialist weights satisfy the active runtime policy;
- market contribution does not exceed odds-intelligence cap;
- fallback behavior explicit;
- equivalent canonical inputs produce identical snapshot identity and output;
- future information cannot enter features, labels, evaluation or calibration;
- public mapper removes internal contributions, weights, feature references and provider details.

### 3.4 Public API

- versioned schema and generated contract snapshot;
- forbidden fields recursively scanned;
- probabilities remain valid after display rounding;
- degraded, stale, no-data and error states tested;
- authentication and authorization tested where enabled;
- rate limit, pagination, body limit and cache behavior tested;
- no stack, raw payload, proof blob or secret in responses.

### 3.5 Web experience

- responsive behavior at agreed breakpoints;
- loading, empty, stale, degraded, offline and error states;
- keyboard navigation;
- screen-reader labels;
- WCAG 2.2 AA automated checks plus manual critical-flow review;
- RTL/LTR rendering for approved languages;
- no user-facing gambling language;
- no hidden dependency on operator wallet state.

### 3.6 Notifications

- explicit opt-in;
- unsubscribe and suppression respected;
- dedupe and cooldown deterministic;
- quiet hours and daily limits tested;
- content sanitized;
- delivery retries bounded;
- failed delivery cannot block prediction ingestion;
- tokens and chat identifiers redacted from logs.

### 3.7 Solana and proof verification

- proof states remain distinct: unavailable, available, structurally valid, on-chain verified;
- structural validation works offline;
- network calls bounded by timeout/retry/concurrency;
- cluster and program IDs explicit;
- wallet use operator-only;
- no transaction unless separately approved;
- prediction itself never labeled on-chain verified merely because source data proof passes.

## 4. Defect policy

- P0: data corruption, credential exposure, unauthorized production mutation, or critical outage. Stop program immediately.
- P1: security boundary bypass, public private-data leak, deterministic integrity failure, or major unavailable core path. Stop advancement.
- P2: important functional defect with workaround. Must be resolved before the affected milestone release.
- P3: minor defect or polish issue. May be deferred with owner and target phase.

No defect may be reclassified merely to pass a gate.

## 5. Flaky-test policy

- retry at most once to identify flakiness;
- record both attempts;
- quarantine only through an explicit governance change with owner and deadline;
- do not remove or skip the test inside an unrelated phase;
- repeated flakiness blocks release-critical gates.

## 6. Exception policy

A quality exception must include:

- exact gate being waived;
- reason;
- risk assessment;
- compensating control;
- owner;
- expiration date or closing phase;
- explicit human approval.

Codex must never create or approve its own exception.
