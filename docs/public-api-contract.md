# Public API Contract

All product Web traffic uses `/api/public/*`. Public responses never expose raw provider payloads, secrets, infrastructure errors, or internal model details.

## Status

`GET /api/public/status` returns HTTP 200 while the API process is alive. `data.ok` is API liveness only. `data.product_ready` is derived from `data.readiness.overall === "ready"`.

Readiness has `database`, `ingestion_worker`, `agent_worker`, `evaluation_worker`, and `upstream` components. Each component has `status` (`ready`, `degraded`, or `unavailable`), a nullable timestamp, and a safe `reason_code`. A missing/stale heartbeat, disabled worker, upstream failure, or unavailable DB cannot produce false readiness.

## Competitions

`GET /api/public/competitions` returns sorted, deduplicated `{competition_id, name}` rows from persisted fixtures. Rows without a proven ID or display name are omitted.

## Matches

`GET /api/public/matches` accepts:

- `range`: `past`, `live`, `starting_soon`, `upcoming`, `recently_finished`, `interrupted`, or `all`;
- `competitionId`: a real stored provider ID, never a competition name;
- `from` and `to`: ISO-8601 UTC instants with `Z` or an explicit offset, using a half-open interval `[from,to)`;
- `limit`, opaque `cursor`, and optional `includeInsight`.

Range, competition ID, `from`, `to`, insight mode, direction, and snapshot identity are bound into cursor v3. A cursor reused with different filters is rejected. Scanning uses bounded database batches without a 10,000-row truncation ceiling and keeps a stable snapshot across pages.

Match detail, bundle, product-intelligence, event-impact, and replay routes remain under `/api/public/matches/:fixtureId/*` and retain their safe response contracts.

## Failure behavior

No verified rows produce a successful `no_data` response. Database/runtime/provider failures produce a sanitized degraded or unavailable response; internal errors and raw payloads never appear publicly. The internal Presenter route returns successful `no_data` only when the Presenter itself returns real no-data, and returns sanitized HTTP 503 for dependency failures.

Legacy `/api/matches/*`, `/api/agent/*`, `/api/watchlist`, and `/api/telegram/webhook` routes return JSON HTTP 410. Replaceable routes include deprecation/sunset headers and a successor link.

## Web base URL

The browser uses only `NEXT_PUBLIC_API_BASE_URL`. SSR uses `MATCHPULSE_API_BASE_URL`, falling back to the public value. `http://localhost:4000` is development-only; a production build/startup without a valid HTTP(S) API URL fails.
