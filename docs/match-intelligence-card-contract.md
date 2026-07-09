# Match Intelligence Card Contract

## 1. Purpose

The Match Intelligence Card is the main safe user-facing product surface for match status, data quality, pressure context, freshness, and odds reliability.

It is designed as a sports intelligence card, not a betting product. The card may help users understand what match data is available and how complete or limited that data is, but it must never present wagering advice, pick selection, or prediction language.

## 2. Data Source

The card is sourced from the internal Agent Presenter route:

```text
/api/internal/agent/matches/:fixtureId/brief?includePressure=true&includeOddsReliability=true
```

This route is currently internal only. It is not a public API contract yet, and this document does not change that boundary.

## 3. Allowed Display Sections

The frontend may render these sections for the Match Intelligence Card:

```text
Match Header
Score / State Summary
Data Readiness
Freshness
Pressure Hint
Odds Reliability Hint
Quality Notes
Safe Scope Note
```

These sections should remain neutral, descriptive, and focused on availability and quality rather than outcome guidance.

## 4. Allowed Fields

The frontend may display the following fields from the internal presenter response:

```text
fixture_id
agent_version
brief.status_label
brief.headline
brief.overview
brief.available_data
brief.missing_data
brief.freshness_note
brief.quality_notes
brief.safe_scope_note
signal_summary.status
signal_summary.has_fixture
signal_summary.has_scoreboard
signal_summary.has_odds
signal_summary.latest_data_timestamp
pressure_hint.label
pressure_hint.level
pressure_hint.source
pressure_hint.evidence_count
pressure_hint.limitations
pressure_hint.safe_scope_note
odds_reliability_hint.label
odds_reliability_hint.status
odds_reliability_hint.source
odds_reliability_hint.snapshot_count
odds_reliability_hint.market_count
odds_reliability_hint.provider_count
odds_reliability_hint.latest_timestamp
odds_reliability_hint.limitation_count
odds_reliability_hint.safe_scope_note
```

Display guidance for these fields:

- Use them as status, availability, freshness, and coverage metadata.
- Treat counts as coverage indicators only.
- Do not infer betting strength, outcome likelihood, or recommendation quality from any count.
- Do not rename the data into wagering language.

## 5. Forbidden Display Fields

The frontend must not display or request any of the following:

```text
probability
prediction
confidence
winner
recommended_bet
bet
wager
stake
expected_value
edge
profit
payout
wallet
deposit
formula
raw_payload
debug_lineage
primary_side
pressure_score
adapter_status
raw odds rows
internal model details
secrets
```

These fields are out of scope for the card and must remain hidden from the frontend by default.

## 6. UX Wording Rules

Use safe labels such as:

```text
Data ready
Data partial
Odds data unavailable
Odds data limited
Odds data available
Pressure hint available
Limited pressure hint
Latest data timestamp
```

Avoid wording such as:

```text
Bet now
Best pick
Likely winner
High confidence
Market edge
Expected value
Guaranteed
Prediction
Win chance
```

Additional wording rules:

- Prefer neutral, factual language.
- Show unavailable and limited states directly.
- If a hint is absent, hide the section or render an explicit unavailable state.
- Never convert reliability metadata into betting advice.

## 7. Safe Example Payload

Example safe payload for fixture `17588223` using verified runtime values:

```json
{
  "fixture_id": "17588223",
  "agent_version": "presenter-v0",
  "brief": {
    "status_label": "partial",
    "headline": "Match data is partially available.",
    "overview": "Some persisted match data is available, but the full match view is incomplete.",
    "available_data": ["Odds data is available."],
    "missing_data": ["Fixture identity is missing.", "Scoreboard data is missing."],
    "freshness_note": "Latest persisted data is older than the freshness window.",
    "quality_notes": [],
    "safe_scope_note": "This brief only describes data availability, freshness, and quality for safe display."
  },
  "odds_reliability_hint": {
    "label": "odds_data_limited",
    "status": "limited",
    "source": "database",
    "snapshot_count": 64,
    "market_count": 31,
    "provider_count": 1,
    "latest_timestamp": "2026-06-12T00:46:20.916Z",
    "limitation_count": 2,
    "safe_scope_note": "This is a data-quality hint about stored odds availability, coverage, and freshness. It is not a prediction, probability, betting recommendation, expected value, or wagering instruction."
  }
}
```

This example intentionally omits raw odds values, raw odds rows, debug lineage, formulas, and any betting-related outputs.

## 8. Frontend Implementation Notes

Frontend developers should follow these rules when implementing the Match Intelligence Card:

- The card should look like a professional sports intelligence panel.
- Use badges for status.
- Use neutral language throughout.
- Show unavailable and limited states clearly.
- Show counts as data coverage, not betting strength.
- Do not infer predictions from counts.
- Do not convert reliability status into betting advice.
- Hide absent hints gracefully.
- Do not show raw internal `signals` by default unless explicitly approved later.

Suggested presentation behavior:

- Match Header can show fixture identity and a compact title.
- Score / State Summary can show current state or a safe fallback when unavailable.
- Data Readiness should describe whether the card is complete, partial, or limited.
- Freshness should show the latest data timestamp in a clear, non-technical format.
- Pressure Hint should be phrased as a hint about pressure context only.
- Odds Reliability Hint should be phrased as a data-quality and coverage indicator only.
- Quality Notes should summarize visible issues without implying outcome guidance.
- Safe Scope Note should remind users that the card is not a betting product.

## 9. Acceptance Criteria

This contract is accepted when all of the following are true:

- It defines the allowed fields.
- It defines the forbidden fields.
- It defines the card sections.
- It includes one safe example payload.
- It confirms that no public API is changed.
- It confirms that no frontend code is changed.
- It gives clear frontend handoff instructions.
- It keeps MatchPulse positioned as sports intelligence, not a betting execution product.

## 10. Change Boundary

This phase is documentation only.

- No frontend code is changed.
- No public API routes are changed.
- No backend runtime logic is changed.
- No Prisma schema changes are made.
- No migrations are added.
- No Telegram changes are made.
- No new API routes are created.

## 11. Frontend Handoff Notes

The frontend team should treat this contract as the display boundary for the Match Intelligence Card:

- Render only the allowed fields listed above.
- Keep the card product-safe and non-promotional.
- Prefer compact status chips and readable coverage copy.
- Preserve internal-only boundaries for raw data, model details, and source payloads.
- Wait for a later approved phase before exposing any raw signals or additional internals.

