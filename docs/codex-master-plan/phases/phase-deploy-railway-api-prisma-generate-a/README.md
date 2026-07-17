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

Run every command in `manifest.json` in order. The image test must construct `new PrismaClient()` without the initialization error and must not connect to or mutate any database.

## Safety and human gate

This is a governance-only pack amendment. It may use network access only for the explicitly listed dependency install and Docker image build operations. It must not access or mutate a production database, run migrations or seeds, change Railway services, or print secrets.

Execution must occur only in a clean, registered secondary worktree on a non-detached branch. After Automation v2 Validate, that branch's `HEAD` must equal `origin/main`; the branch name does not need to be `main`.

The permitted network scope is limited to `pnpm install --frozen-lockfile` when the offline cache is insufficient and the `docker build -f Dockerfile.api -t matchpulse-api-prisma-generate-a .` operation. No other network operation is authorized by this pack.

## Completion and rollback

After a separately approved implementation run, record exact completion metadata and stop at the repository's human review gate. Roll back only the scoped phase commit if required; do not reset, clean, stash, or alter unrelated work.
