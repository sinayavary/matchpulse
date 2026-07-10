# 01 — Canonical Product Goal and Boundaries

## 1. Product Definition

MatchPulse is a production-shaped, English-language, real-time football intelligence platform powered by TxLINE data.

It transforms verified match state, events, scores, and market data into:

- live scenario probabilities
- market reliability assessments
- event-impact analysis
- momentum and pressure context
- prediction history
- post-match evaluation
- replayable intelligence timelines
- safe alerts
- data provenance and verification indicators

It is not a betting execution product.

## 2. Primary User

A football viewer who wants a concise answer to:

- What is happening now?
- Which side currently controls the match context?
- How did a major event change the model?
- Is the available market data reliable enough to use as evidence?
- How uncertain is the model?
- What changed since the previous update?
- Can the raw data be traced to TxLINE/Solana?
- How accurate was the system after the match?

## 3. Core Product Moment

Within seconds of a new score, event, or odds update, the user should see:

1. the raw confirmed match state
2. the detected context change
3. updated scenario probabilities
4. a qualitative confidence band
5. the main evidence and limitations
6. a clear data freshness and provenance indicator

## 4. Final User-Facing Capabilities

### Match browser

- live, upcoming, and completed matches
- status, score, competition, start time
- freshness
- intelligence availability
- watchlist state

### Match intelligence room

- scoreboard and match clock
- event timeline
- final outcome distribution
- next goal distribution
- goal in next 5/10/15 minutes
- current result holds/changes
- momentum distribution
- top final-score scenarios
- confidence and risk
- explanation factors
- market reliability
- market movement
- event-impact changes
- model update history

### Replay mode

- select a recorded match
- play/pause/speed/seek
- deterministic synchronized score, events, odds, and predictions
- show how probabilities changed at key moments
- post-match evaluation

### Alerts

- watch a fixture
- subscribe through Telegram
- receive only material, deduplicated, informational alerts
- no low-confidence or low-impact spam

### Verification

- show whether source proof metadata is available
- distinguish:
  - raw data provenance
  - proof retrieved
  - proof structurally validated
  - on-chain validation confirmed
- never imply that derived model predictions are on-chain verified

## 5. Required Public Language

Allowed:

- model estimate
- scenario probability
- confidence
- uncertainty
- market data reliability
- information only
- not betting advice
- TxLINE data
- Solana-anchored source data
- proof available / verified status with exact scope

Forbidden product claims:

- guaranteed
- sure win
- lock
- recommended bet
- value bet
- expected profit
- stake
- payout
- arbitrage recommendation
- suspicious manipulation without rigorous evidence
- official FIFA product
- official World Cup partner

## 6. Safety and IP Boundary

Public APIs and UI may expose:

- normalized state
- approved probabilities
- qualitative confidence/risk
- bounded explanation factors
- high-level reliability components
- timestamps and version identifiers
- proof status

They must not expose:

- raw provider payloads
- private provider IDs where not licensed
- credentials or authorization
- exact private model weights
- private thresholds
- proprietary feature formulas
- training artifacts
- model binaries
- full internal debug lineage
- hidden prompt/reasoning
- database internals

## 7. Product Goal

The project is complete when a judge or user can open the deployed product, choose a real or replayed fixture, and observe a reliable end-to-end flow:

`TxLINE data → ingestion → canonical state → intelligence → prediction → public-safe API → polished UI → replay/evaluation/verification`

with no manual database edits, no mock-only core flow, and no paid setup required by the evaluator.
