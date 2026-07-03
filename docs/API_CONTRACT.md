# MatchPulse API Contract

## 1. Purpose

This file defines the contract between backend and frontend. Frontend must be able to build against this contract using mock data before the real TxLINE integration is complete.

All backend responses must follow the same wrapper format:

```json
{
  "data": {},
  "meta": {
    "status": "live",
    "last_updated": "2026-07-03T12:34:56Z",
    "seconds_since_update": 12,
    "source": "txline",
    "mode": "live"
  }
}
```

---

## 2. Shared Meta Object

```ts
type ApiMeta = {
  status: "live" | "reconnecting" | "degraded" | "stale" | "no_data" | "replay" | "error";
  last_updated: string | null;
  seconds_since_update: number | null;
  source: "txline" | "mock" | "replay" | "internal";
  mode: "live" | "replay" | "mock";
  message?: string;
};
```

### Status Meaning

| Status | Meaning | Frontend Behavior |
|---|---|---|
| `live` | Data is fresh and valid | Green live badge |
| `reconnecting` | Worker is reconnecting but recent data exists | Yellow updating badge |
| `degraded` | Stream failed; backend uses polling fallback | Yellow delayed badge |
| `stale` | Data is old but last valid state exists | Orange/Red stale banner |
| `no_data` | No data for fixture | Empty state |
| `replay` | Data is from replay mode | Demo/Replay badge |
| `error` | Controlled failure | Friendly error state |

---

## 3. Common Types

### MatchSummary

```ts
type MatchSummary = {
  fixture_id: string;
  competition: string;
  stage: string;
  start_time_utc: string;
  home_team: string;
  away_team: string;
  status: "NS" | "H1" | "HT" | "H2" | "F" | "ET" | "PEN" | "POSTPONED" | "UNKNOWN";
  is_live: boolean;
  score: {
    home: number | null;
    away: number | null;
  };
  has_odds: boolean;
  latest_signal_type?: string;
  market_mood?: "home_favored" | "away_favored" | "balanced" | "volatile" | "unknown";
};
```

### MatchState

```ts
type MatchState = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  minute: number | null;
  phase: string;
  score: {
    home: number;
    away: number;
  };
  raw_game_state: Record<string, unknown>;
  last_event?: MatchEvent;
  market_mood: string;
  momentum: MomentumState;
};
```

### MatchEvent

```ts
type MatchEvent = {
  id: string;
  fixture_id: string;
  minute: number | null;
  timestamp: string;
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "PENALTY" | "VAR" | "CORNER" | "PHASE_CHANGE" | "ODDS_SHIFT" | "OTHER";
  team: "home" | "away" | "unknown";
  title: string;
  description: string;
  raw: Record<string, unknown>;
};
```

### OddsSnapshot

```ts
type OddsSnapshot = {
  fixture_id: string;
  timestamp: string;
  markets: Array<{
    market_id: string;
    market_name: string;
    selections: Array<{
      name: string;
      odds: number;
      previous_odds?: number;
      change_percent?: number;
      direction?: "up" | "down" | "flat";
    }>;
  }>;
};
```

### Signal

```ts
type Signal = {
  id: string;
  fixture_id: string;
  timestamp: string;
  minute: number | null;
  type: "GOAL_MARKET_CONFIRMATION" | "SHARP_ODDS_MOVE" | "MARKET_OVERREACTION" | "MOMENTUM_SHIFT" | "RED_CARD_IMPACT" | "PENALTY_IMPACT" | "RISK_SPIKE" | "OTHER";
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  risk_level: "low" | "medium" | "high";
  related_event_id?: string;
  explanation: string;
  technical_reasoning: string[];
};
```

### Scenario

```ts
type Scenario = {
  id: string;
  fixture_id: string;
  timestamp: string;
  name: string;
  probability: number;
  previous_probability?: number;
  direction: "up" | "down" | "flat";
  confidence: number;
  explanation: string;
};
```

---

## 4. Public App Endpoints

### GET /api/health

Returns backend health.

```json
{
  "data": {
    "service": "matchpulse-api",
    "ok": true,
    "version": "0.1.0"
  },
  "meta": {
    "status": "live",
    "last_updated": "2026-07-03T12:34:56Z",
    "seconds_since_update": 0,
    "source": "internal",
    "mode": "live"
  }
}
```

### GET /api/matches

Returns all available matches.

```ts
type Response = {
  data: MatchSummary[];
  meta: ApiMeta;
};
```

### GET /api/matches/live

Returns live or currently watched matches.

