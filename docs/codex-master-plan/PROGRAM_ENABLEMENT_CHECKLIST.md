# MatchPulse Program Mode Enablement Checklist

Program mode must remain disabled until this checklist is reviewed against an exact commit.

## 1. Governance readiness

- [ ] `PROGRAM_GOAL.md` approved.
- [ ] `AUTONOMOUS_EXECUTION_CONTRACT.md` approved.
- [ ] `PROGRAM_PLAN.json` schema-valid and dependency graph reviewed.
- [ ] `PROGRAM_DECISIONS_RESOLVED.json` schema-valid and reviewed.
- [ ] `PROGRAM_DECISION_RECORD_2026-07-11.md` reviewed.
- [ ] `PROGRAM_BLOCKERS.json` schema-valid and reviewed.
- [ ] `HUMAN_INPUT_REGISTRY.json` reviewed.
- [ ] `QUALITY_GATE_MATRIX.md` approved.
- [ ] `TEST_AND_RELEASE_STRATEGY.md` approved.
- [ ] `RISK_SECURITY_OPERATIONS.md` approved.
- [ ] `PHASE_PACK_AUTHORING_STANDARD.md` approved.
- [ ] `CODEX_END_TO_END_GOAL_PROMPT.md` approved.
- [ ] Existing `AGENTS.md`, `CODEX_ENTRYPOINT.md`, and `EXECUTION_PROTOCOL.md` are updated in a separate governance phase to recognize program mode without weakening safety.
- [ ] Program state, decision, blocker, phase-evidence, and gate-evidence schemas are implemented and tested.
- [ ] Branch protection and publication method are confirmed.

## 2. Schema and graph validation

Before enablement, repository validation must prove:

- every program JSON file parses successfully;
- unknown unsafe fields and states are rejected;
- every phase, dependency, gate, blocker, and input reference resolves;
- plan overrides reference existing phases and do not create a cycle;
- deferred or non-applicable phases are explicit;
- every applicable phase has risk, autonomy, acceptance, validation, rollback, and evidence requirements;
- no secret value appears in program files.

## 3. Autonomy choice

Record one:

```yaml
autonomy_mode: conservative | balanced | aggressive_gated
```

### Conservative

- Codex implements and prepares phases.
- Every publication requires human review.
- All A3/A4 actions require separate approval.

### Balanced

- Codex may auto-publish R0/R1 phases only after complete evidence and branch CI success.
- R2-R4 stop for human review.
- All A3/A4 actions require separate approval.

### Aggressive gated

- Codex may auto-publish R0-R2 only when the phase manifest explicitly permits it and all evidence passes.
- R3/R4 always stop for human review.
- No migration, real network, secret use, paid account, compliance approval, production mutation, or release is ever self-approved.

The current proposal selects `aggressive_gated`, but initial enablement should keep `auto_publish_risk_classes` empty until expanded CI and at least two low-risk phases complete successfully.

## 4. Repository readiness

- [ ] Current active phase is completed or explicitly incorporated into the transition.
- [ ] Draft architecture/source PRs are reviewed and their role recorded.
- [ ] No conflicting uncommitted local work exists in program-controlled files.
- [ ] Main is protected from force pushes.
- [ ] Required CI checks are configured as branch protection where available.
- [ ] CI expands beyond typecheck-only before auto-publication.
- [ ] Secret, dependency, license, SAST, and container scanning are enabled where applicable.
- [ ] Test artifacts and phase evidence have a durable location.

## 5. Required CI before auto-publication

At minimum:

1. lockfile-enforced dependency installation;
2. Prisma generation without unauthorized migration;
3. repository typecheck;
4. affected package builds;
5. focused unit and invariant tests;
6. affected contract and integration tests;
7. full API regression when applicable;
8. public leakage and forbidden-field scans;
9. secret, dependency, and license scans;
10. container build and scan for deployment phases;
11. `git diff --check`;
12. migration diff and manifest-flag verification;
13. machine-readable evidence artifact upload.

## 6. Program-state requirements

Before enabling, implement a machine-readable state file containing:

- program ID and governing commit;
- decision and blocker file hashes;
- enabled flag and autonomy mode;
- current phase;
- completed, deferred, blocked, and non-applicable phases;
- blocker codes and required responses;
- approved gates with approver, timestamp, scope, commit, and environment;
- resolved human input IDs;
- active resource locks;
- last validation and publication evidence;
- final completion status.

