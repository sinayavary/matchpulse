# Phase DEPLOY-RAILWAY-WEB-HOTFIX-A — Replace TypeScript Next config for production runtime

This successor phase replaces the TypeScript Next.js configuration with the equivalent ESM configuration required by the production Web runtime.

## Exact implementation scope

Only these implementation files are permitted:

- `apps/web/next.config.ts` (delete)
- `apps/web/next.config.mjs` (create)

The new file must contain exactly:

```js
/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@matchpulse/shared"]
};

export default nextConfig;
```

Do not change dependencies, lockfiles, Dockerfiles, or any other implementation file.

## Required validation

Run every command in `manifest.json` in order. No migration, database mutation, external service access, deployment, or production operation is permitted.

After validation, update completion metadata only as permitted by Automation v2, run Prepare, do not Publish, and stop with `PHASE_COMPLETE_PREPARED`.

## Governance

This pack is a human-approved successor to `DEPLOY-RAILWAY-A`, based on commit `a9c163bc1c8681f035668b489bb99657d0969993`.
