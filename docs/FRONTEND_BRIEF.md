# Frontend Developer Brief

## 1. Responsibility

Frontend owns:

- visual product experience
- MatchPulse user app
- SignalCore technical dashboard
- replay interface
- status handling
- responsive UI

---

## 2. Design Direction

Style: modern sports app + clearly visible Web3/Solana feel.

Visual tone:

- dark background
- neon or gradient accents
- sharp data cards
- live badges
- dashboard feel
- simple but premium
- visible Solana/TxLINE data-source layer
- on-chain anchored data badges where appropriate

Language: English.

---

## 3. Required Pages

### Public/User Product

- Landing Page
- Matches Page
- Live Match Intelligence Room
- Replay Page
- Watchlist Page, simple
- Telegram Alerts / Connect Page

### Agent Track Dashboard

- SignalCore Dashboard
- Signal Feed
- Scenario View
- Learning Graph
- Evaluation Report

---

## 4. Core Components

- Live Score Card
- Match Status Badge
- Data Freshness Banner
- Raw Data Panel
- Odds Panel
- Odds Movement Card
- Agent Insight Card
- Scenario Cards
- Risk Level Card
- Confidence Meter
- Momentum Meter
- Timeline Item
- Signal Feed Item
- Prediction History Table
- Replay Controls
- Agent Accuracy Card
- Learning Graph View
- Disclaimer Footer
- Solana / TxLINE Source Badge
- Wallet/Network Status Card for technical dashboard only

---

## 5. Required UI States

Every major component should handle:

- loading
- live
- replay
- degraded
- stale
- no_data
- error

---

## 6. Frontend Data Rule

Frontend must never call TxLINE directly.

All data comes from backend API or local mock data.

---

## 7. MVP User Flow

1. User opens landing page.
2. User opens matches page.
3. User selects a match.
4. User sees raw score/odds data.
5. User sees SignalCore analysis.
6. User sees scenario probabilities.
7. User sees risk/confidence.
8. User opens replay mode.
9. Replay shows timeline, signals, and scenario changes.
10. User sees post-match evaluation.
11. User can connect to Telegram alerts.
12. User sees the Solana/Web3 data-source layer clearly.

---

## 8. Do Not Build First

Do not build these before MVP:

- live chat
- voice commentary
- complex login
- user wallet connect for normal users
- full multiplayer presence
- payment UI
- betting buttons



## 9. MVP Exclusions Update

Leaderboard is not required for MVP because there are no prizes or reward competition. Do not build leaderboard unless all core features are finished.

Telegram alerts are required for MVP.

## 10. Web3/Solana Visibility Requirements

The UI should clearly communicate:

- data is powered by TxLINE / TxODDS
- data is connected to Solana/on-chain anchoring
- normal users do not need a wallet
- the technical dashboard may show devnet/mainnet and activation status
- the product is sports intelligence, not a betting execution product
