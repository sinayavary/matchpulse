# Phase AUTO-DATA-HEALTH-REPORTING-A

Repair stale automatic-worker health reporting without changing the Prisma schema, migrations, seeds, provider access, lock behavior, or Agent behavior.

Scope is limited to API/Worker runtime health state, the internal worker status projection, focused regression coverage, Publish, and scoped Railway API/Worker redeploy.

Required evidence:

- successful/no-data cycles clear `lastError` and reset the cycle error count;
- discovery with zero active fixtures is not a failure;
- HealthStatus.raw contains only the latest cycle summary plus lock state;
- `/api/internal/worker/status` projects only the latest cycle summary;
- no migration, seed, schema, mock, fabricated data, or API/Web-only deployment.
