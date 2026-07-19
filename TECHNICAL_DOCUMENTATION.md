# MatchPulse — Technical Documentation

## Core Idea

MatchPulse is an API-first engine that ingests, normalizes, and analyzes near-real-time football match data from TxLINE, converting it into explainable, public-safe scenario intelligence — without exposing raw payloads, odds formulas, or model internals.

## Business Value & Technical Highlights

- Built on TxLINE's Service Level 12 (mainnet, World Cup + International Friendlies) with free real-time upstream access — giving MatchPulse a verifiable data-trust layer competitors without proof-based validation cannot replicate.
- Monetizable via tiered API access, B2B licensing, and bulk data feeds for sports media, analytics teams, and fan platforms.
- Reliability-first pipeline: every data point is scored for freshness, completeness, and consensus before being used.
- Public/internal security boundary strictly separates raw provider data from sanitized public output.
- Wallet-based developer identity (off-chain, no transactions required) for free API access.

## TxLINE Endpoints Used

### Auth
Required before any of the endpoints below.
- `POST /auth/guest/start`
- `POST /api/token/activate`

### Ingestion (fixture / score / odds current state)
- `GET /api/fixtures/snapshot`
- `GET /api/scores/snapshot/{fixtureId}`
- `GET /api/odds/snapshot/{fixtureId}`

### Incremental Updates / History (replay & backtest)
- `GET /api/fixtures/updates/{epochDay}/{hourOfDay}`
- `GET /api/scores/historical/{fixtureId}`

### Live Stream
TxLINE upstream feed, powering MatchPulse's near-real-time ingestion worker.
- `GET /api/scores/stream`
- `GET /api/odds/stream`

### Proof & Verification (data trust layer)
- `GET /api/fixtures/validation`
- `GET /api/fixtures/batch-validation`
- `GET /api/scores/stat-validation`
- `GET /api/odds/validation`
