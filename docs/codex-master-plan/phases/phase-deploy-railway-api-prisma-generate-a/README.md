# Phase DEPLOY-RAILWAY-API-PRISMA-GENERATE-A — Generate Prisma Client in the Railway API image build

## Purpose

Resolve the Railway API runtime failure `@prisma/client did not initialize yet` by making Prisma Client generation an explicit step in the API image build.

## Evidence

- Railway API is up, but runtime construction of `new PrismaClient()` fails with `@prisma/client did not initialize yet`.
- `Dockerfile.api` copies the `prisma` directory but does not run Prisma generation before the build and production deployment steps.

## Exact implementation scope

Only `Dockerfile.api` may be changed. After `COPY prisma prisma` and before build/deploy, add exactly:

```sh
pnpm exec prisma generate --schema=prisma/schema.prisma
```

Do not change `DATABASE_URL`, Neon configuration, Prisma schema, migrations, application code, dependencies, lockfiles, or any deployment configuration.

## Required validation

Run every command in `manifest.json` in order. The Railway remote build must use `Dockerfile.api` and show successful Prisma generation. The Railway SSH smoke test must construct `new PrismaClient()` without the initialization error and must not connect to or mutate any database.

## Safety and human gate

This is a governance-only pack amendment for Railway remote Docker validation and API redeployment. It may use network access and remote mutation only for the explicitly scoped Railway project, environment, and API service in `manifest.json`. It must not access or mutate Neon or any other database, run migrations or seeds, change Web or Worker services, or print secrets.

Execution must occur only in a clean, registered secondary worktree on a non-detached branch. After Automation v2 Validate, that branch's `HEAD` must equal `origin/main`; the branch name does not need to be `main`.

The permitted network scope is limited to `pnpm install --frozen-lockfile --offline` (or the same frozen install against `registry.npmjs.org` only when the cache is insufficient), Railway's remote Docker build/deploy for the scoped API service, Railway SSH for the scoped API container smoke check, and read-only requests to the scoped API health, internal DB-status, and public matches endpoints. No local Docker installation or local Docker build/run is required or authorized.

The implementation must run `pnpm exec prisma generate --schema=prisma/schema.prisma` immediately after `COPY prisma prisma`, before the build/deploy step. Because the production deploy can replace the generated client with an uninitialized stub, it must then copy the generated `.prisma/client` directory from the build-stage pnpm store into the matching production dependency path after `pnpm --filter @matchpulse/api --prod deploy /app`. This remains a Dockerfile-only change and must not modify package manifests, the lockfile, schema, or migrations.

## Completion and rollback

After a separately approved implementation run, record exact completion metadata and stop at the repository's human review gate. Roll back only the scoped phase commit if required; do not reset, clean, stash, or alter unrelated work.
