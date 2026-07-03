# SignalCore Agent Logic

## 1. Purpose

SignalCore is an autonomous sports market intelligence agent. It ingests TxLINE match data, score events, and odds, then generates signals, scenario probabilities, confidence scores, risk levels, and post-match evaluations.

The agent must be useful as a standalone Track 1 project and reusable as the intelligence engine behind MatchPulse App.

---

## 2. Safety and Product Boundary

SignalCore must not generate direct betting instructions.

Allowed wording:

- “Scenario probability increased.”
- “Market reaction is strong.”
- “Risk level is high.”
- “The market appears volatile.”
- “This signal has medium confidence.”

Not allowed wording:

- “Bet on Team A.”
- “This is guaranteed.”
- “You will win with this pick.”
- “Place this wager.”

---

## 3. Agent Pipeline

```text
TxLINE Data
  ↓
Data Normalizer
  ↓
Match State Builder
  ↓
Event Detector
  ↓
Odds Movement Detector
  ↓
Signal Generator
  ↓
Scenario Probability Engine
  ↓
Risk & Confidence Engine
  ↓
Learning Graph Logger
  ↓
Post-Match Evaluator
```

---

## 4. Input Data

SignalCore consumes:

- fixtures
- score snapshots
- score updates
- score stream if available
- odds snapshots
- odds updates
- odds stream if available
- historical/replay data

---

## 5. Match State

The agent maintains a normalized match state:

```ts
type AgentMatchState = {
  fixture_id: string;
  minute: number | null;
  phase: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  latest_events: MatchEvent[];
  latest_odds: OddsSnapshot | null;
  previous_odds: OddsSnapshot | null;
  momentum_score: number;
  market_mood: string;
  last_updated: string;
};
```

---

## 6. Event Detector

Detects important events:

- goal
- red card
- yellow card
- penalty
- VAR
- corner
- phase change
- score change
- full time

Each event must be normalized into:

```ts
type NormalizedEvent = {
  type: string;
  team_side: "home" | "away" | "unknown";
  minute: number | null;
  title: string;
  description: string;
  raw: Record<string, unknown>;
};
```

---

## 7. Odds Movement Detector

Detects important market moves.

### Basic Change Formula

```text
change_percent = ((current_odds - previous_odds) / previous_odds) * 100
```

### Initial Thresholds

| Movement | Threshold |
|---|---:|
| Small move | 3% to 7% |
| Medium move | 7% to 15% |
| Sharp move | 15%+ |
| Critical move | 25%+ |

These thresholds are starting values and can be adjusted after evaluation.

---

## 8. Signal Types

## 8.1 GOAL_MARKET_CONFIRMATION

Triggered when:

- goal event exists
- related team odds move strongly in expected direction
- movement happens near the event time

Output example:

```json
{
  "type": "GOAL_MARKET_CONFIRMATION",
  "severity": "high",
  "confidence": 0.82,
  "risk_level": "medium",
  "explanation": "A goal event and strong market movement are aligned."
}
```

## 8.2 SHARP_ODDS_MOVE

Triggered when:

- odds change exceeds sharp threshold
- event may or may not exist

If no matching event exists, risk should be higher.

## 8.3 MARKET_OVERREACTION

Triggered when:

- odds move sharply
- no strong supporting event exists
- movement later corrects or weakens

## 8.4 MOMENTUM_SHIFT

Triggered when:

- score/event/odds indicators shift toward one side
- latest events suggest pressure or control

## 8.5 RED_CARD_IMPACT

Triggered when:

- red card event exists
- odds or scenario probabilities shift strongly

## 8.6 RISK_SPIKE

Triggered when:

- market volatility increases
- odds move without clear supporting data
- confidence drops

---

## 9. Scenario Engine

SignalCore should output multiple scenarios instead of one direct recommendation.

Default scenarios:

1. `Home Team Control`
2. `Away Team Control`
3. `Comeback Pressure`
4. `Market Overreaction`
5. `Volatile / Unclear State`

