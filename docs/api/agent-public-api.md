# Public Agent API: minimal local delivery

This document describes the two public read endpoints exercised by the local
PostgreSQL smoke test. It does not claim that the managed Agent Worker cycle,
prediction persistence, staging, or production has been verified.

## Requirements

- `DATABASE_URL` is required by the API and by the local smoke test.
- Set `MATCHPULSE_PUBLIC_READ_ANONYMOUS=true` to allow the demonstrated public
  read requests without an Authorization header.

## Endpoints

### `GET /api/public/matches/:fixtureId/intelligence-card`

Returns a public intelligence card for a persisted fixture. The successful
response envelope has public metadata and data including `fixture_id`, `brief`,
and `signal_summary`.

```bash
curl http://localhost:3000/api/public/matches/fixture-123/intelligence-card
```

Successful shape:

```json
{
  "data": {
    "fixture_id": "fixture-123",
    "brief": {},
    "signal_summary": {}
  },
  "meta": { "mode": "public" }
}
```

### `GET /api/public/matches/:fixtureId/product-intelligence`

Returns public product intelligence for a persisted fixture. The successful
response has non-null `data`, its `fixture_id`, and
`product_version: "matchpulse-final-v1"`.

```bash
curl http://localhost:3000/api/public/matches/fixture-123/product-intelligence
```

Successful shape:

```json
{
  "data": {
    "fixture_id": "fixture-123",
    "product_version": "matchpulse-final-v1"
  },
  "meta": { "mode": "public" }
}
```

## Public safety

The smoke test uses the real Fastify routes and persisted fixture, match-state,
and odds data. The demonstrated envelopes use `meta.mode: "public"`; this
minimal delivery does not document or expose database credentials, raw provider
payloads, or internal implementation data.

## Local PostgreSQL smoke test

Run only against a disposable local database whose name starts with
`matchpulse_agent_api_`:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @matchpulse/api exec tsx --test src/agent-public-api.postgres.integration.test.ts
```

## Known limitations

- The managed Agent Worker cycle was not proven in this minimal delivery.
- Prediction persistence was not proven in this minimal delivery.
- Staging and production smoke tests were not executed.
