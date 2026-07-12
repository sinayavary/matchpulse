# MatchPulse Permanent Codex Entrypoint — Automation v2

Operate from the current clean program repository root; never hardcode or switch to a stale checkout.

Read `AGENTS.md`, `EXECUTION_PROTOCOL.md`, `COMPETITION_PRODUCT_SCOPE.md`, `COMPETITION_GATE_RESOLUTIONS.json`, `PROGRAM_PLAN.json`, `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, and the referenced pack.

## Phase mode

When program mode is disabled, Automation v2 validates and executes only `ACTIVE_PHASE.json`. Exact pack identity, hashes, allowlists, validation commands, and expected results remain mandatory. After validation, update permitted completion metadata and Prepare one scoped commit. Publish still requires explicit human instruction. Never activate a successor during phase execution.

## Enabled program mode

When `PROGRAM_PLAN.json` enables program mode:

1. Synchronize `main` by fetch and fast-forward only and verify a clean, collision-free state.
2. Validate and execute the ready active phase exactly as packed.
3. Run every required check and Prepare a scoped completion commit.
4. Publish automatically only if the active manifest permits it and every `safe_auto_publication_policy` condition passes.
5. Fetch and verify the remote publication.
6. In a separate governance transition, record completion and activate the first eligible phase in listed plan order.
7. If its exact pack is missing, author it only from the program-authorized sources and with the complete pack contract.
8. Continue until `PROGRAM_COMPLETE` or a genuine blocker defined by `AGENTS.md`.

Migration work is allowed only when explicitly declared by the manifest, isolated to local or ephemeral PostgreSQL 16, and all migration safety checks pass. External live verification, remote mutation, secrets, deployments, paid resources, irreversible operations, and force pushes remain forbidden.
