# Frontend Developer / AI Agent Prompt

Use this prompt for the frontend developer or for an AI coding agent working on the frontend side of the project.

---

## Role

You are the frontend engineer for a hackathon project with two separate submissions:

1. **Track 1:** `SignalCore Agent` — a standalone technical agent dashboard.
2. **Track 2:** `MatchPulse App` — a user-facing sports intelligence application.

Final naming may change later. Use `SignalCore` and `MatchPulse` as working names only.

---

## Product Context

We are building a real-time World Cup intelligence interface powered by TxLINE / TxODDS data and a backend agent called SignalCore.

The UI must clearly combine:

- modern sports analytics
- live match data
- market odds movement
- AI/agent scenario insights
- Solana/Web3/on-chain data-source identity
- Telegram alert connection

The product must **not** look like a betting site. It must not include bet buttons, wager flows, deposit flows, or betting recommendations. It is a sports intelligence and market insight product.

---

## Required Files to Read First

Before designing or coding, read:

```text
PROJECT_SCOPE.md
API_CONTRACT.md
DATA_MODEL.md
AGENT_LOGIC.md
MOCK_DATA_SPEC.md
ROADMAP.md
TASK_BOARD.md
COMPLIANCE_GUIDELINES.md
FRONTEND_BRIEF.md
UPDATED_DECISIONS.md
```

Use mock data from:

```text
mock-data/
```

---

## Non-Negotiable Decisions

- One monorepo.
- Product language: English.
- Telegram alerts are part of MVP.
- Leaderboard is not part of MVP.
- No direct betting UI.
- No wallet connection for normal users.
- Frontend must never call TxLINE directly.
- Frontend consumes backend API only.
- Every component must handle `meta.status`.
- The Solana/Web3 layer must be visually clear.

---

## Recommended Frontend Stack

