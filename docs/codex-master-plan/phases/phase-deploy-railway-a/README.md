# Phase DEPLOY-RAILWAY-A — Railway API and Web deployment foundation

## Purpose

Prepare the root-monorepo build definitions and operator runbook for the approved Railway topology: public `matchpulse-api`, public `matchpulse-web`, and a defined-but-disabled `matchpulse-worker`. This phase does not contact Railway, production infrastructure, TxLINE, or Neon.

## Architecture and boundaries

- Every service builds with repository-root context and its own root Dockerfile.
- API listens on `0.0.0.0` and resolves its port in this exact order: `PORT`, `API_PORT`, then `4000`.
- Web's Linux-container command is `next start -H 0.0.0.0 -p ${PORT:-3000}`. `NEXT_PUBLIC_API_BASE_URL` is the only configured public API origin and is a build-time public value.
- Worker is buildable only. Its Railway domain, deployment, cron, automatic schedule, confirmed execute, and production database writes remain disabled. Do not change worker discovery or schedule behavior.
- Docker images must use pnpm `9.12.0`, frozen lockfile installs, generated Prisma Client where needed, production dependencies at runtime, no copied `.env`, no secret build arguments, no migration, and no seed.

## Exact implementation allowlist

`.dockerignore`, `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.worker`, `apps/api/src/server.ts`, `apps/api/src/server-railway.test.ts`, `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, and `docs/railway-deployment-runbook.md`.

The mandatory Next.js production build deterministically updates the two tracked Web configuration files above. They must not be restored: they are now part of the exact phase scope. Their changes must be limited to canonical Next.js type references, generated route type references, required compiler options, generated include paths, and standard JSON formatting. No application behavior, custom unrelated path, intentional TypeScript-safety reduction, or compiler-protection removal is permitted.

## Required validation

Run every `required_validation_commands` entry in `manifest.json`, then `git diff --check`. For Next.js idempotence, record SHA256 hashes for `apps/web/next-env.d.ts` and `apps/web/tsconfig.json`, run `pnpm --filter @matchpulse/web build` a second time, and require the same hashes afterwards. If Docker is available, build each Dockerfile from the repository root. Docker absence is recorded as `NETWORK_ACCESS_REQUIRED` only for image validation; it does not authorize a scope change.

## Expected result

The API startup test proves port precedence, `0.0.0.0` binding, and unauthenticated `/api/health`. Builds must succeed without migration, seed, live-provider calls, or secrets. The canonical Next.js generated configuration must be stable across a repeated production build. The runbook must explicitly keep the worker disabled.

## Restrictions

`allows_migration=false` and `allows_network=false`. Do not touch Prisma schema or migrations, Worker source, packages, GitHub Actions, dependencies, public API contracts, internal-auth contracts, model algorithms, discovery, or scheduling.

## Completion and rollback

After all validations pass, set `ACTIVE_PHASE.json` to `completed_pending_review` with `human_approved=false` and an exact sorted `files_changed` list, then run Automation v2 Prepare. Do not publish. Revert the resulting scoped commit to roll back; do not reset, clean, stash, or alter unrelated work.

## Stop codes

Use the repository protocol stop codes. In particular, stop for `WORKSPACE_COLLISION`, `SPEC_CONFLICT`, `TEST_FAILURE`, `TYPECHECK_FAILURE`, `UNAUTHORIZED_FILE_REQUIRED`, `MIGRATION_APPROVAL_REQUIRED`, `NETWORK_ACCESS_REQUIRED`, or `PHASE_COMPLETE_PREPARED` as applicable.
