# Matches Catalog Environment Reference

| Variable | Default | Purpose |
| --- | ---: | --- |
| `MATCHPULSE_DISCOVERY_BACKFILL_DAYS` | `1` | UTC backfill window |
| `MATCHPULSE_DISCOVERY_FUTURE_DAYS` | `14` | future discovery horizon |
| `MATCHPULSE_NEAR_DISCOVERY_INTERVAL_MS` | `300000` | near cadence |
| `MATCHPULSE_FAR_DISCOVERY_INTERVAL_MS` | `1800000` | far cadence |
| `MATCHPULSE_DISCOVERY_RETRIES` | `3` | bounded provider retries |
| `MATCHPULSE_CATALOG_SCAN_BUDGET` | `100000` | bounded scan budget; page size 250 |
| `MATCHPULSE_CAPTURE_LEAD_MINUTES` | `60` | lifecycle lead |
| `MATCHPULSE_CAPTURE_TAIL_MINUTES` | `180` | lifecycle tail |
| `MATCHPULSE_DATA_WORKER_ENABLED` | `false` | ingestion/discovery loop |
| `MATCHPULSE_AGENT_WORKER_ENABLED` | `false` | intelligence/brief/prediction loop |
| `MATCHPULSE_EVALUATION_WORKER_ENABLED` | `false` | final-label/evaluation loop |
| `MATCHPULSE_AGENT_INTERVAL_MS` | `60000` | intelligence loop cadence |
| `MATCHPULSE_EVALUATION_INTERVAL_MS` | `300000` | evaluation loop cadence |
| `CORS_ORIGIN` | development localhost only | explicit comma-separated production allowlist |
| `NEXT_PUBLIC_API_BASE_URL` | development localhost only | browser API origin |
| `MATCHPULSE_API_BASE_URL` | public value | preferred SSR API origin |

These are internal runtime settings. They do not authorize production writes, migrations,
deployment, or credential use.