```ts
type Response = {
  data: MatchSummary[];
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId

Returns current match state.

```ts
type Response = {
  data: MatchState;
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/raw

Returns normalized raw data for the selected fixture.

```ts
type Response = {
  data: {
    fixture: Record<string, unknown>;
    score: Record<string, unknown> | null;
    odds: Record<string, unknown> | null;
    latest_events: MatchEvent[];
  };
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/timeline

Returns event timeline.

```ts
type Response = {
  data: MatchEvent[];
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/odds

Returns current odds and latest movements.

```ts
type Response = {
  data: OddsSnapshot;
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/signals

Returns agent signals for a fixture.

```ts
type Response = {
  data: Signal[];
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/scenarios

Returns current scenario probabilities.

```ts
type Response = {
  data: Scenario[];
  meta: ApiMeta;
};
```

### GET /api/matches/:fixtureId/recap

Returns match recap or current summary.

```ts
type Response = {
  data: {
    fixture_id: string;
    summary: string;
    key_turning_point?: string;
    biggest_market_move?: string;
    agent_accuracy?: number;
    risk_summary?: string;
  };
  meta: ApiMeta;
};
```

---

## 5. Agent-Specific Endpoints

### GET /api/agent/health

Returns SignalCore status.

```ts
type Response = {
  data: {
    agent_status: "running" | "paused" | "error";
    watched_fixtures: string[];
    last_heartbeat: string;
    mode: "live" | "replay" | "mock";
  };
  meta: ApiMeta;
};
```

### GET /api/agent/signals

Returns global signal feed.

```ts
type Response = {
  data: Signal[];
  meta: ApiMeta;
};
```

### GET /api/agent/evaluation

Returns evaluation summary.

```ts
type Response = {
  data: {
    total_predictions: number;
    correct_predictions: number;
    incorrect_predictions: number;
    accuracy: number;
    best_rule: string | null;
    weakest_rule: string | null;
    latest_adjustments: string[];
  };
  meta: ApiMeta;
};
```

### GET /api/agent/learning-graph

Returns graph nodes and edges.

```ts
type Response = {
  data: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label: string; weight?: number }>;
  };
  meta: ApiMeta;
};
```

---

## 6. Replay Endpoints

### POST /api/replay/start

Starts replay session.

Request:

```json
{
  "fixture_id": "18175918",
  "speed": 2
}
```

Response:

```json
{
  "data": {
    "session_id": "replay_001",
    "fixture_id": "18175918",
    "status": "started"
  },
  "meta": {
    "status": "replay",
    "last_updated": "2026-07-03T12:34:56Z",
    "seconds_since_update": 0,
    "source": "replay",
    "mode": "replay"
  }
}
```

### GET /api/replay/:sessionId

Returns replay state.

```ts
type Response = {
  data: {
    session_id: string;
    fixture_id: string;
    replay_minute: number;
    is_running: boolean;
    current_state: MatchState;
    timeline: MatchEvent[];
    signals: Signal[];
    scenarios: Scenario[];
  };
  meta: ApiMeta;
};
```

---

## 7. Watchlist and Telegram Alerts

### POST /api/watchlist

Adds a match to watchlist.

Request:

```json
{
  "fixture_id": "18175918",
  "user_id": "demo_user"
}
```

### GET /api/watchlist

Returns watched matches for demo user.

### POST /api/telegram/webhook

Telegram webhook endpoint. Required for MVP.

### GET /api/telegram/status

Returns bot connection/status info for the demo user.

```ts
type Response = {
  data: {
    enabled: boolean;
    bot_username?: string;
    subscribed_fixtures: string[];
  };
  meta: ApiMeta;
};
```

### POST /api/telegram/subscribe

Subscribes demo user/chat to match alerts.

Request:

```json
{
  "fixture_id": "18175918",
  "chat_id": "demo_chat"
}
```

### POST /api/telegram/unsubscribe

Unsubscribes demo user/chat from match alerts.

---

## 8. Frontend Polling Rules

For MVP:

- Match page polls `/api/matches/:fixtureId` every 10-20 seconds.
- Timeline polls `/api/matches/:fixtureId/timeline` every 10-20 seconds.
- Signals poll `/api/matches/:fixtureId/signals` every 10-20 seconds.
- Replay page polls `/api/replay/:sessionId` every 1-3 seconds.

No frontend should call TxLINE directly.



## 9. Explicitly Not Included in MVP

Do not implement these endpoints for MVP unless all core work is complete:

- leaderboard endpoints
- prize endpoints
- reward endpoints
- betting execution endpoints
- wallet connect endpoints for normal users
- payment endpoints

Normal users should not need a wallet. Wallet/keypair use is only for TxLINE activation and technical dashboard visibility.
