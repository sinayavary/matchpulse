# Phase 10H-A v1 — Prediction Composition Engine

## Review status

This is a review-only prepared source pack. It is not active and must not modify `ACTIVE_PHASE.json` or `PHASE_QUEUE.json` until a separate governance change explicitly approves and activates it.

- Baseline candidate: `b4f1bf28e3ad05d4c796ac52a1383cd918182842`
- Source branch: `agent/matchpulse-continuation-blueprint-v1`
- Pack: `10H-A-v1`
- Dependency: Phase 10E-C complete; execution should occur after current Phase 10F-C is completed and published.

## Objective

Implement the deterministic internal prediction composition boundary while keeping proprietary specialist formulas, coefficients, confidence policy, and provider weights outside the public repository.

## Allowed targets

Only the paths declared in `manifest.json`.

## Exact implementation

Copy every file under `payload/` to the matching repository path exactly. Do not redesign composition rules, weight validation, odds cap enforcement, fallback behavior, scoreline merge, public safety boundaries, or phase order.

## Required invariants

- available specialist weights sum to exactly one
- unavailable specialists have zero weight and no output
- market specialist weight does not exceed the approved odds-intelligence cap
- missing target outputs use the explicit complete fallback
- snapshot identity is deterministic
- goal-horizon output is monotonic
- scoreline distribution remains normalized after truncation
- no caller-owned input mutation
- no private model coefficients are committed
- no route, worker, frontend, Prisma, migration, persistence, or network changes

## Validation

Run every command declared in `manifest.json`, then verify `git status --short`.

Expected: focused tests pass, API typecheck/build pass, full API regression passes, diff check passes, Prisma/migration diff is empty, no network access, no migration, no unauthorized file, no successor activation, and unrelated local work remains unchanged.

## Completion

After explicit repository-controlled activation and all gates pass, update only the permitted completion metadata and run Automation v2 `Prepare`. Stop before `Publish` with `PHASE_COMPLETE_PREPARED`.
