# SignalCore v0 and Agent Contract

## Purpose and boundary

This contract defines the safe interface between canonical match data, SignalCore v0, and a future user-facing Agent. SignalCore v0 is a data-quality and availability layer only. It does not generate predictions, recommendations, betting guidance, or interpretations of odds movement. The Agent is a controlled presenter of approved data, not an autonomous data-access or wagering system.

## Current data pipeline

```text
TxLINE
  -> ingestion runner
  -> Neon DB
  -> match state builder
  -> SignalCore v0
  -> Agent
  -> internal API / UI / alerts later
```

The ingestion runner is the controlled entry point for upstream collection. Neon stores persisted fixtures, scores, and odds. The match state builder produces the canonical state consumed by SignalCore. SignalCore may derive only approved availability, freshness, and quality signals. A future Agent may read those controlled outputs and turn them into safe descriptions. Internal API, UI, and alert consumers remain downstream and are not implemented by this phase.

SignalCore and the Agent must not bypass an earlier boundary in this pipeline.

## SignalCore v0 responsibility

SignalCore v0 may:

- inspect canonical match state;
- report whether fixture, scoreboard, and odds data are available;
- explain missing or incomplete data;
- expose freshness and quality status;
- emit only the signal types and severities defined in `signalcore-contract.ts`.

SignalCore v0 must not produce:

- betting advice or wagering suggestions;
- probability estimates or confidence scores;
- market-edge claims or expected-value calculations;
- odds-movement detection or interpretation;
- recommended actions;
- match-outcome predictions or winner selections;
- wallet, deposit, payout, profit, or payment flows.

This phase defines the vocabulary and guardrails only. It does not implement a SignalCore engine or execute signals.

## Future Agent responsibility

The future Agent may:

- summarize canonical match state obtained through a controlled tool;
- explain which fixture, scoreboard, and odds data is available;
- explain which data is missing;
- describe freshness and quality issues;
- produce user-facing descriptions grounded in approved contract data.

The future Agent must not have or claim:

- direct TxLINE access;
- direct access to secrets or environment configuration;
- arbitrary database query access;
- betting advice or recommended wagers;
- probabilities or confidence claims;
- odds-edge or odds-movement interpretations;
- wallet, deposit, payout, payment, or other wagering mechanics.

## Controlled Agent tools

The future Agent may call only these controlled tools:

- `getMatchState(fixtureId)` reads canonical match state.
- `runIngestionPipeline(fixtureId, options)` requests the existing controlled ingestion workflow.
- `getSignalSummary(fixtureId)` reads approved SignalCore output when SignalCore v0 exists.
- `getReplayState(sessionId)` reads controlled replay state in a later phase.

These names describe future interfaces, not implementations added in this phase. Tool results remain subject to the forbidden-field guardrail before they are presented as SignalCore output.

## Contract shape

The backend contract publishes:

- allowed v0 signal types: data readiness, partial or empty state, fixture/score/odds availability or absence, freshness or staleness, and incomplete identity;
- allowed severity values: `info`, `warning`, and `critical`;
- allowed controlled Agent tool names;
- forbidden output fields and topics;
- product-option identifiers and the next implementation phase.

`assertNoForbiddenSignalFields(value)` is a pure recursive guard. It rejects forbidden field names at any object depth. It neither reads data nor generates a signal.

## MVP product options

Now, as contract-defined MVP surfaces:

- **Match Intelligence Card**: a safe summary of canonical match state and availability.
- **Data Quality Dashboard**: visibility into missing, partial, fresh, or stale data.
- **Signal Feed**: a feed limited to approved quality and availability signal types.

Next:

- implement SignalCore v0 against canonical match state;
- expose controlled signal summaries for internal consumers;
- connect approved contract outputs to the initial MVP surfaces.

Later:

- **Replay Timeline**, after its controlled Agent tool and presentation contract are approved;
- **Watchlist**, after storage and access boundaries are defined;
- **Alerts**, after delivery, consent, and safe-content boundaries are defined.

No product option permits predictions, recommendations, betting, wagering, or payment mechanics.

## API boundary

`GET /api/internal/signalcore/contract` is a static, read-only internal endpoint. It returns the contract constants with `live`, `contract`, and `internal` metadata. It does not call TxLINE, query or write the database, access secrets, execute SignalCore, or change any public route.
