# P0-SEC-C — Service Identity, Scopes and Audit Foundation

## Blocker

The current internal authentication is a single shared environment token.
Repository review found no persisted service identity, role/scope assignment,
expiration, revocation, or actor audit lifecycle. Implementing those controls
correctly requires Prisma schema changes and a migration; an in-memory or
environment-only substitute would not provide revocation or crash-safe audit
semantics.

## Required human decision

Approve a database migration proposal covering service identities, hashed
credential material, scoped permissions, expiry/revocation state, and
append-only authentication audit records. The migration must be reviewed and
applied separately under the database gate. No production database write is
authorized by this proposal.

## Proposed continuation

After explicit database approval, activate P0-SEC-C with the exact schema,
migration, service/auth contracts, negative tests, audit tests, rollback plan,
and local migration validation. Until then, `P0-SEC-C` remains awaiting human
approval and no successor phase is activated.
