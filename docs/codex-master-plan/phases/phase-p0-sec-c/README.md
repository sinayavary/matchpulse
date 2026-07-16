# Phase P0-SEC-C v1 — Internal Scopes, Service Identity and Audit Foundation

This phase is blocked at the database gate. It may not execute while
`ACTIVE_PHASE.json` is `awaiting_human_approval`.

## Required future scope

- Persist service identities and hashed credentials.
- Add explicit role/scope assignment, expiry, revocation, and lifecycle state.
- Add append-only authentication audit records without secrets or raw tokens.
- Preserve the P0-SEC-A central boundary and P0-SEC-B redaction behavior.
- Provide migration, rollback, local validation, negative tests, and audit
  evidence.

## Gate

Prisma schema and migration are required. Stop code:
`HUMAN_GATE_DATABASE_MIGRATION_REQUIRED`.

No production network, database write, secret acquisition, or breaking public
contract is authorized by this pack.
