# Pressure Engine v1 Stored Payload Adapter

## Purpose

This adapter connects the pure Pressure Engine v1 module to stored TxLINE `scores_snapshot` raw payloads.

It reads the latest stored payload for a fixture, extracts score-like records conservatively, and passes them into the pure engine to produce an internal pressure hint with payload metadata and debug lineage.

This phase is internal only. It does not expose a user-facing route or public API.

## Input And Output

Input:

- `fixtureId`
- optional Pressure Engine v1 options
- optional `maxPayloadAgeMinutes`

Output:

- adapter status: `available`, `unavailable`, or `error`
- payload metadata
- extracted record count
- Pressure Engine v1 output
- limitations
- a fixed safe scope note

## Data Source

The adapter reads from `txline_raw_payloads` using the latest `scores_snapshot` row for the fixture, ordered by:

1. `providerTs` descending
2. `receivedAt` descending
3. `storedAt` descending

It does not write data and does not call TxLINE live APIs.

## Extraction Rules

The adapter extracts score-like records conservatively.

Supported shapes:

- a raw array payload such as `[{ Seq: 1 }, { Seq: 2 }]`
- an object with array containers such as `{ data: [...] }`, `{ items: [...] }`, `{ records: [...] }`, `{ payload: [...] }`, or `{ result: [...] }`
- one-level nested arrays inside object properties when those arrays contain score-like records

A record is score-like when it is an object and contains at least one of:

- `Seq`
- `seq`
- `Ts`
- `ts`
- `Score`
- `score`
- `ScoreSoccer`
- `scoreSoccer`
- `DataSoccer`
- `dataSoccer`
- `Possession`
- `possession`
- `PossessionType`
- `possessionType`
- `GameState`
- `gameState`

If no score-like records are found, the adapter returns an empty record list and marks the payload as unavailable.

## Output Behavior

- If no payload is found, status is `unavailable`.
- If a payload is found but no score-like records are extracted, status is `unavailable`.
- If a payload is found and records are extracted, status is `available` unless the pure engine returns `unavailable`, in which case the adapter also returns `unavailable`.
- If the read fails or fixture id validation fails, status is `error`.

## Fixture ID Validation

The adapter accepts only non-empty fixture ids.

- The input is trimmed.
- Invalid fixture ids do not throw.
- Invalid fixture ids return an `error` response.
- Invalid fixture ids still produce a pressure output from empty records.

## Freshness Window

`maxPayloadAgeMinutes` is optional.

- If omitted, no freshness check is applied.
- If provided and finite, it is clamped between `1` and `10080`.
- `storedAt` is the age reference.
- If the payload is older than the requested window, the adapter adds a freshness limitation.
- Stale payloads are still processed when records exist.

## Limitations

The adapter records limitations for these cases:

- invalid fixture id
- no stored `scores_snapshot` payload found
- no score-like records extracted
- read failure
- stale payload freshness window

The pressure output also contributes its own limitations.

## Safe Scope

The adapter safe scope note is fixed and internal:

This adapter reads stored TxLINE score snapshot payloads and returns a rule-based pressure hint. It does not call live APIs, write data, predict outcomes, produce probabilities, or provide betting guidance.

The adapter remains non-predictive and non-betting.

## Next Integration Gate

Phase 1B does not expose routes.

Phase 1C may add an internal route or a SignalCore integration only after contract review.

Any later integration must continue to avoid probability, prediction, betting, and betting-advice fields.
