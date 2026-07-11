# MatchPulse Risk, Security and Operations Requirements

## 1. Primary assets

- TxLINE credentials and operator wallet material;
- Telegram bot credentials and chat identifiers;
- database credentials, backups and canonical timeline data;
- private model policy, calibration artifacts and provider-quality policy;
- source code, CI identities, container registry and deployment credentials;
- public API availability and integrity;
- prediction, feature, label and evaluation version lineage;
- user watchlists and notification preferences when enabled.

## 2. Trust boundaries

1. Browser/user to public web/API.
2. Public API to internal application services.
3. Internal services to database/cache.
4. Internal services to TxLINE.
5. Internal services to private inference policy.
6. Internal services to Telegram.
7. Internal services to Solana RPC and operator authority.
8. CI/CD to registry, staging and production.
9. Observability pipeline receiving logs, metrics, traces and errors.

Every boundary must validate identity, input, timeout, retry, payload size, output shape, and redaction.

## 3. Threat categories and controls

### Credential exposure

Controls:

- managed secret store or local environment only;
- no secret values in Git, issues, PRs, test fixtures, logs, traces or error responses;
- secret scanning in CI;
- variable-name-only documentation;
- least privilege and environment separation;
- rotation procedure and owner;
- redact authorization headers, wallet material, tokens, cookies, query credentials and chat IDs.

### Provider abuse and SSRF

Controls:

- allowlisted origins and same-host SSE enforcement;
- no caller-controlled arbitrary URL fetch;
- bounded timeout, retry, response size and concurrency;
- TLS verification;
- redirect policy explicit;
- parse and validate before persistence;
- provider outage and quota degraded modes.

### Data poisoning and ordering attacks

Controls:

- canonical validation;
- fixture and event identity checks;
- timestamp and sequence monotonicity policy;
- duplicate detection;
- gap detection and catch-up;
- anomaly/quarantine state;
- immutable raw audit reference only when explicitly approved, otherwise content hashes and normalized evidence;
- replay comparison.

### Public internal-data leakage

Controls:

- explicit public mapper;
- denylist and allowlist tests;
- recursive scans for provider, weight, feature, policy, proof and debug fields;
- versioned schemas;
- no direct serialization of internal domain objects;
- safe error contracts;
- snapshot tests for all public endpoints and messages.

### Prediction integrity failure

Controls:

- finite and normalized probability checks;
- deterministic canonical ordering;
- versioned features/models/policies/calibration;
- market contribution cap;
- explicit fallback and degraded behavior;
- no future-data leakage;
- replay and evaluation gates;
- distinguish confidence, data quality, risk and verification.

### Unauthorized data or production mutation

Controls:

- environment-specific identities;
- explicit A3/A4 gates;
- migration allowlist and backup requirement;
- exact approved commit SHA;
- protected branches/environments;
- no force push;
- dry run and diff verification;
- audit trail and post-change checks.

### Denial of service and resource exhaustion

Controls:

- route rate limits and body limits;
- bounded provider calls and reconnects;
- bounded fixture concurrency and queues;
- notification cooldown/daily limits;
- pagination and batch limits;
- circuit breaker or degraded mode when justified;
- capacity metrics and alerts;
- load and soak testing.

## 4. Data classification

### Restricted

- credentials, private keys, wallet material, tokens;
- private model coefficients, weights, thresholds and calibration artifacts;
- provider-specific quality policy;
- security findings before remediation.

### Confidential

- internal feature references and hashes;
- provider identity and normalized diagnostics not intended for public exposure;
- user watchlist and notification preferences;
- internal operational metrics and detailed lineage.

### Internal

- canonical normalized match state;
- prediction snapshots before public mapping;
- evaluation and replay reports;
- phase evidence and non-secret configuration.

### Public

- approved public API fields;
- sanitized probabilities and explanations;
- freshness/data-quality/verification labels;
- public documentation and limitations.

## 5. Logging and observability policy

Structured logs must include where relevant:

