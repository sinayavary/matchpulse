# MatchPulse Codex Execution Rules

## Authority and operating modes

Permanent safety rules in this file outrank all other sources. Then read `CODEX_ENTRYPOINT.md`, `EXECUTION_PROTOCOL.md`, `COMPETITION_PRODUCT_SCOPE.md`, `COMPETITION_GATE_RESOLUTIONS.json`, `ACTIVE_PHASE.json`, `PROGRAM_PLAN.json`, the active manifest, and the remaining canonical sources required by the pack.

MatchPulse has two repository-authorized modes:

- **Phase mode:** Automation v2 executes only `ACTIVE_PHASE.json`. An exact manifest, target allowlist, acceptance criteria, validation commands, and expected results are mandatory. Phase execution never activates its successor.
- **Enabled program mode:** when `PROGRAM_PLAN.json` has `program_mode.enabled: true`, Codex continuously completes the active phase and then selects the first listed eligible phase whose dependencies are completed and technical gates are resolved. A separate scoped program-transition commit records queue completion and activates the successor, and only after the phase publication is remotely verified.

In enabled program mode Codex may author a missing exact phase pack from `COMPETITION_PRODUCT_SCOPE.md`, `COMPETITION_GATE_RESOLUTIONS.json`, `PROGRAM_PLAN.json`, `MATCHPULSE_COMPLETION_BLUEPRINT.md`, `QUALITY_GATE_MATRIX.md`, `TEST_AND_RELEASE_STRATEGY.md`, and existing architecture and tests. Each generated pack must declare exact targets, acceptance criteria, validation commands and expected results, rollback or degraded behavior, payload hashes when applicable, and migration and network declarations. Codex may choose reversible implementation details, but may not weaken public/internal redaction, secret safety, data integrity, determinism, no-gambling rules, or remote-action restrictions.

## Execution and publication

Before edits, verify status and ancestry, read the active pack completely, confirm the exact allowlist, verify hashes, run Automation v2 Validate, and stop on an allowed-file collision. Continue an authorized phase through its required validation and correction cycles without routine confirmation.

Prepare may stage only changed active allowlist paths plus permitted completion metadata and create one scoped commit. Program-mode Publish is automatic only when the manifest permits it and every machine-readable condition in `PROGRAM_PLAN.json` passes, including unchanged `origin/main` and non-force fast-forward safety. Phase mode still requires explicit human Publish authorization.

After verified publication, enabled program mode may create a separate governance-only transition commit that updates completion metadata and activates the deterministic successor. Phase execution itself must never activate a successor.

Never use reset, clean, stash, rebase, force push, broad formatting, `git add .`, or `git add -A`. Preserve unrelated work. Do not broaden an allowlist, weaken tests, or claim unrun checks.

## Permanent safety boundaries

No authority in this repository permits real TxLINE, Telegram, Solana, cloud, hosted database, or other external product-service access; secret installation, reading, exposure, or rotation; shared or remote database mutation; remote deployment; paid resources; irreversible remote actions; or force push.

A manifest may allow a migration only against repository-managed isolated local or ephemeral PostgreSQL 16 and only after schema validation, migration diff, migration test, data-integrity verification, and rollback or forward-fix instructions pass. This never permits shared, hosted, staging, or production database mutation.

MatchPulse is informational sports intelligence. Never implement betting, wagering, stakes, payouts, profit, expected value, prediction markets, trading, gambling UI, prediction-linked rewards, or ordinary-user wallet requirements. Never expose raw provider payloads, credentials, provider identity, private weights, coefficients, thresholds, proof blobs, debug lineage, hidden reasoning, or secret-safe internal details publicly.

Stop only for repository drift or unresolvable conflict, a required remote/external action, shared or remote database mutation, a secret requirement, an indispensable unresolved product contract, a high/critical security defect, data-integrity risk, or an irreversible operation. Use the applicable explicit evidence-backed stop code from `EXECUTION_PROTOCOL.md`.