Use this unless the team explicitly changes it:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
lucide-react
Recharts or lightweight chart library
```

Design style:

```text
Modern sports app + Solana/Web3 dashboard
Dark UI
Neon/gradient accents
Data cards
Live badges
On-chain/source badges
Clean analytics layout
Mobile responsive
```

---

## Monorepo Location

Frontend should live at:

```text
apps/web
```

Shared types should come from:

```text
packages/shared
```

Mock data can be imported from:

```text
mock-data
```

---

## Required Pages — P0

Build these pages first:

```text
/                         Landing page
/matches                  Matches page
/matches/[fixtureId]      Live Match Intelligence Room
/replay                   Replay page
/agent                    SignalCore technical dashboard
/telegram                 Telegram alerts/connect page
```

Optional after MVP:

```text
/watchlist
/about
/docs
```

Do not build leaderboard page in MVP.

---

## Required Components — P0

Build reusable components:

```text
LiveScoreCard
MatchStatusBadge
DataFreshnessBanner
RawDataPanel
OddsPanel
OddsMovementCard
AgentInsightCard
ScenarioCards
RiskLevelCard
ConfidenceMeter
MomentumMeter
TimelineItem
SignalFeedItem
PredictionHistoryTable
ReplayControls
AgentAccuracyCard
LearningGraphView
DisclaimerFooter
SolanaTxLineSourceBadge
TelegramConnectCard
NetworkStatusCard
```

---

## Required UI States

Every major page/component must handle:

```text
loading
live
replay
degraded
stale
no_data
error
```

Status mapping suggestion:

```text
live: green / active pulse
replay: purple / demo badge
degraded: yellow / delayed data
stale: orange-red / old data warning
no_data: neutral empty state
error: red controlled error message
```

---

## Backend API Response Format

Every backend response follows:

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

Frontend must use `meta` to show freshness/source status.

---

## User-Facing Product Flow

MVP flow:

1. User opens landing page.
2. User sees product as a sports intelligence layer powered by TxLINE and Solana.
3. User opens matches page.
4. User selects a match.
5. User sees live/raw score and odds data.
6. User sees SignalCore insights.
7. User sees scenario probabilities.
8. User sees risk and confidence levels.
9. User sees market reaction and momentum.
10. User opens replay mode.
11. Replay shows historical/demo events like a live match.
12. User sees post-match evaluation.
13. User can connect to Telegram alerts.

---

## Track 1 UI — SignalCore Dashboard

The Agent dashboard must work even if the user-facing app did not exist.

It should show:

```text
Agent status
Network status: devnet/mainnet
TxLINE source status
Watched matches
Raw data feed
Signal feed
Scenario probabilities
Risk/confidence panel
Learning graph
Post-match evaluation
Replay controls
Telegram alert status
```

This dashboard is for technical judges.

It should feel:

```text
technical
credible
clear
not over-designed
```

---

## Track 2 UI — MatchPulse App

The user app must feel like a real consumer sports intelligence product.

It should show:

```text
Live Match Room
Raw Data Panel
Odds Panel
Agent Insights Panel
Scenario Cards
Market Reaction Card
Momentum Meter
Risk Level Card
Prediction History
Replay Mode
Watchlist button, simple
Telegram alert CTA
Disclaimer
Solana/TxLINE source badges
```

It should feel:

```text
modern
sports-focused
Web3/Solana-aware
fast
premium
safe/compliant
```

---

## Compliance UI Requirements

Include a short disclaimer in relevant places:

```text
MatchPulse provides informational sports intelligence and market insights. It does not place bets, execute wagers, or provide financial advice.
```

Avoid these words in CTA buttons:

```text
Bet
Wager
Stake
Guaranteed
Win now
Profit
Lock
Sure pick
```

Use safer words:

```text
View Insight
Analyze Match
Follow Signal
Review Scenario
Track Market Move
Open Replay
Connect Alerts
```

---

## Web3/Solana Visibility Requirements

The UI must clearly show that this is built on Web3/Solana data infrastructure.

Add visual elements like:

```text
Powered by TxLINE / TxODDS
Solana anchored data badge
Network: Devnet / Mainnet badge
Data source status card
On-chain verification coming soon / available where implemented
Wallet not required for users
```

Important:

- Do not make normal users connect wallet.
- Only technical dashboard can show wallet/network activation details.

---

## Telegram UI Requirements

Telegram page/card should include:

```text
What alerts user receives
How to connect bot
Supported commands
Alert preview cards
Risk/confidence note
Disclaimer
```

Telegram alert preview example:

```text
⚡ SignalCore Alert
Signal: Sharp Market Move
Scenario: Team A control increased to 72%
Risk: Medium
Informational insight only, not betting advice.
```

---

## Implementation Order

Follow this order:

1. Next.js + Tailwind + shadcn setup.
2. Theme tokens: dark sports + Solana accents.
3. Mock data loader.
4. Shared API client wrapper.
5. Layout shell.
6. Landing page.
7. Matches page.
8. Match room page using mock data.
9. Core cards/components.
10. Agent dashboard using mock data.
11. Replay page using mock data.
12. Telegram connect page.
13. Connect pages to backend API.
14. Add status/freshness banners.
15. Responsive polish.
16. Error/loading/empty state pass.
17. Final demo flow polish.

---

## Quality Rules

- Use TypeScript strictly.
- No hardcoded backend URLs except environment config.
- Use shared types where available.
- Do not call TxLINE directly.
- Do not expose secrets.
- Every major component must handle missing data.
- Every major component must be responsive.
- Prioritize clarity over fancy animation.
- Use charts only where they explain signals/odds/scenarios.
- Keep UI English-only for MVP.

---

## Acceptance Criteria

Frontend MVP is done when:

- Landing page explains product clearly.
- Matches page works with mock/backend data.
- Match room shows raw data + odds + agent insights.
- Scenario cards are visible and understandable.
- Risk/confidence is visible.
- Agent dashboard works standalone.
- Replay page works without live match.
- Telegram page/card exists.
- Solana/TxLINE/Web3 identity is visually obvious.
- No betting execution UI exists.
- All states are handled: loading, live, replay, stale, no_data, error.

---

## What Not To Build First

Do not build:

```text
Leaderboard
Live chat
Voice commentary
Complex login
Wallet connect for normal users
Payment UI
Betting button
Deposit/withdraw UI
Full multiplayer presence
Full proof viewer before MVP
```

---

## First Response Expected From Developer / AI Agent

When you start, first output:

1. Proposed page/component structure.
2. Design system direction.
3. The first 10 components/pages you will implement.
4. Any backend/API assumptions.
5. Any blockers.

Then begin implementation.
