# MatchPulse Program Mode Enablement Checklist

Program mode must remain disabled until this checklist is reviewed against an exact commit.

## 1. Governance readiness

- [ ] `PROGRAM_GOAL.md` approved.
- [ ] `AUTONOMOUS_EXECUTION_CONTRACT.md` approved.
- [ ] `PROGRAM_PLAN.json` schema-valid and dependency graph reviewed.
- [ ] `HUMAN_INPUT_REGISTRY.json` reviewed.
- [ ] `QUALITY_GATE_MATRIX.md` approved.
- [ ] `TEST_AND_RELEASE_STRATEGY.md` approved.
- [ ] `RISK_SECURITY_OPERATIONS.md` approved.
- [ ] `PHASE_PACK_AUTHORING_STANDARD.md` approved.
- [ ] `CODEX_END_TO_END_GOAL_PROMPT.md` approved.
- [ ] Existing `AGENTS.md`, `CODEX_ENTRYPOINT.md`, and `EXECUTION_PROTOCOL.md` are updated in a separate governance phase to recognize program mode without weakening safety.
- [ ] Program state and evidence schemas are implemented and tested.
- [ ] Branch protection and publication method are confirmed.

## 2. Autonomy choice

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
- No migration, real network, secret use, production mutation, or release is ever self-approved.

## 3. Repository readiness

- [ ] Current active phase is completed or explicitly incorporated into program-mode transition.
- [ ] Open draft source/architecture PRs are reviewed and their role is recorded.
- [ ] No conflicting uncommitted local work exists in program-controlled files.
- [ ] Main is protected from force pushes.
- [ ] Required CI checks are configured as branch protection where available.
- [ ] CI covers repository-wide typecheck and required tests; current typecheck-only workflow is expanded before auto-publication.
- [ ] Secret scanning is enabled.
- [ ] Dependency scanning is enabled or an approved alternative exists.
- [ ] Test artifacts and phase evidence have a durable location.

## 4. Program-state requirements

Before enabling, implement a machine-readable state file containing:

- program ID and governing commit;
- enabled flag and autonomy mode;
- current phase;
- completed phases;
- blocked phases and blocker codes;
- approved gates with approver, timestamp, scope and exact commit/environment;
- resolved human input IDs;
- active resource locks;
- last successful validation/publish evidence;
- final completion status.

State transitions must be schema-validated and committed atomically with their governing change.

## 5. Low-risk startup path

Recommended first program-mode sequence:

1. Finish and publish 10F-C under current Automation v2 governance.
2. Merge the reviewed architecture/program specification.
3. Add governance support for program mode while keeping it disabled.
4. Expand CI beyond typecheck to focused and repository-wide test evidence.
5. Enable conservative or balanced program mode at an exact commit.
6. Execute R1 phases first: 10G-A, 10G-B, 10H-A, 10H-B, 10N-A.
7. Prepare 10H-C with mock/private-policy boundary.
8. Stop at the first database/public/network gate requiring unresolved human input.

## 6. Required human inputs before uninterrupted database-to-release execution

At minimum resolve:

- supported competitions and languages;
- brand/UX direction;
- public API policy;
- development and staging database details;
- migration authority;
- TxLINE real environment scope and credential variable names;
- private model policy adapter and quality targets;
- Telegram policy/environment if notifications are included;
- Solana environment if on-chain verification is included;
- hosting, DNS, TLS, secret store and observability stack;
- security/privacy requirements;
- release mode and approval policy.

Secret values must remain outside Git and chat.

## 7. Enablement record

Use an exact reviewed commit and explicit statement:

```yaml
program_enablement:
  program_id: matchpulse-production-completion-v1
  governing_commit: ""
  enabled: true
  autonomy_mode: conservative | balanced | aggressive_gated
  auto_publish_risk_classes: []
  approved_by: ""
  approved_at_utc: ""
  scope: repository_only
  migration_self_approval: false
  real_network_self_approval: false
  production_self_approval: false
  release_self_approval: false
  notes: ""
```

## 8. Mandatory stop guarantees

Regardless of autonomy mode, Codex must stop before:

- first unresolved required human input;
- migration creation/application without exact approval;
- real external-service access without exact approval;
- secret installation or rotation;
- public-contract breaking change without approval;
- production deployment;
- final release;
- any high/critical security issue;
- suspected data corruption, credential exposure or public internal-data leak.

## 9. Enablement Definition of Done

Program mode is ready only when:

- governance recognizes it;
- state transitions are machine-validated;
- future phase packs follow the authoring standard;
- CI enforces the chosen auto-publication gate;
- branch and environment protections exist;
- safe stop behavior is tested;
- a dry-run selection of the next phase succeeds without modifying files;
- an A1 test phase completes end-to-end in a non-production environment;
- human reviewers approve the resulting evidence.
