# MatchPulse Continuous Competition Product Goal

Operate from the current clean program repository root. Never use a hardcoded stale checkout.

Continuously synchronize `main` by safe fast-forward, execute the repository-selected active phase, validate and safely auto-publish eligible local-only phases, record completion, author and activate the next exact eligible pack through a separate scoped governance transition, and continue until `PROGRAM_COMPLETE`.

Use `COMPETITION_PRODUCT_SCOPE.md` as product scope, `COMPETITION_GATE_RESOLUTIONS.json` as technical-gate authority, and the listed order and dependency graph in `PROGRAM_PLAN.json` for deterministic selection. Exact allowlists, phase manifests, payload hashes, validation evidence, public redaction, secret safety, deterministic behavior, data integrity, and the no-gambling boundary remain mandatory.

Missing external credentials block live verification only. Complete configurable adapters with deterministic fixtures, local fakes, contract tests, disabled-by-default live access, and honest deferred evidence. Solana/on-chain verification is deferred and not required for program completion.

Automatic publication is limited to phases permitted by their exact manifests and every machine-readable safe-publication condition in `PROGRAM_PLAN.json`. Never access real external product services, install or use secrets, mutate shared or remote databases, deploy remotely, use paid resources, force push, or perform an irreversible remote action.

A migration may be created or applied only when the exact phase manifest allows it, only against repository-managed isolated local or ephemeral PostgreSQL 16, and only after schema validation, migration diff and test, data-integrity verification, and rollback or forward-fix instructions pass.

Stop only for repository drift or unresolvable conflict; a required remote or external action; shared or remote database mutation; a missing indispensable product contract not resolved by current authority; a secret requirement; a high or critical security defect; data-integrity risk; or an irreversible operation. Otherwise continue the program loop through completion.
