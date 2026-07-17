# MatchPulse Railway deployment runbook

This runbook applies after the approved repository commit is published to `main`. It does not authorize migrations, seeds, provider calls, or worker scheduling.

## Shared repository settings

- Repository: `sinayavary/matchpulse`
- Branch: `main`
- Root/build context: repository root
- Create one Railway project named `matchpulse`, then create the three services below from the same GitHub repository and branch.

## 1. API service

- Service name: `matchpulse-api`
- Root Directory: repository root
- Dockerfile path: `/Dockerfile.api`
- Start command: use the Dockerfile command (`node dist/server.js`); do not override it with a migration or seed command.
- Healthcheck path: `/api/health`
- Public domain: enabled; generate a domain after the first successful deployment.

The service listens on `PORT`, then `API_PORT`, then `4000`, on `0.0.0.0`. Smoke-test `https://<matchpulse-api-domain>/api/health`. Internal `/api/internal/*` endpoints remain protected and are not smoke-test targets.

### API variables

Required:

- `DATABASE_URL` — PostgreSQL connection string supplied only in Railway.

Optional:

- `API_PORT` — local fallback only; Railway provides `PORT`.
- `CORS_ORIGIN`
- `MATCHPULSE_INTERNAL_AUTH_MODE`
- `MATCHPULSE_RUNTIME_REFRESH_ENABLED`
- `MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START`
- `MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS`
- `MATCHPULSE_RUNTIME_TARGETS_JSON`
- `TXLINE_NETWORK`
- `TXLINE_SERVICE_LEVEL_ID`
- `TXLINE_API_ORIGIN`
- `TXLINE_API_BASE_URL`
- `TXLINE_GUEST_AUTH_URL`
- `TXLINE_RPC_URL`
- `TXLINE_PROGRAM_ID`
- `TXLINE_TXL_TOKEN_MINT`
- `TXLINE_DATA_MODE`
- `TXLINE_HTTP_TIMEOUT_MS`
- `TXLINE_DEFAULT_COMPETITION_ID`
- `TXLINE_DEFAULT_START_EPOCH_DAY`

Secret:

- `MATCHPULSE_INTERNAL_TOKEN`
- `TXLINE_GUEST_JWT`
- `TXLINE_API_TOKEN`
- `SOLANA_KEYPAIR_PATH` — do not configure for the public API unless a separate approved architecture phase requires it.
- `TXLINE_ACTIVATION_TX_SIG`

Do not place values for secret variables in Git, Docker build arguments, `.env` files committed to the repository, or `NEXT_PUBLIC_*` variables. Do not run a production migration or automatic seed during startup.

## 2. Web service

- Service name: `matchpulse-web`
- Root Directory: repository root
- Dockerfile path: `/Dockerfile.web`
- Start command: use the Dockerfile command, equivalent to `next start -H 0.0.0.0 -p ${PORT:-3000}`.
- Public domain: enabled; generate a domain after deployment.

Set only this public build variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://<matchpulse-api-domain>
```

This value is consumed while the Web image builds. Generate and verify the API domain first, set this variable, then redeploy Web. Never place JWTs, API tokens, database credentials, or internal tokens in a `NEXT_PUBLIC_*` variable.

## 3. Worker service

- Service name: `matchpulse-worker`
- Root Directory: repository root
- Dockerfile path: `/Dockerfile.worker`
- Public domain: disabled
- Deployment: disabled
- Cron: disabled

Do not deploy or enable the worker until a separate approved phase provides dynamic production-safe scheduling. Its image has only a bounded dry-run command; do not use it as a Railway service command. Do not enable a public endpoint, cron, confirmed DB writes, automatic scheduling, or static-fixture production execution.

## Prohibited actions

- Do not run production migrations in startup commands.
- Do not run automatic seeds.
- Do not store secrets in GitHub, Docker images, build arguments, or committed `.env` files.
- Do not expose a public worker endpoint.
- Do not enable Worker Cron or confirmed database writes.
- Do not run a mainnet smoke test without a separate approval gate.