Example output:

```json
[
  {
    "name": "Home Team Control",
    "probability": 0.62,
    "direction": "up",
    "confidence": 0.74,
    "explanation": "Home team has score advantage and market confirmation."
  },
  {
    "name": "Comeback Pressure",
    "probability": 0.23,
    "direction": "down",
    "confidence": 0.51,
    "explanation": "Away comeback remains possible but market confidence decreased."
  },
  {
    "name": "Market Overreaction",
    "probability": 0.15,
    "direction": "flat",
    "confidence": 0.42,
    "explanation": "The market move is large but aligned with a confirmed event."
  }
]
```

---

## 10. Initial Probability Logic

The first version should be rule-based, not heavy ML.

### Factors

| Factor | Effect |
|---|---|
| Goal by team | increases control scenario for that team |
| Red card against opponent | increases control scenario for non-carded team |
| Sharp odds move in same direction as event | increases confidence |
| Sharp odds move without event | increases risk |
| Late match minute with score advantage | increases control scenario |
| High volatility | increases unclear/overreaction scenario |

### Example Weight System

```ts
const weights = {
  goal: 0.25,
  redCard: 0.18,
  penalty: 0.12,
  oddsConfirmation: 0.22,
  sharpMoveWithoutEvent: -0.12,
  lateGameAdvantage: 0.15,
  volatilityPenalty: -0.1
};
```

The exact values are starting defaults and must be logged as configurable rules.

---

## 11. Confidence Score

Confidence should answer:

> How much should the user trust this signal as a data insight?

Initial factors:

- event quality
- odds movement strength
- event-market alignment
- data freshness
- market volatility
- previous rule accuracy

```text
confidence = normalized(event_strength + market_alignment + data_freshness + historical_rule_accuracy - volatility_penalty)
```

---

## 12. Risk Level

Risk should answer:

> How uncertain or unstable is the current interpretation?

Risk should increase when:

- odds move sharply without a confirmed match event
- data is stale or degraded
- market direction changes rapidly
- confidence is low
- scenario probabilities are close together

Risk levels:

- `low`
- `medium`
- `high`

---

## 13. Learning Graph

SignalCore should store relationships like:

```text
Event → Market Reaction → Signal → Scenario → Actual Outcome → Weight Update
```

Example:

```text
Goal by Team A
  → Odds drop 28%
  → GOAL_MARKET_CONFIRMATION
  → Team A Control 78%
  → Team A wins
  → Increase goal+market alignment weight
```

Learning graph does not need complex ML in MVP. It can be rule-based weight adjustment with transparent logs.

---

## 14. Post-Match Evaluation

After match finishes, evaluate pending predictions.

Metrics:

- total predictions
- correct predictions
- incorrect predictions
- partial predictions
- accuracy
- strongest rule
- weakest rule
- weight adjustments

Example output:

```json
{
  "fixture_id": "18175918",
  "total_predictions": 12,
  "correct_predictions": 8,
  "incorrect_predictions": 3,
  "partial_predictions": 1,
  "accuracy": 0.67,
  "best_rule": "goal + odds confirmation",
  "weakest_rule": "isolated odds spike",
  "adjustment_summary": "Reduced weight for sharp odds movement without supporting match event."
}
```

---

## 15. Replay Mode

Replay mode must:

- load historical or seeded events
- simulate live progression
- run the same agent logic
- generate signals in sequence
- update scenario probabilities
- produce final post-match evaluation

Replay is required because judges may review the project when no live match is active.

---

## 16. MVP Agent Definition of Done

SignalCore is MVP-complete when:

1. It can load at least one match.
2. It can read raw score and odds data.
3. It can generate at least 4 signal types.
4. It can output scenario probabilities.
5. It can output risk and confidence scores.
6. It can show a signal feed in the technical dashboard.
7. It can run replay mode.
8. It can perform post-match evaluation on replay data.
9. It never outputs direct betting instructions.

