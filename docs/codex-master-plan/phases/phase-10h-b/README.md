# Phase 10H-B v1 — Versioned Feature Assembly and Scenario Ensemble

This phase implements the deterministic feature/specialist/ensemble boundary
after 10H-A. It is database-free, network-free, and must not change public
routes, Prisma schema, migrations, or provider access.

## Scope

- bounded prediction feature snapshot assembly;
- deterministic state, scoreline, tempo/event, and market specialists;
- sanitized ensemble composition with explicit fallback behavior;
- deterministic identities, monotonic goal horizons, and public safety checks.

## Gate

The owner explicitly requested continuation through all defined phases. The
phase has no database migration, external network, or human-gated operation.
Only the allowlisted implementation and documentation paths may change.

## Validation

- focused feature, specialist, and ensemble tests pass;
- API typecheck, build, and full regression pass;
- `git diff --check` passes;
- Prisma/migration diff is empty;
- no public contract, secret, provider payload, or private coefficient enters
  the repository.
