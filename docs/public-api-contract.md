# Public API Contract — `/api/public/*`

> **Audience:** Frontend team implementing final product pages.
> **Source files:** `apps/api/src/public-api.ts`, `apps/api/src/server.ts`, `apps/web/lib/public-api.ts`

---

## 1. Purpose

`/api/public/*` is the **only public-safe API layer** for final frontend pages.

It reads directly from the database, assembles canonical match state, runs SignalCore data-quality analysis, and returns a fully sanitized response — no mock data, no demo bridge, no internal routes.

Every response passes through `stripForbiddenFields` (recursive key removal) and `assertNoForbiddenSignalFields` (runtime assertion) to guarantee no internal, sensitive, or betting-related fields are ever exposed.

All public responses include `meta.mode: "public"` and `meta.source: "database"`.

---

## 2. Allowed Frontend Routes

Frontend **may** call these routes for final product pages:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/status` | Service health and version |
| GET | `/api/public/matches` | List matches with range/competition filtering |
| GET | `/api/public/matches/:fixtureId` | Full match state for a single fixture |
| GET | `/api/public/matches/:fixtureId/bundle` | Composite bundle: state + signals + brief |

All routes are mounted on the Fastify app at `http://localhost:4000` (default) and proxied through `NEXT_PUBLIC_API_BASE_URL` in production.

---

## 3. Forbidden Frontend Routes

Frontend **must not** call these routes for final product data:

| Route | Reason |
|-------|--------|
| `/api/internal/*` | Internal pipeline routes — not public-safe |
| TxLINE directly | Oracle access — backend-only |
| `/api/matches` | Legacy mock-backed endpoint — not real data |
| `/api/matches/:fixtureId` | Legacy mock-backed — not real data |
| `/api/demo/*` | Demo bridge — only for the demo page |

> **Exception:** The demo page (`/demo`) may continue to use `/api/demo/*`.

---

## 4. Route Details

### 4.1 GET /api/public/status

**Purpose:** Service health check and API version verification.

**Query params:** None.

**Response shape:**

