# Phase BUILD-INFRA-A v1 — Workspace Package Build and API Output Boundary

## Review status

This is a review-only prerequisite phase pack. It must not modify `ACTIVE_PHASE.json` or `PHASE_QUEUE.json` until a separate governance change explicitly approves and activates it.

- Baseline candidate: `865489f386cc1073532f8889365470b57eb9b852`
- Source branch: `agent/build-infra-a-pack-v1`
- Pack: `BUILD-INFRA-A-v1`
- Purpose: repair a validated pre-existing API production-build defect before Phase 10H-A resumes.

## Confirmed baseline defect

The API production build uses `rootDir: "src"` while the monorepo base aliases resolve `@matchpulse/shared` and `@matchpulse/txline-client` directly to workspace TypeScript sources outside `apps/api/src`.

The validated baseline produces TS6059 diagnostics and exit code 2. The presence of `apps/api/dist/server.js` is not a successful build signal because TypeScript also emits workspace JavaScript beside source files.

The API typecheck is not equivalent to the production build because `tsconfig.typecheck.json` broadens `rootDir` to the monorepo root and uses `--noEmit`.

## Objective

Establish explicit package build boundaries:

1. build `packages/shared` from `src` to `dist`;
2. build `packages/txline-client` from `src` to `dist`;
3. expose each package through `dist/index.js` and `dist/index.d.ts`;
4. add a dedicated API production build config that disables source-level workspace aliases;
5. preserve `apps/api/dist/server.js` as the runtime start target;
6. preserve source aliases for development and no-emit typechecking;
7. rely on the existing Turborepo `dependsOn: ["^build"]` relationship for workspace build ordering.

## Allowed targets

Only these six paths may change:

- `apps/api/package.json`
- `apps/api/tsconfig.build.json`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/txline-client/package.json`
- `packages/txline-client/tsconfig.json`

No source code, route, worker, frontend, Prisma, migration, lockfile, root workspace config, or public contract may change.

## Exact implementation

Copy every file under `payload/` to the matching repository path exactly.

Do not broaden API `rootDir`.  
Do not ignore TS6059.  
Do not remove the API build validation.  
Do not emit workspace package code under the API `dist` tree.  
Do not add dependencies.  
Do not change `turbo.json`.

## Design details

- Workspace package tsconfigs use `rootDir: "src"` and `outDir: "dist"`.
- Workspace package builds emit JavaScript and declarations.
- Workspace package manifests expose only built root entry points through `main`, `types`, and ESM `exports`.
- `apps/api/tsconfig.build.json` extends the existing API config and overrides inherited `paths` with an empty mapping so NodeNext resolves workspace packages through their built package metadata.
- `apps/api/package.json` uses the dedicated build config.
- `apps/api/package.json` keeps `start: node dist/server.js`.
- API typecheck remains on `tsconfig.typecheck.json` and is not weakened.

## Validation

Run every command declared in `manifest.json` in order.

The validation must establish all of the following:

- both workspace packages typecheck and build;
- TxLINE client tests pass;
- package root JavaScript and declaration entry points exist;
- API typecheck passes;
- the real API build exits successfully;
- `apps/api/dist/server.js` exists;
- no `dist/apps` or `dist/packages` layout appears under the API;
- no generated JavaScript or declaration files appear beside workspace TypeScript sources;
- built package root imports resolve from the API workspace;
- the full API regression suite passes;
- Prisma remains unchanged;
- no network or migration operation occurs.

## Completion

After separate repository-controlled activation and successful validation:

1. update only the permitted `ACTIVE_PHASE.json` completion metadata;
2. run Automation v2 `Prepare`;
3. stop before `Publish`;
4. report `PHASE_COMPLETE_PREPARED`;
5. do not reactivate or revise 10H-A in the same phase.

After BUILD-INFRA-A is published, Phase 10H-A must receive a separately reviewed pack whose baseline is the BUILD-INFRA-A completion commit.
