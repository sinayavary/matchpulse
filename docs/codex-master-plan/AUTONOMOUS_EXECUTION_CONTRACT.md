# MatchPulse Autonomous Execution Contract

> Review-only. Program mode remains disabled until a human explicitly approves and merges the governing changes.

## 1. Purpose

This contract defines how Codex may execute the MatchPulse program continuously while preserving software-engineering quality, repository safety, human control over irreversible actions, and auditable evidence.

## 2. Autonomy levels

### A0 — Analysis and documentation

Allowed without additional approval:

- inspect repository files and history;
- generate architecture, ADRs, phase packs, test plans, risk registers, and documentation;
- run read-only local analysis;
- propose reversible source changes in a branch.

### A1 — Reversible source implementation

Allowed when a phase is `ready`, dependencies pass, and the allowlist is exact:

- edit source, tests, fixtures, and documentation inside the phase allowlist;
- run offline typecheck, unit, contract, build, replay, and static-analysis commands;
- create a scoped commit;
- create or update a draft pull request when permitted by the phase.

Not allowed at A1:

- schema changes;
- real network access;
- production mutation;
- secret creation or rotation;
- public release.

### A2 — Controlled publication

Allowed only when program authorization explicitly permits auto-publish for the phase risk class:

- verify exact diff, parent SHA, test evidence, hashes, and branch protection;
- publish a fast-forward or reviewed pull-request merge using the repository-approved method;
- never force push;
- immediately verify the remote result;
- update machine-readable evidence.

A2 may be pre-authorized only for low-risk phases that have no migration, network, public-contract, security-boundary, or deployment change.

### A3 — Environment and data mutation

Always requires a recorded human gate:

- Prisma schema or migration creation/application;
- database backfill or irreversible data mutation;
- real provider, Telegram, Solana, cloud, DNS, or production access;
- paid-resource provisioning;
- secret installation or rotation.

Codex may prepare exact commands, dry runs, rollback plans, and verification steps before the gate. It must not execute the mutation until approval evidence exists.

### A4 — Production release

Always requires explicit release approval tied to an exact commit, environment, migration set, rollback plan, and smoke-test plan.

## 3. Continuous execution loop

When program mode is enabled, Codex must execute this loop:

1. **Synchronize**
   - fetch repository state;
   - verify current branch and remote ancestry;
   - inspect program state, active phase, human inputs, gates, locks, and prior evidence;
   - stop on repository drift or conflicting local work.

2. **Select**
   - compute eligible phases whose dependencies are completed;
   - exclude phases blocked by human input, hard gates, resource locks, or unresolved P0/P1 defects;
   - select the highest-priority deterministic phase according to `PROGRAM_PLAN.json`;
   - never invent an undeclared successor.

3. **Validate phase pack**
   - schema-validate manifest and state files;
   - verify baseline ancestry;
   - verify payload hashes;
   - verify exact target allowlist;
   - verify migration, network, publish, and autonomy flags;
   - verify no collision with unrelated local files.

4. **Implement**
   - apply exact payload when supplied;
   - otherwise implement only the manifest’s acceptance criteria inside the allowlist;
   - preserve architecture boundaries and public redaction rules;
   - use repository conventions and deterministic ordering;
   - avoid broad refactors unless the phase explicitly authorizes them.

5. **Validate implementation**
   - run focused tests first;
   - run package typecheck and build;
   - run dependent-package contract suites;
   - run repository-wide gates required by risk class;
   - run schema, migration, security, public-leakage, and deterministic-output checks when applicable;
   - record exact command, exit code, duration, and relevant counts.

6. **Repair**
   - classify each failure as phase-caused, pre-existing, environmental, flaky, or external;
   - repair only phase-caused failures inside the allowlist;
   - retry a flaky command at most once unless the phase defines another bound;
   - never suppress, skip, weaken, or delete tests to obtain a pass;
   - never broaden the allowlist silently.

7. **Prepare**
   - verify exact changed paths;
   - run whitespace and forbidden-field scans;
   - create one scoped commit with the exact message;
   - update evidence and phase completion state atomically;
   - verify the commit tree contains no unrelated paths.

