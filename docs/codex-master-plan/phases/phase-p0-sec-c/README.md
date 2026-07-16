# Phase P0-SEC-C v1 — Internal Scopes, Service Identity and Audit Foundation

This phase has explicit owner approval for a development schema and migration.
It must stop before migration apply unless the target database is independently
verified as non-production.

## Required future scope

- Persist service identities and hashed credentials.
- Add explicit role/scope assignment, expiry, revocation, and lifecycle state.
- Add append-only authentication audit records without secrets or raw tokens.
- Preserve the P0-SEC-A central boundary and P0-SEC-B redaction behavior.
- Provide migration, rollback, local validation, negative tests, and audit
  evidence.

## Implementation allowlist

- `apps/api/src/internal-auth-boundary.ts`
- `apps/api/src/internal-service-identity.ts`
- `apps/api/src/internal-service-identity.test.ts`
- `apps/api/src/internal-service-identity-store.ts`
- `apps/api/src/server.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260716003000_p0_sec_c_service_identity/migration.sql`
- the orchestration, pack, and phase proposal files listed in `manifest.json`

## Gate

Prisma schema and migration are required. If the target database cannot be
verified as local/test/development, stop with
`P0_SEC_C_SAFE_DEVELOPMENT_DATABASE_NOT_VERIFIED` after schema/SQL validation.

No production network, database write, secret acquisition, or breaking public
contract is authorized by this pack.
