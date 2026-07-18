# FREE-ACCESS-SECURITY-B-v1

## Identity

- Phase: `FREE-ACCESS-SECURITY-B`
- Pack: `FREE-ACCESS-SECURITY-B-v1`
- Baseline: `b913afadb6610506d34e794b9d0f0c454f0606d1`
- Title: Production-grade Free Access security remediation
- Remediates: `FREE-ACCESS-SECURITY-A-v4`, completion commit `b913afadb6610506d34e794b9d0f0c454f0606d1`

This is a governance pack for fix-forward remediation after the formal post-publish review rejected A. It is self-contained and does not depend on an earlier pull request or local worktree.

## Safety gate

`allows_migration=false` and `allows_network=false` are fail-closed. Source schema and SQL edits are allowed in the implementation phase, but migration application, database connection/write, registry or application network, production/Railway access, deployment, and secrets remain forbidden. No new dependency is authorized.

## Scope

The 40 implementation targets preserve the A allowlist and add `apps/api/src/public-api.test.ts`. The pack does not authorize editing `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, the pack, or the review/architecture documents during implementation. Completion metadata is the only global exception.

## Gate

Every target must be mapped to the payload, and every required route, wallet, session, persistence, BFF, limits, CORS, redaction, and compatibility contract must have executable evidence. Test counts are intentionally not fixed. Completion requires `migration_applied=false`, `database_connected=false`, `registry_accessed=false`, `network_accessed=false`, `deployment_performed=false`, and `production_acceptance=false`.