8. **Publish or stop**
   - publish only if the phase and program authorization permit A2;
   - otherwise stop at the declared review gate with exact evidence;
   - after publication, verify remote SHA and CI status.

9. **Advance**
   - mark only the completed phase as completed;
   - activate only a successor declared by the program plan;
   - never skip dependencies;
   - continue the loop automatically.

10. **Finish**
    - report `PROGRAM_COMPLETE` only under the definition in `PROGRAM_GOAL.md`.

## 4. Engineering rules

### 4.1 Source design

- Prefer small cohesive modules with explicit types and dependency injection.
- Keep time, randomness, network, storage, and environment access injectable in testable domains.
- Use deterministic sorting and canonical serialization where identity or hashes depend on content.
- Preserve backwards compatibility unless a versioned breaking-change phase is approved.
- Validate all external input at the boundary.
- Return typed degraded/no-data states instead of fabricating data.
- Separate provider transport, normalization, canonical domain, private intelligence, public mapping, and presentation.

### 4.2 Error handling

- Use bounded retries with classified transient errors.
- Never retry validation, authorization, or deterministic contract failures.
- Preserve causal errors without leaking secrets.
- Include stable error codes for public or operational contracts.
- Fail closed at security and public-redaction boundaries.

### 4.3 Concurrency

- Bound concurrency explicitly.
- Use fixture-scoped serialization where ordering matters.
- Support cancellation for stale work.
- Avoid unbounded queues and detached promises.
- Test races, duplicate delivery, reconnect overlap, and shutdown behavior.

### 4.4 Data and time

- Store canonical UTC timestamps.
- Define source time, observed time, received time, generated time, and persisted time distinctly.
- Reject or quarantine impossible timestamp ordering.
- Use idempotency keys and unique constraints for persisted canonical events.
- Never train or evaluate with future information.

### 4.5 Probability and model boundaries

- Validate finite values and valid distributions.
- Enforce monotonic horizon invariants.
- Version features, models, policies, calibration, labels, and contracts.
- Keep private coefficients, thresholds, weights, and provider quality policies outside public Git and public responses.
- Record enough version references to reproduce a prediction without exposing private policy values.

## 5. Testing rules

Every phase must define applicable layers:

- unit tests;
- property/invariant tests;
- contract tests;
- integration tests;
- replay/determinism tests;
- migration tests;
- security and redaction tests;
- accessibility tests;
- load/soak/failure-injection tests;
- end-to-end smoke tests.

Codex must not claim a test passed unless it executed and produced evidence. Missing infrastructure must be reported as a blocker, not converted into a pass.

## 6. Git and repository safety

Forbidden:

- `git add .` or `git add -A`;
- reset, clean, stash, rebase, or force push;
- broad formatting unrelated to the phase;
- modifying unlisted files;
- deleting tests or weakening gates without an explicit governance phase;
- rewriting published history;
- committing secrets, local environment values, generated credentials, or provider payloads.

Required:

- stage exact paths only;
- verify `git diff --check`;
- verify exact changed filenames before commit and before publish;
- preserve unrelated user work;
- record baseline, parent, prepared, published, and remote SHAs.

## 7. Stop conditions

Codex must stop with a structured blocker when any condition occurs:

- missing required human input;
- hard gate not approved;
- baseline or payload hash mismatch;
- unexpected file collision;
- required test fails outside the allowlist and cannot be proven pre-existing;
- migration or network action is needed but not permitted;
- secret or credential is absent;
- public contract is ambiguous;
- security finding is high or critical;
- production state differs from the approved release plan;
- repository rule conflicts with the program plan.

The blocker report must contain:

- stop code;
- phase ID;
- exact command or decision that blocked;
- evidence;
- required human response schema;
- safe resume instruction.

## 8. Evidence model

Each completed phase must record:

- phase and pack versions;
- baseline and final commit SHAs;
- exact changed files;
- payload hashes;
- test commands, exit codes, counts, and durations;
- migrations created/applied;
- networks accessed;
- secrets referenced by name only;
- public contracts changed;
- security findings and disposition;
- rollback reference;
- known limitations;
- publication and CI verification.
