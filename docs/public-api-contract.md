# MatchPulse Public API Contract

## 1. Purpose

`/api/public/*` is the only public-safe API layer for the final frontend pages.

This contract exists so the frontend team can build against a stable, allowlisted surface without touching internal routes, TxLINE directly, secrets, or legacy mock routes.

Public routes are designed for display, freshness, and data-availability handling only. They are not a betting, prediction, or recommendation layer.

## 2. Allowed Frontend Routes

Frontend may call only:

- `GET /api/public/status`
- `GET /api/public/matches`
- `GET /api/public/matches/:fixtureId`
- `GET /api/public/matches/:fixtureId/bundle`

## 3. Forbidden Frontend Routes

Frontend must not call:

- `/api/internal/*`
- TxLINE directly
- `/api/matches` for final product data
- `/api/demo/*` except the demo page

`/api/matches` remains legacy/mock-backed and is not final product data.

## 4. Route Details

### GET `/api/public/status`

- Method: `GET`
- Path: `/api/public/status`
- Purpose: confirm the public API is alive and identify the public contract version.
- Query params: none
- Response shape: `PublicStatus`
- Example response:

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

- Safe usage notes: use this as the first lightweight connectivity check for final frontend pages.
- Error/no_data behavior: this route is intended to always return a live public contract response.

### GET `/api/public/matches`

- Method: `GET`
- Path: `/api/public/matches`
- Purpose: return a public list of match summaries for browse pages.
- Query params:
  - `range=all|past|upcoming|live`
  - `competitionId` optional
  - `limit` default `20`, max `100`
- Response shape: `PublicMatchSummary[]`
- Example response:

