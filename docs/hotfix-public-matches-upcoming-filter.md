# Hotfix: Public matches upcoming filter

## Baseline

- Main baseline: `f6eca5347f9522d14c75321f29bc0d1700160afe`
- Branch: `agent/hotfix-public-matches-upcoming-filter`
- Migration: not allowed
- Database mutation: not allowed during validation
- External/provider network access: not allowed during validation

## Defect

`GET /api/public/matches?range=upcoming` can return an empty list even when future fixtures exist. The current implementation scans a bounded set ordered from the oldest fixtures and applies the range predicate after the database `take`. When the database contains many historical fixtures, future rows never enter the scanned set.

## Required correction

Apply the time-range constraint in the Prisma fixture query before `take`:

- `upcoming`: query only fixtures whose non-null `startTimeUtc` is after the single request-time `now` value; order ascending so the nearest future fixtures are returned.
- `past`: query only fixtures whose non-null `startTimeUtc` is before `now`; order descending so the most recent completed/historical fixtures are returned.
- `all` and `live`: preserve their existing semantics unless a focused regression test proves a change is necessary.
- Preserve the existing bounded public response, limit normalization, competition filter behavior, safe no-data/degraded responses, canonical match-state mapping, public DTO, and public-safety boundary.
- Do not solve this by deleting historical data or increasing an unbounded scan limit.

## Allowed implementation targets

1. `apps/api/src/public-api.ts`
2. `apps/api/src/public-api.test.ts`

Do not modify Prisma, migrations, frontend files, orchestration metadata, prediction files, TxLINE client files, or generated Next configuration.

## Regression test

Add a deterministic test with more historical fixtures than the internal scan bound plus at least one future fixture. Assert that:

1. `range=upcoming` returns the future fixture;
2. historical fixtures are not returned;
3. the database query receives the future time predicate before `take`;
4. ordering is nearest future first;
5. the public response shape and metadata remain unchanged.

Also retain or add coverage that `range=past` returns recent past fixtures rather than the oldest historical fixtures if the implementation changes past ordering.

## Validation

Run from repository root:

```powershell
pnpm.cmd --filter @matchpulse/api exec tsx --test src/public-api.test.ts
pnpm.cmd --filter @matchpulse/api typecheck
pnpm.cmd --filter @matchpulse/api build
pnpm.cmd --filter @matchpulse/api test
git diff --check
git diff --name-only -- prisma
git status --short
```

After a successful web build is not required for this API-only hotfix. Do not touch `apps/web/next-env.d.ts` or `apps/web/tsconfig.json`.

## Completion evidence

Report exact changed paths, focused and regression test counts, typecheck/build results, empty Prisma diff, no migration, no database mutation, no external network use, commit SHA, and push result. Stop before merge to `main`.
