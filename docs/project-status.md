# MatchPulse — Project Status

Current state of the MatchPulse / SignalCore monorepo.

---

## Completed

### Backend Pipeline

| Component | Status | Description |
|-----------|--------|-------------|
| TxLINE activation/wrappers | ✅ Done | Solana wallet activation, JWT authentication, TxLINE client wrappers for devnet |
| Fixture ingestion | ✅ Done | Normalizes and persists fixture data from TxLINE |
| Score ingestion | ✅ Done | Normalizes and persists score snapshots from TxLINE |
| Odds ingestion | ✅ Done | Normalizes and persists odds snapshots with PascalCase field mapping |
| Odds discovery | ✅ Done | Single-day and day-range odds availability discovery |
| DB-backed match state builder | ✅ Done | Assembles canonical match state from persisted data |
| Ingestion runner | ✅ Done | Orchestrates the full ingestion pipeline for a fixture |
| SignalCore contract | ✅ Done | Defines the signal schema and forbidden field assertions |
| SignalCore v0 | ✅ Done | Produces categorized data-quality signals from match state |
| Agent Presenter v0 | ✅ Done | Generates natural-language briefs from signals and state |
| Internal Demo Bundle | ✅ Done | Assembles composite bundle response (state + signals + brief) |
| Safe Public Demo Bridge | ✅ Done | Allowlisted fixtures, sanitized output, separate from internal routes |

### Frontend

| Component | Status | Description |
|-----------|--------|-------------|
| `/demo` page | ✅ Done | Client-side React page with phase state machine |
| Demo API helper | ✅ Done | `fetchDemoMatches()` and `fetchDemoBundle()` — only calls public demo bridge |
| Match Selector | ✅ Done | Select from curated demo fixtures |
| Match Intelligence Card | ✅ Done | Readiness overview and key flags |
| Agent Brief | ✅ Done | Natural-language briefing display |
| Signal Feed | ✅ Done | Categorized data-quality signals |
| Data Quality Panel | ✅ Done | Structured readiness breakdown |
| Raw JSON Toggle | ✅ Done | Full API response for transparency |
| Scoreboard mapping patch | ✅ Done | Correct field mapping for scoreboard display |

### Public Demo Routes

| Route | Status |
|-------|--------|
| `GET /api/demo/matches` | ✅ Live |
| `GET /api/demo/matches/:fixtureId/bundle` | ✅ Live |

### Demo Fixtures

| Fixture | Teams | Expected Data |
|---------|-------|---------------|
| 17952170 | Slovenia vs Cyprus | Scoreboard available (1–1), odds missing |
| 17588223 | Mexico vs South Korea | Odds available, scoreboard missing |

---

## Not Built Yet

| Feature | Notes |
|---------|-------|
| Production deployment | No Vercel/Railway deployment configured |
| Full match browser | No DB-backed browse-all-matches UI |
| Automated worker/scheduler | Ingestion is manual/script-driven, not automated |
| Watchlist persistence | No persistent watchlist feature |
| Telegram alerts | No Telegram integration |
| Final UI polish | CSS/styling is functional but not production-grade |
| Real authentication | No user accounts or auth system |

---

## Intentionally Out of Scope

These are **not** part of MatchPulse and will not be built:

| Category | Reason |
|----------|--------|
| Betting mechanics | No wagers, bet buttons, or bookmaker links |
| Wallet / payment | No wallet connect, deposits, or payouts |
| Predictions | No match outcome predictions |
| Recommendations | No action recommendations or betting advice |
| Probability / confidence / edge / EV | No numerical advantage calculations |

---

## Safety Enforcement

All demo output passes through `assertNoForbiddenSignalFields` which rejects:
- Any field that could be interpreted as betting guidance
- Probability, confidence, edge, or expected-value content
- Prediction or recommendation content

The public demo bridge uses a **hardcoded allowlist** of two fixtures. The frontend calls **only** `/api/demo/*` routes — internal routes are never accessible from the browser.
