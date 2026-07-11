# Phase 10F-C v1 — TxLINE Client Lifecycle and Regression Closure

## Review status

This is a review-only prepared phase pack. It is not active and must not change
`ACTIVE_PHASE.json` or `PHASE_QUEUE.json` until explicit human approval.

- Baseline candidate: `c1b2461ec42db2af1d93bfb5af7dcdb714bb2c7e`
- Source branch: `agent/source-10f-c`
- Source commit: `922806d4290bd2ca86468d436d330d713202a444`
- Draft PR: `#8`
- Pack: `10F-C-v1`

## Objective

Close the backend-only TxLINE client with bounded retry, one 401 JWT refresh, validation, and safe stream opening.

## Allowed targets

Only the paths declared in `manifest.json`.

## Exact implementation

Copy every file under `payload/` to the matching repository path exactly.
Do not redesign formulas, contracts, retry policy, thresholds, safety boundaries,
or phase order.

## Validation

Run every command declared in `manifest.json`, then verify `git status --short`.
Expected: no migration, no real provider/database/Solana network access, no
unauthorized file, no successor activation, and unrelated local work unchanged.

## Completion

After explicit repository-controlled activation and all gates passing, update only
permitted completion metadata and run Automation v2 `Prepare`. Stop before
`Publish`.