State transitions must be schema-validated and committed atomically.

## 7. Resolved-decision review

Explicitly accept or amend:

- Week 28 production plan and budget envelopes;
- priority and conditional competitions;
- public API exposed and forbidden fields;
- database topology and migration authority;
- documented TxLINE test/production hosts and secret-variable names;
- private inference boundary and fallback semantics;
- provisional prediction-quality gates;
- notification limits and privacy behavior;
- Solana deferral and prediction-market prohibition;
- cloud-candidate status and compliance gate;
- age-16 v1 policy and retention;
- final release roles and blockers.

A provisional provider, domain, mailbox, owner, environment, or secret location is never considered confirmed solely because it appears in a decision file.

## 8. Hard-gate owners

Assign named accountable parties for:

- Backend Lead
- ML Lead
- DevOps Lead
- QA Lead
- Security Owner
- Privacy Owner
- Product Owner
- Legal/Compliance Counsel
- Release Approver
- Rollback Owner
- On-call Owner

Role placeholders permit architecture work but not staging mutation, public beta, production deployment, or release.

## 9. Compliance and provider gate

Before real provider data, paid cloud commitment, public beta, or production:

- qualified counsel reviews Iran-facing service eligibility and relevant sanctions/export controls;
- TxLINE terms, subscription/payment mechanics, public-display rights, retention, attribution, and quota are approved;
- cloud, DNS, messaging, error-tracking, and payment providers confirm account eligibility;
- EU privacy, child-consent, deletion, retention, and international-transfer design is approved;
- approval references are recorded without secret values or confidential legal advice in public Git.

## 10. Low-risk startup path

1. Finish and publish 10F-C under current Automation v2 governance.
2. Review and merge the architecture/program specification.
3. Add program-mode governance while keeping it disabled.
4. Add schema validators and expanded CI.
5. Run a no-write program selection dry run.
6. Enable the approved autonomy mode at an exact commit.
7. Execute applicable R1 foundations first: 10G-A, 10G-B, 10H-A, 10H-B, and 10N-A.
8. Prepare 10H-C using mock/private-policy boundaries.
9. Continue until the first exact database, provider, public-contract, privacy, or deployment gate.

Phase 10N-B is deferred and is not a v1 completion dependency unless a later separately approved decision changes applicability.

## 11. Dry-run requirement

Before enablement, a no-write dry run must:

- read all authority, decision, registry, and blocker files;
- validate JSON and the applicable dependency graph;
- identify the current active phase;
- compute the next five eligible applicable phases;
- report gates and blockers for each;
- perform no branch, file, commit, push, network, migration, secret, account, or deployment mutation.

## 12. Enablement record

```json
{
  "program_id": "matchpulse-production-completion-v1",
  "governing_commit": "<exact sha>",
  "decision_file_sha256": "<sha256>",
  "blocker_file_sha256": "<sha256>",
  "enabled": true,
  "autonomy_mode": "aggressive_gated",
  "auto_publish_risk_classes": [],
  "approved_by": "<human identity or approved role>",
  "approved_at_utc": "<UTC ISO timestamp>",
  "maximum_parallel_phases": 1,
  "migration_self_approval": false,
  "real_network_self_approval": false,
  "paid_account_self_approval": false,
  "compliance_self_approval": false,
  "production_self_approval": false,
  "release_self_approval": false
}
```

## 13. Mandatory stop guarantees

Regardless of autonomy mode, Codex stops before:

- the first unresolved blocker required by the next phase;
- shared or production migration without exact approval;
- real external-service access without exact approval;
- secret installation or rotation;
- public-contract breaking change without approval;
- paid account or provider commitment;
- public beta with unapproved provider/legal posture;
- production deployment;
- final release;
- any introduced high/critical security issue;
- suspected data corruption, credential exposure, or public internal-data leak.

## 14. Enablement Definition of Done

Program mode is ready only when:

- governance recognizes it;
- program JSON and state transitions are machine-validated;
- future phase packs follow the authoring standard;
- CI enforces the chosen publication gate;
- branch and environment protections exist;
- safe stop behavior is tested;
- a dry-run selection succeeds without mutation;
- an A1 phase completes end-to-end in a non-production environment;
- human reviewers approve the resulting evidence.
