# MatchPulse Phase Pack Authoring Standard

Every future phase must be executable from repository evidence alone. A prose description without an exact manifest, acceptance criteria, validation plan, and stop policy is not an executable phase.

## 1. Required directory structure

```text
docs/codex-master-plan/phases/<phase-id>/
├── README.md
├── manifest.json
├── EXPECTED_SHA256.json              # required when payload exists
├── acceptance-criteria.json
├── validation-plan.json
├── rollback-plan.md
├── evidence-template.json
└── payload/                          # preferred for deterministic exact changes
    └── <repository target paths>
```

Optional files:

```text
├── architecture.md
├── threat-model-delta.md
├── migration-plan.md
├── public-contract-diff.md
├── test-fixtures/
└── adr/
```

## 2. Required manifest fields

`manifest.json` must include:

```json
{
  "schema_version": "matchpulse-phase-manifest-v2",
  "phase_id": "",
  "title": "",
  "pack_version": "",
  "program_id": "matchpulse-production-completion-v1",
  "baseline_commit": "",
  "dependencies": [],
  "risk_class": "R0|R1|R2|R3|R4",
  "autonomy_level": "A0|A1|A2|A3|A4",
  "required_gate_ids": [],
  "required_input_ids": [],
  "allowed_target_files": [],
  "forbidden_target_patterns": [],
  "payload_mode": "exact|implementation_spec",
  "required_commands": [],
  "expected_outcomes": [],
  "migration": {
    "schema_change": false,
    "create_allowed": false,
    "apply_development_allowed": false,
    "apply_staging_allowed": false,
    "apply_production_allowed": false,
    "backup_required": false,
    "rollback_required": false
  },
  "network": {
    "allowed": false,
    "allowed_hosts": [],
    "allowed_environments": [],
    "credential_variable_names": [],
    "timeout_ms": 0,
    "max_attempts": 0,
    "max_concurrency": 0
  },
  "public_contract": {
    "changes": false,
    "version": null,
    "approval_required": false
  },
  "security": {
    "threat_model_delta_required": false,
    "secret_scan_required": true,
    "public_leakage_scan_required": true,
    "dependency_scan_required": false,
    "container_scan_required": false
  },
  "git": {
    "commit_allowed": true,
    "publish_allowed": false,
    "auto_publish_allowed": false,
    "exact_commit_message": "",
    "merge_method": "repository_default"
  },
  "completion": {
    "stop_after_prepare": true,
    "success_code": "PHASE_COMPLETE_PREPARED",
    "blocker_codes": []
  }
}
```

All arrays that affect identity or evidence must use deterministic sorted order.

## 3. Acceptance criteria

`acceptance-criteria.json` must contain atomic, testable criteria. Each criterion requires:

```json
{
  "id": "AC-001",
  "requirement": "",
  "verification_type": "test|typecheck|build|scan|diff|manual_gate|runtime_probe",
  "verification_reference": "",
  "required": true,
  "security_relevant": false,
  "public_contract_relevant": false,
  "data_integrity_relevant": false
}
```

Requirements must avoid vague terms such as “robust”, “good”, “complete”, or “production-ready” unless measurable conditions follow.

## 4. Validation plan

`validation-plan.json` must list commands in execution order:

```json
{
  "steps": [
    {
      "id": "VAL-001",
      "command": "",
      "working_directory": "",
      "environment": "offline_ci|local_mock|development|staging|production",
      "timeout_seconds": 0,
      "expected_exit_code": 0,
      "expected_test_count_minimum": null,
      "network_expected": false,
      "database_mutation_expected": false,
      "artifact_paths": [],
      "required": true
    }
  ]
}
```

Commands must not hide failure using shell constructs that force success.

## 5. Exact payload rules

Prefer exact payload when architecture and code are already reviewed.

- Payload path mirrors repository target path.
- Every payload file has SHA-256 in `EXPECTED_SHA256.json`.
- Target and payload blobs must match exactly after application.
- Codex verifies hashes before copying and after applying.
- Payload must not include generated credentials, local environment files, provider payloads, database dumps, build output, dependency directories, or private policy values.

When `implementation_spec` is used instead:

- README must define interfaces, invariants, errors, concurrency, time semantics, degraded behavior, security boundary, test cases, and non-goals;
- Codex may choose reversible internal details but may not change declared contracts or scope.

## 6. README requirements

README must include:

- objective;
- current problem and reason for the phase;
- dependencies and gates;
- architecture boundaries;
- exact in-scope and out-of-scope behavior;
- public/private data classification;
- input/output contracts;
- state machines where applicable;
- time, retry, concurrency, idempotency, ordering and error semantics;
- migration/network/secret behavior;
- step-by-step implementation instructions;
- test matrix;
- acceptance criteria mapping;
- rollback/degraded behavior;
- stop conditions.

## 7. Test-case minimums

Every implementation phase must include tests for:

- happy path;
- each validation boundary;
- missing/degraded dependency;
- deterministic repeated execution;
- input immutability where relevant;
- ordering and duplicate behavior where relevant;
- retry/concurrency/cancellation bounds where relevant;
- error redaction;
- forbidden public fields where relevant;
- migration rollback or no-migration diff where relevant.

## 8. Evidence template

`evidence-template.json` must reserve:

```json
{
  "phase_id": "",
  "pack_version": "",
  "baseline_commit": "",
  "prepared_commit": null,
  "published_commit": null,
  "changed_files": [],
  "payload_hashes_verified": false,
  "validations": [],
  "migration": {
    "created": false,
    "applied_environments": [],
    "identifiers": [],
    "backup_evidence": null,
    "rollback_evidence": null
  },
  "network": {
    "accessed": false,
    "hosts": [],
    "environments": []
  },
  "public_contract_versions": [],
  "security_findings": [],
  "known_limitations": [],
  "completed_at_utc": null
}
```

## 9. Rollback plan

Every phase needs a rollback plan, even when rollback is “revert the isolated commit”.

For migration or environment phases it must include:

- preconditions;
- backup reference;
- exact rollback/forward-fix decision;
- commands or runbook references;
- data-loss risk;
- verification after rollback;
- owner and authorization requirement.

## 10. Review checklist

Before a phase can become `ready`:

- dependency IDs exist;
- baseline is reachable from current main;
- all target files are exact and minimal;
- payload hashes pass;
- acceptance criteria map to validation steps;
- risk/autonomy classification is correct;
- required human inputs and gates are declared;
- migration and network defaults are deny;
- public/private boundary is explicit;
- rollback and blocker codes exist;
- commit and publish policy are explicit;
- no successor activation is embedded in implementation payload;
- no secret or private policy value exists in the pack.
