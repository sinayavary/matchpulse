# Runtime Data Audit

Phase 0A creates a backend-only runtime audit foundation for TxLINE payloads.

This phase exists to validate the raw data contract before any prediction, pressure scoring, odds reliability, or learning layer is built on top of it.

## Why this phase exists

- confirm that live TxLINE payloads can be fetched and archived safely
- measure the shape and stability of the runtime payloads
- capture immutable raw responses with timestamps and hashes
- surface early data-quality issues before later agent layers depend on them

## What it validates

- fixtures snapshot payload shape and fixture presence
- score snapshot availability, sequence fields, possession fields, and possible event flags
- odds snapshot bookmaker distribution and raw `Pct` behavior
- latency between provider timestamps and backend receipt time

## What is stored

- one `TxlineAuditRun` row per execution
- one immutable `TxlineRawPayload` row per captured payload
- one or more `TxlineAuditFinding` rows for observations, missing fields, and warnings

## How to run it

Use the internal runtime audit route:

```bash
curl -X POST http://localhost:4000/api/internal/txline/audit/runtime \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureIds": ["17952170", "17588223"],
    "competitionId": 430,
    "startEpochDay": 20608,
    "includeFixtures": true,
    "includeScores": true,
    "includeOdds": true,
    "asOf": 1781226000000,
    "scoreAsOfByFixtureId": {
      "17952170": 1780596263367
    },
    "oddsAsOfByFixtureId": {
      "17588223": 1781226000000
    },
    "notes": "phase-0a runtime audit"
  }'
```

To fetch a stored run:

```bash
curl http://localhost:4000/api/internal/txline/audit/runtime/<auditRunId>
```

## What the outputs mean

- `fixtures.requestedFixtureIds` lists the fixture IDs you asked the audit to inspect
- `fixtures.foundFixtureIds` shows which fixture IDs were found in the live fixtures snapshot
- `scores.possessionTypeValues` lists observed possession type values
- `scores.possibleEventFieldsFound` lists observed possible-event field names
- `odds.bookmakerIds` and `odds.bookmakerCount` summarize bookmaker distribution
- `odds.classification` identifies `single_stable_price_demargined`, `single_source`, `multi_bookmaker`, or `unknown`
- `odds.pct` reports raw `Pct` numeric and `NA` behavior without de-vigging
- `requests` summarizes attempted, succeeded, failed, and skipped fetches
- `asOf` records the global and per-fixture timestamps used by score and odds requests
- `latency` reports provider-to-receipt latency when a timestamp can be extracted
- `dataQuality.warnings` contains non-fatal observations and unexpected-shape notes

## What this phase does not do

- it does not predict match outcomes
- it does not calculate pressure
- it does not calculate odds reliability
- it does not de-vig odds
- it does not implement offline learning or backtesting

## Safety notes

- the route is internal only
- TxLINE credentials must be configured before the runtime audit runs
- raw payloads are stored immutably for later analysis
- score or odds requests without `asOf` are skipped with `missing_asOf` findings
- failed TxLINE fetches are recorded as `txline_request` findings and do not crash the audit unless every requested fetch fails
