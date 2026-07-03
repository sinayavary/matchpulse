# Mock Data Specification

## 1. Purpose

Mock data lets frontend and backend work in parallel before TxLINE integration is complete.

The frontend must be able to build all core screens from `/mock-data` files.

---

## 2. Files

```text
mock-data/
  matches.json
  match-state.json
  raw-data.json
  odds.json
  timeline.json
  signals.json
  scenarios.json
  learning-graph.json
  evaluation.json
  replay-state.json
  telegram-status.json
```

---

## 3. Rules

1. Use the same `fixture_id` across all files.
2. Use realistic team names and match minutes.
3. Include at least one goal event.
4. Include at least one odds shift.
5. Include at least one sharp market movement signal.
6. Include scenario probabilities that sum to 1.0.
7. Include both live and replay statuses.
8. Include an example stale status for UI testing.
9. No mock text should say “bet on this team” or guarantee winning.

---

## 4. Suggested Fixture

Use this demo fixture:

```json
{
  "fixture_id": "demo-arg-cpv-001",
  "home_team": "Argentina",
  "away_team": "Cape Verde",
  "competition": "World Cup",
  "stage": "Round of 32"
}
```

---

## 5. Required UI States

Mock data must support these frontend states:

- loading
- live
- replay
- stale
- no_data
- error
- empty timeline
- active signal
- post-match evaluation

---

## 6. Example Signal

```json
{
  "id": "sig_001",
  "fixture_id": "demo-arg-cpv-001",
  "timestamp": "2026-07-03T18:34:00Z",
  "minute": 63,
  "type": "GOAL_MARKET_CONFIRMATION",
  "title": "Goal and market reaction aligned",
  "severity": "high",
  "confidence": 0.82,
  "risk_level": "medium",
  "related_event_id": "evt_003",
  "explanation": "Argentina scored and the market moved strongly in the same direction.",
  "technical_reasoning": [
    "Goal event detected at 63'",
    "Argentina odds moved from 1.85 to 1.32",
    "Market movement exceeded the sharp threshold",
    "Event and market direction are aligned"
  ]
}
```

---

## 7. Example Scenarios

```json
[
  {
    "id": "scn_001",
    "fixture_id": "demo-arg-cpv-001",
    "timestamp": "2026-07-03T18:34:00Z",
    "name": "Argentina controls the match",
    "probability": 0.78,
    "previous_probability": 0.62,
    "direction": "up",
    "confidence": 0.76,
    "explanation": "Goal advantage and market confirmation increased Argentina's control scenario."
  },
  {
    "id": "scn_002",
    "fixture_id": "demo-arg-cpv-001",
    "timestamp": "2026-07-03T18:34:00Z",
    "name": "Cape Verde comeback pressure",
    "probability": 0.12,
    "previous_probability": 0.23,
    "direction": "down",
    "confidence": 0.48,
    "explanation": "The comeback scenario decreased after the goal and odds movement."
  },
  {
    "id": "scn_003",
    "fixture_id": "demo-arg-cpv-001",
    "timestamp": "2026-07-03T18:34:00Z",
    "name": "Market overreaction",
    "probability": 0.10,
    "previous_probability": 0.15,
    "direction": "down",
    "confidence": 0.42,
    "explanation": "The market move is large, but it is supported by a confirmed goal event."
  }
]
```



## Telegram Mock Data

Add `telegram-status.json` to support frontend Telegram UI before backend bot is complete.

```json
{
  "enabled": true,
  "bot_username": "@matchpulse_demo_bot",
  "subscribed_fixtures": ["18175918"],
  "last_alert_preview": {
    "type": "SHARP_ODDS_MOVE",
    "message": "Sharp market movement detected for Argentina vs Cape Verde. Risk level: medium."
  }
}
```

Do not create leaderboard mock data for MVP.