```json
{
  "data": {
    "service": "matchpulse-api",
    "ok": true,
    "public_api_version": "public-v0",
    "demo_available": true
  },
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

**Safe usage notes:**
- Always returns HTTP 200 — never errors.
- Use to verify the public API is live and to confirm version compatibility.
- `demo_available` indicates whether the demo bridge is also serving.

**Error/no_data behavior:** None — this endpoint always succeeds.

---

### 4.2 GET /api/public/matches

**Purpose:** List match summaries with optional range and competition filtering.

**Query params:**

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `range` | `string` | `"all"` | — | — | Filter by match phase: `all`, `past`, `upcoming`, `live` |
| `competitionId` | `string` | _(none)_ | — | — | Optional filter by competition ID |
| `limit` | `number` | `20` | `1` | `100` | Maximum number of results |

**Response shape:**

```json
{
  "data": [
    {
      "fixture_id": "17952170",
      "competition": "Euro Qualifiers",
      "home_team": "Slovenia",
      "away_team": "Cyprus",
      "start_time_utc": "2024-11-19T20:45:00Z",
      "status": "FT",
      "scoreboard": {
        "available": true,
        "home_score": 1,
        "away_score": 1
      },
      "odds": {
        "available": false,
        "count": 0
      },
      "quality": {
        "status": "partial",
        "issues": ["ODDS_MISSING"]
      },
      "latest_data_timestamp": "2024-11-19T20:50:00Z"
    }
  ],
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

**Safe usage notes:**
- Returns a **summary** — no full odds objects, no full scoreboard detail, no freshness sub-object.
- For full match data, follow up with `/api/public/matches/:fixtureId` or `/bundle`.
- Over-fetches internally (up to 5x limit) then filters in-memory for range classification.

**Error/no_data behavior:**

| Scenario | HTTP | `meta.status` | `meta.message` |
|----------|------|---------------|-----------------|
| Invalid `range` value | 400 | `"no_data"` | Validation error string |
| `DATABASE_URL` not configured | 200 | `"no_data"` | _(none)_ |
| Database error | 503 | `"degraded"` | `"Public match list is temporarily unavailable."` |
| No matching fixtures | 200 | `"no_data"` | _(none)_ |

---

### 4.3 GET /api/public/matches/:fixtureId

**Purpose:** Retrieve the full canonical match state for a single fixture.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `fixtureId` | `string` | The fixture ID (e.g. `17952170`) |

**Query params:**

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `includeOdds` | `boolean` | `true` | — | — | Include odds data in response |
| `oddsLimit` | `number` | `20` | `1` | `50` | Maximum odds entries to return |
| `staleAfterMinutes` | `number` | `60` | `1` | `10080` | Staleness threshold in minutes (max 7 days) |

**Response shape:**

```json
{
  "data": {
    "fixture_id": "17952170",
    "identity": {
      "fixture_id": "17952170",
      "home_team": "Slovenia",
      "away_team": "Cyprus",
      "competition": "Euro Qualifiers",
      "start_time_utc": "2024-11-19T20:45:00Z",
      "status": "FT"
    },
    "scoreboard": {
      "available": true,
      "home_score": 1,
      "away_score": 1,
      "phase": "FT",
      "last_data_received_at": "2024-11-19T20:50:00Z"
    },
    "odds": {
      "available": false,
      "count": 0,
      "markets": []
    },
    "freshness": {
      "built_at": "2024-11-19T21:00:00Z",
      "latest_score_timestamp": "2024-11-19T20:50:00Z",
      "latest_odds_timestamp": null,
      "latest_data_timestamp": "2024-11-19T20:50:00Z"
    },
    "quality": {
      "status": "partial",
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "issues": ["ODDS_MISSING"]
    }
  },
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

**Safe usage notes:**
- Returns the **full** canonical match state (minus forbidden fields).
- Set `includeOdds=false` to reduce payload when odds are not needed.
- The `staleAfterMinutes` param controls how `meta.status` reflects data freshness.

**Error/no_data behavior:**

| Scenario | HTTP | `meta.status` | `meta.message` |
|----------|------|---------------|-----------------|
| Fixture not found (no data at all) | 404 | _(computed)_ | `"Fixture not found."` |
| Database error on read | 200 | _(computed)_ | Returns empty canonical state |
| Data is stale | 200 | `"stale"` | _(none)_ |

---

### 4.4 GET /api/public/matches/:fixtureId/bundle

**Purpose:** Retrieve a composite bundle containing match state, signal analysis, and agent brief in a single request.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `fixtureId` | `string` | The fixture ID (e.g. `17952170`) |

**Query params:**

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `includeState` | `boolean` | `true` | — | — | Include full match state |
| `includeSignals` | `boolean` | `true` | — | — | Include signal summary and signal list |
| `includeBrief` | `boolean` | `true` | — | — | Include agent brief |
| `oddsLimit` | `number` | `20` | `1` | `50` | Maximum odds entries |
| `staleAfterMinutes` | `number` | `60` | `1` | `10080` | Staleness threshold in minutes |

**Response shape:**

```json
{
  "data": {
    "fixture_id": "17952170",
    "readiness": {
      "status": "partial",
      "display_ready": true,
      "has_state": true,
      "has_brief": true,
      "has_signals": true,
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "issue_count": 1,
      "issues": ["ODDS_MISSING"]
    },
    "brief": {
      "status_label": "Partial Data",
      "headline": "Slovenia 1 - 1 Cyprus",
      "overview": "Scoreboard data is available but odds data is missing.",
      "available_data": ["fixture", "scoreboard"],
      "missing_data": ["odds"],
      "freshness_note": "Data received within the last hour.",
      "quality_notes": ["Scoreboard is complete.", "Odds data not found."],
      "safe_scope_note": "This analysis reflects current data availability and quality."
    },
    "signal_summary": {
      "status": "partial",
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "latest_data_timestamp": "2024-11-19T20:50:00Z",
      "signal_count": 2,
      "info_count": 1,
      "warning_count": 1,
      "critical_count": 0
    },
    "signals": [
      {
        "type": "DATA_READY",
        "severity": "info",
        "title": "Fixture data available",
        "message": "Core fixture and scoreboard data has been received."
      },
      {
        "type": "ODDS_MISSING",
        "severity": "warning",
        "title": "Odds data missing",
        "message": "No odds data has been received for this fixture."
      }
    ],
    "state": {
      "fixture_id": "17952170",
      "identity": { "..." : "..." },
      "scoreboard": { "..." : "..." },
      "odds": { "..." : "..." },
      "freshness": { "..." : "..." },
      "quality": { "..." : "..." }
    }
  },
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

**Safe usage notes:**
- The bundle is the **recommended single-call** endpoint for match detail pages — it provides everything the frontend needs in one request.
- Set `includeState=false` if you only need signals and brief (lighter payload).
- Set `includeBrief=false` or `includeSignals=false` if you don't need those sections.
- When a section is excluded via `false`, its field is `null` (or `[]` for signals).

**Error/no_data behavior:**

| Scenario | HTTP | `meta.status` | `meta.message` |
|----------|------|---------------|-----------------|
| Unhandled exception | 503 | `"degraded"` | `"Public match bundle is temporarily unavailable."` |
| Fixture not found | 404 | _(computed)_ | `"Fixture not found."` |
| Data is stale | 200 | `"stale"` | _(none)_ |

---

## 5. Data Shapes

### PublicStatus

Service health and version info.

```typescript
type PublicStatus = {
  service: "matchpulse-api";
  ok: true;
  public_api_version: "public-v0";
  demo_available: true;
};
```

### PublicMatchSummary

Lightweight match card used in the list endpoint.

```typescript
type PublicMatchSummary = {
  fixture_id: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  start_time_utc: string | null;
  status: string | null;
  scoreboard: {
    available: boolean;
    home_score: number | null;
    away_score: number | null;
  };
  odds: {
    available: boolean;
    count: number;
  };
  quality: {
    status: "complete" | "partial" | "empty";
    issues: string[];
  };
  latest_data_timestamp: string | null;
};
```

### PublicMatchState

Full canonical match state for a single fixture.

```typescript
type PublicMatchState = {
  fixture_id: string;
  identity: {
    fixture_id: string;
    home_team: string | null;
    away_team: string | null;
    competition: string | null;
    start_time_utc: string | null;
    status: string | null;
  };
  scoreboard: {
    available: boolean;
    home_score: number | null;
    away_score: number | null;
    phase: string | null;
    last_data_received_at: string | null;
  };
  odds: {
    available: boolean;
    count: number;
    markets: PublicOddsMarket[] | undefined;
  };
  freshness: {
    built_at: string | null;
    latest_score_timestamp: string | null;
    latest_odds_timestamp: string | null;
    latest_data_timestamp: string | null;
  };
  quality: {
    status: "complete" | "partial" | "empty";
    has_fixture: boolean;
    has_scoreboard: boolean;
    has_odds: boolean;
    issues: string[];
  };
};
```

### PublicMatchBundle

Composite response aggregating state, signals, and brief.

```typescript
type PublicMatchBundle = {
  fixture_id: string;
  readiness: PublicReadiness;
  brief: PublicBrief | null;
  signal_summary: PublicSignalSummary | null;
  signals: PublicSignal[];
  state: PublicMatchState | null;
};
```

### PublicReadiness

Readiness overview for display logic.

```typescript
type PublicReadiness = {
  status: string;
  display_ready: boolean;
  has_state: boolean;
  has_brief: boolean;
  has_signals: boolean;
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  issue_count: number;
  issues: string[];
};
```

### PublicBrief

Agent-generated natural-language brief.

```typescript
type PublicBrief = {
  status_label: string;
  headline: string;
  overview: string;
  available_data: string[];
  missing_data: string[];
  freshness_note: string;
  quality_notes: string[];
  safe_scope_note: string;
};
```

### PublicSignal

A single data-quality signal.

```typescript
type PublicSignal = {
  type: string;
  severity: string;
  title: string;
  message: string;
};
```

### PublicSignalSummary

Aggregated signal statistics.

```typescript
type PublicSignalSummary = {
  status: string;
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  latest_data_timestamp: string | null;
  signal_count: number;
  info_count: number;
  warning_count: number;
  critical_count: number;
};
```

### PublicMeta

Response metadata present on every public response.

```typescript
type PublicMeta = {
  status: "live" | "no_data" | "stale" | "degraded";
  source: "database";
  mode: "public";
  message?: string;
};
```

---

## 6. Query Params

### GET /api/public/matches

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `range` | `string` | `"all"` | — | — | `all` \| `past` \| `upcoming` \| `live` |
| `competitionId` | `string` | _(none)_ | — | — | Optional filter by competition ID |
| `limit` | `number` | `20` | `1` | `100` | Maximum number of results |

### GET /api/public/matches/:fixtureId

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `includeOdds` | `boolean` | `true` | — | — | Include odds in match state |
| `oddsLimit` | `number` | `20` | `1` | `50` | Max odds entries to return |
| `staleAfterMinutes` | `number` | `60` | `1` | `10080` | Staleness threshold (minutes, max 7 days) |

### GET /api/public/matches/:fixtureId/bundle

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `includeState` | `boolean` | `true` | — | — | Include `state` in bundle |
| `includeSignals` | `boolean` | `true` | — | — | Include `signal_summary` + `signals` |
| `includeBrief` | `boolean` | `true` | — | — | Include `brief` |
| `oddsLimit` | `number` | `20` | `1` | `50` | Max odds entries to return |
| `staleAfterMinutes` | `number` | `60` | `1` | `10080` | Staleness threshold (minutes, max 7 days) |

---

## 7. Known Demo Fixtures for Testing

These fixtures are available in the database and demonstrate different data-availability scenarios:

### Fixture 17952170 — Slovenia vs Cyprus

- **Scoreboard:** Available — score **1 – 1**
- **Odds:** Missing
- **Signals:** `DATA_READY` (info), `ODDS_MISSING` (warning)
- **Use for testing:** Verifies scoreboard rendering and missing-odds handling.

### Fixture 17588223 — Mexico vs South Korea

- **Fixture:** Available
- **Odds:** Available
- **Scoreboard:** Missing
- **Signals:** `ODDS_AVAILABLE` (info), `SCOREBOARD_MISSING` (warning)
- **Use for testing:** Verifies odds rendering and missing-scoreboard handling.

---

## 8. Safety Boundaries

The public API **must never expose** the following:

### Secrets and infrastructure

- Secrets
- Environment variable values
- Database URLs / connection strings
- JWT or API tokens
- Wallet or private key data
- Internal stack traces

### Betting and wagering fields

- `probability`
- `confidence`
- `recommendation`
- `recommended_bet`
- `bet`
- `wager`
- `stake`
- `expected_value`
- `edge`
- `prediction`
- `winner`
- `deposit`
- `wallet`
- `payout`
- `profit`

### Enforcement

Every response passes through two layers:

1. **`stripForbiddenFields`** — recursively removes any key whose lowercased name matches the forbidden list (imported from `signalcore-contract`).
2. **`assertNoForbiddenSignalFields`** — runtime assertion that throws if any forbidden field is still present after stripping.

---

## 9. Frontend Integration Notes

### Base URL

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";
```

- **Primary:** Use `NEXT_PUBLIC_API_BASE_URL` if set (trailing slash stripped).
- **Fallback:** `http://localhost:4000`.

### Route usage

- **Final product pages** must use `/api/public/*`.
- **Demo page** (`/demo`) may continue using `/api/demo/*`.
- The old `/api/matches` endpoint is **legacy/mock** — not final product data.

### Client helpers (apps/web/lib/public-api.ts)

The frontend library exports these typed fetch helpers:

| Function | Route |
|----------|-------|
| `fetchPublicStatus()` | `/api/public/status` |
| `fetchPublicMatches(params)` | `/api/public/matches` |
| `fetchPublicMatch(fixtureId, options)` | `/api/public/matches/:fixtureId` |
| `fetchPublicMatchBundle(fixtureId, options)` | `/api/public/matches/:fixtureId/bundle` |

All helpers return `PublicFetchResult<T>`:

```typescript
type PublicFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  meta: PublicMeta | null;
};
```

### Formatting helpers

| Function | Description |
|----------|-------------|
| `formatFixtureLabel(match)` | Returns `"Home vs Away"` |
| `formatScoreboard(scoreboard)` | Returns `"X - Y"` |
| `sanitizeSafeScopeNote(note)` | Strips gambling-related terms |

---

## 10. Runtime Smoke Commands

Run these PowerShell commands to verify the public API is functioning:

```powershell
# Health check — should return public-v0
curl.exe http://localhost:4000/api/public/status

# Match list — should return database-backed matches
curl.exe "http://localhost:4000/api/public/matches?range=all&limit=20"

# Single match — Slovenia vs Cyprus (scoreboard 1-1, odds missing)
curl.exe "http://localhost:4000/api/public/matches/17952170?includeOdds=true&oddsLimit=20"

# Full bundle — Slovenia vs Cyprus with state, signals, and brief
curl.exe "http://localhost:4000/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20"

# Legacy mock endpoint (for comparison — not for product use)
curl.exe http://localhost:4000/api/matches

# Demo bridge endpoint (for demo page only)
curl.exe http://localhost:4000/api/demo/matches
```

---

## 11. Expected Smoke Results

| Command | Expected Key Fields |
|---------|-------------------|
| `GET /api/public/status` | `public_api_version: "public-v0"`, `ok: true` |
| `GET /api/public/matches` | `meta.source: "database"`, `meta.mode: "public"`, `data[]` array of match summaries |
| `GET /api/public/matches/17952170` | `scoreboard.home_score: 1`, `scoreboard.away_score: 1`, `scoreboard.available: true` |
| `GET /api/public/matches/17952170/bundle` | `readiness.display_ready: true`, `brief` present, `signal_summary` present, `state` present, signals include `DATA_READY` and `ODDS_MISSING` |
| `GET /api/matches` | Returns **mock** data (not database-backed) |
| `GET /api/demo/matches` | `meta.source: "demo-bridge"`, `meta.mode: "public-demo"` |

---

## Appendix: Response Envelope

All public API responses use a consistent envelope:

```typescript
{
  data: T;           // The response payload (varies by route)
  meta: {
    status: "live" | "no_data" | "stale" | "degraded";
    source: "database";
    mode: "public";
    message?: string;  // Present on errors or special conditions
  };
}
```

### Meta status meanings

| Status | Meaning |
|--------|---------|
| `live` | Data is fresh and complete (or partially complete with known issues) |
| `no_data` | No data available for the request |
| `stale` | Data exists but exceeds the `staleAfterMinutes` threshold |
| `degraded` | Service is partially available; try again later |