- timestamp UTC;
- environment;
- service and version;
- stable event code;
- request/correlation ID;
- fixture ID when safe;
- phase/worker operation;
- outcome and duration;
- retry count and classified failure;
- dependency name and safe status;
- degraded-mode state.

Logs must exclude:

- credentials and authorization headers;
- raw provider payloads by default;
- private model input/output details beyond approved summaries;
- assigned weights, coefficients and thresholds;
- proof blobs;
- user-sensitive identifiers unless hashed or otherwise approved;
- stack traces in public responses.

## 6. Proposed SLO framework

Exact numeric targets require `hosting_and_deployment`, provider quota and product-scale inputs. Until resolved, use these as design objectives, not release claims:

- public API monthly availability objective: 99.9%;
- critical ingestion worker availability objective: 99.9%;
- public API p95 latency objective: <= 500 ms for cached/read paths;
- public API p99 latency objective: <= 1500 ms;
- canonical live-state freshness objective: provider-dependent and explicitly measured;
- no silent event loss objective: 100%; gaps must be detected, recovered or surfaced;
- duplicate canonical persistence objective: 0 accepted duplicates under idempotency key;
- prediction determinism objective: 100% for equivalent canonical input and versions;
- public forbidden-field leakage objective: 0;
- credential leakage objective: 0;
- notification duplicate objective: 0 within declared dedupe window.

Release must not advertise an SLO until staging evidence and environment capacity support it.

## 7. Required metrics

- provider request count, latency, error class, retries and quota state;
- SSE connection state, reconnect count, heartbeat age and gap count;
- accepted, duplicate, stale, invalid and quarantined events;
- checkpoint lag and catch-up duration;
- database operation latency, errors, pool saturation and transaction retries;
- prediction trigger, success, degraded, failure and cancellation counts;
- prediction freshness, coverage, confidence and risk distributions;
- public API latency, status, rate-limit and cache metrics;
- notification queued, sent, suppressed, deduplicated and failed counts;
- proof availability, structural validity and on-chain verification counts;
- worker queue depth, age and concurrency;
- deployment version and environment health.

Metrics labels must avoid unbounded cardinality.

## 8. Alerts

P0/P1 alerts:

- credential exposure or secret-scan hit;
- public private-field leak;
- canonical corruption or unexplained event loss;
- migration failure with uncertain state;
- production unavailable core path;
- sustained ingestion freshness breach;
- unauthorized network or wallet activity;
- high/critical security finding in a release artifact.

Operational alerts:

- provider error/retry/quota threshold;
- reconnect storm or heartbeat timeout rate;
- database saturation;
- queue age/depth threshold;
- public API error/latency threshold;
- notification failure threshold;
- backup failure;
- certificate or credential expiration warning.

## 9. Incident response

Every production incident record must contain:

- severity and start time;
- detection source;
- affected environment and versions;
- user/data impact;
- immediate containment;
- decision to rollback, disable, degrade or continue;
- evidence preserved without secrets;
- recovery time;
- root cause;
- corrective actions with owners and deadlines;
- test or monitoring added to prevent recurrence.

Codex may prepare incident analysis but must not fabricate production evidence.

## 10. Backup and recovery

Before any approved production migration:

- backup exists and is timestamped;
- restore procedure is documented;
- latest restore test evidence is within the approved age;
- recovery point and recovery time objectives are declared;
- rollback or forward-fix decision criteria are explicit;
- migration is idempotent or safely restartable where possible.

## 11. Risk register fields

Every material risk must record:

- ID and title;
- category;
- probability and impact;
- affected phases/assets;
- detection method;
- mitigation;
- fallback;
- owner;
- status;
- review date;
- evidence links.

## 12. Architecture decision records

Create an ADR for decisions affecting:

- database schema patterns;
- stream recovery semantics;
- public API versioning;
- private model policy hosting;
- authentication/authorization;
- notification architecture;
- Solana verification semantics;
- deployment platform and topology;
- observability stack;
- data retention and privacy.

Each ADR must include context, decision, alternatives, consequences, migration path and reversal plan.