```json
{
  "data": [
    {
      "fixture_id": "17952170",
      "competition": "World Cup",
      "home_team": "Slovenia",
      "away_team": "Cyprus",
      "start_time_utc": "2026-07-06T18:00:00Z",
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
        "issues": ["odds_missing"]
      },
      "latest_data_timestamp": "2026-07-06T18:10:00Z"
    }
  ],
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

- Safe usage notes:
  - Use this for match lists, tabs, and browse screens.
  - Treat `quality.status`, `scoreboard.available`, and `odds.available` as primary display controls.
  - Respect `limit` and filter client-side only as a fallback; prefer server filtering.
- Error/no_data behavior:
  - Invalid `range` returns `400` with `meta.status: "no_data"` and a safe validation message.
  - No database or no matches returns `200` with `data: []` and `meta.status: "no_data"`.
  - Backend failures return `503` with `meta.status: "degraded"` and a safe message.

### GET `/api/public/matches/:fixtureId`

- Method: `GET`
- Path: `/api/public/matches/:fixtureId`
- Purpose: return the canonical public-safe match state for a single fixture.
- Query params:
  - `includeOdds` default `true`
  - `oddsLimit` default `20`, max `50`
  - `staleAfterMinutes` default `60`
- Response shape: `PublicMatchState`
- Example response:

```json
{
  "data": {
    "fixture_id": "17952170",
    "identity": {
      "fixture_id": "17952170",
      "competition": "World Cup",
      "home_team": "Slovenia",
      "away_team": "Cyprus",
      "start_time_utc": "2026-07-06T18:00:00Z",
      "status": "FT"
    },
    "scoreboard": {
      "available": true,
      "home_score": 1,
      "away_score": 1,
      "phase": "fulltime",
      "last_data_received_at": "2026-07-06T18:10:00Z"
    },
    "odds": {
      "available": false,
      "count": 0
    },
    "freshness": {
      "built_at": "2026-07-06T18:10:01Z",
      "latest_score_timestamp": "2026-07-06T18:10:00Z",
      "latest_odds_timestamp": null,
      "latest_data_timestamp": "2026-07-06T18:10:00Z"
    },
    "quality": {
      "status": "partial",
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "issues": ["odds_missing"]
    }
  },
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

- Safe usage notes:
  - Use this for the final match room state.
  - Show stale or degraded banners from `meta.status`.
  - Keep the UI read-only and informational.
- Error/no_data behavior:
  - Unknown fixture returns `404` with `meta.status: "no_data"` and a safe message.
  - If the backend cannot build a state, it returns a degraded or no_data-safe canonical state instead of exposing internals.

### GET `/api/public/matches/:fixtureId/bundle`

- Method: `GET`
- Path: `/api/public/matches/:fixtureId/bundle`
- Purpose: return the public-safe combined bundle used by the final match page.
- Query params:
  - `includeState` default `true`
  - `includeSignals` default `true`
  - `includeBrief` default `true`
  - `oddsLimit` default `20`, max `50`
  - `staleAfterMinutes` default `60`
- Response shape: `PublicMatchBundle`
- Example response:

```json
{
  "data": {
    "fixture_id": "17952170",
    "readiness": {
      "status": "ready",
      "display_ready": true,
      "has_state": true,
      "has_brief": true,
      "has_signals": true,
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "issue_count": 1,
      "issues": ["odds_missing"]
    },
    "brief": {
      "status_label": "partial",
      "headline": "Match data is mostly available.",
      "overview": "The fixture has scoreboard data, but odds are missing.",
      "available_data": ["fixture identity", "scoreboard"],
      "missing_data": ["odds"],
      "freshness_note": "Latest match data is available.",
      "quality_notes": ["Odds are not available for this fixture."],
      "safe_scope_note": "This brief only describes data availability, freshness, and quality. It does not provide predictions, probabilities, recommendations, or betting guidance."
    },
    "signal_summary": {
      "status": "partial",
      "has_fixture": true,
      "has_scoreboard": true,
      "has_odds": false,
      "latest_data_timestamp": "2026-07-06T18:10:00Z",
      "signal_count": 2,
      "info_count": 1,
      "warning_count": 1,
      "critical_count": 0
    },
    "signals": [
      {
        "type": "DATA_READY",
        "severity": "info",
        "title": "Scoreboard available",
        "message": "The scoreline is available for display."
      }
    ],
    "state": {
      "fixture_id": "17952170",
      "identity": {
        "fixture_id": "17952170",
        "competition": "World Cup",
        "home_team": "Slovenia",
        "away_team": "Cyprus",
        "start_time_utc": "2026-07-06T18:00:00Z",
        "status": "FT"
      },
      "scoreboard": {
        "available": true,
        "home_score": 1,
        "away_score": 1
      },
      "odds": {
        "available": false,
        "count": 0
      },
      "freshness": {
        "latest_data_timestamp": "2026-07-06T18:10:00Z"
      },
      "quality": {
        "status": "partial",
        "issues": ["odds_missing"]
      }
    }
  },
  "meta": {
    "status": "live",
    "source": "database",
    "mode": "public"
  }
}
```

- Safe usage notes:
  - Use this for the final match room and detail page because it combines readiness, brief, signals, and state.
  - Respect the `include*` flags so the page can request lighter payloads when needed.
  - Keep the bundle strictly informational.
- Error/no_data behavior:
  - Unknown fixture returns `404` with a safe `Fixture not found.` message and an empty public bundle body.
  - Backend failures return `503` with `meta.status: "degraded"` and an empty degraded bundle.

## 5. Data Shapes

### PublicStatus

```ts
type PublicStatus = {
  service: "matchpulse-api";
  ok: true;
  public_api_version: "public-v0";
  demo_available: boolean;
};
```

### PublicMatchSummary

```ts
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

```ts
type PublicMatchState = {
  fixture_id: string;
  identity: {
    fixture_id: string;
    competition: string | null;
    home_team: string | null;
    away_team: string | null;
    start_time_utc: string | null;
    status: string | null;
  };
  scoreboard: {
    available: boolean;
    home_score: number | null;
    away_score: number | null;
    phase?: string | null;
    last_data_received_at?: string | null;
  };
  odds: {
    available: boolean;
    count: number;
    markets?: Array<{
      market_id: string;
      market_name: string | null;
      selection_name: string;
      odds: number;
      direction: string;
      source_timestamp: string | null;
    }>;
  };
  freshness: {
    built_at?: string;
    latest_score_timestamp?: string | null;
    latest_odds_timestamp?: string | null;
    latest_data_timestamp: string | null;
  };
  quality: {
    status: "complete" | "partial" | "empty";
    has_fixture?: boolean;
    has_scoreboard?: boolean;
    has_odds?: boolean;
    issues: string[];
  };
};
```

### PublicReadiness

```ts
type PublicReadiness = {
  status: "ready" | "partial" | "empty";
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

```ts
type PublicBrief = {
  status_label: "ready" | "partial" | "empty";
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

```ts
type PublicSignal = {
  type: string;
  severity: string;
  title: string;
  message: string;
};
```

### PublicSignalSummary

```ts
type PublicSignalSummary = {
  status: "ready" | "partial" | "empty";
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

```ts
type PublicMeta = {
  status: "live" | "no_data" | "stale" | "degraded";
  source: "database";
  mode: "public";
  message?: string;
};
```

### PublicMatchBundle

```ts
type PublicMatchBundle = {
  fixture_id: string;
  readiness: PublicReadiness;
  brief: PublicBrief | null;
  signal_summary: PublicSignalSummary | null;
  signals: PublicSignal[];
  state: PublicMatchState | null;
};
```

## 6. Query Params

### GET `/api/public/matches`

- `range=all|past|upcoming|live`
- `competitionId` optional
- `limit` default `20`, max `100`

### GET `/api/public/matches/:fixtureId`

- `includeOdds` default `true`
- `oddsLimit` default `20`, max `50`
- `staleAfterMinutes` default `60`

### GET `/api/public/matches/:fixtureId/bundle`

- `includeState` default `true`
- `includeSignals` default `true`
- `includeBrief` default `true`
- `oddsLimit` default `20`, max `50`
- `staleAfterMinutes` default `60`

## 7. Known Demo/Test Fixtures

- `17952170` - Slovenia vs Cyprus
  - scoreboard available
  - score `1 - 1`
  - odds missing

- `17588223` - Mexico vs South Korea
  - fixture available
  - odds available
  - scoreboard missing

These are safe fixture references for smoke testing and frontend validation.

## 8. Safety Boundaries

Public API must not expose:

- secrets
- env values
- database URLs
- JWT/API tokens
- wallet/private key data
- internal stack traces
- probability
- confidence
- recommendation
- recommended_bet
- bet
- wager
- stake
- expected_value
- edge
- prediction
- winner
- deposit
- wallet
- payout
- profit

The public API contract is intentionally limited to data availability, freshness, and display-ready state. Any forbidden field must be stripped before the response leaves the backend.

## 9. Frontend Integration Notes

- Use `NEXT_PUBLIC_API_BASE_URL` if available.
- Fallback local API: `http://localhost:4000`.
- Final frontend pages should use `/api/public/*`.
- Demo page may continue using `/api/demo/*`.
- Old `/api/matches` is legacy/mock and not final product data.

Practical rule: the frontend should treat `meta.status` as the first UI decision point, then render the corresponding public-safe view.

## 10. Runtime Smoke Commands

```powershell
curl.exe http://localhost:4000/api/public/status

curl.exe "http://localhost:4000/api/public/matches?range=all&limit=20"

curl.exe "http://localhost:4000/api/public/matches/17952170?includeOdds=true&oddsLimit=20"

curl.exe "http://localhost:4000/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20"

curl.exe http://localhost:4000/api/matches

curl.exe http://localhost:4000/api/demo/matches
```

## 11. Expected Smoke Results

- `/api/public/status` returns `public_api_version: "public-v0"`.
- `/api/public/matches` returns source `database` and mode `public`.
- `17952170` returns scoreboard `1 - 1`.
- `17952170` bundle returns readiness, brief, signals, and state.
- `/api/matches` remains mock.
- `/api/demo/matches` remains demo-bridge `public-demo`.

## 12. Frontend Usage Rules

- Final pages: use `/api/public/*`.
- Demo page: use `/api/demo/*`.
- Do not infer betting, prediction, or recommendation meaning from public responses.
- Do not rely on any internal route shape for final UI state.

