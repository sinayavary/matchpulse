# Pressure SignalCore Contract Review

## Purpose

This document defines the safe contract boundary for a future SignalCore pressure integration.

It records what a future pressure signal is allowed to look like, and it does so before any implementation work begins.

This is a decision record, not an implementation spec.

## Current State

- SignalCore currently emits data-quality signals only.
- Pressure Engine v1 exists as a pure rule-based engine.
- The stored payload pressure adapter exists as an internal adapter over stored `scores_snapshot` data.
- No pressure output is currently exposed through SignalCore, presenter, public API, or frontend.

## Approved Future Signal Type

The only approved future SignalCore pressure signal type for this phase is:

`PRESSURE_HINT_AVAILABLE`

Meaning:

A rule-based pressure hint is available from stored score snapshot data.

Severity allowed:

- `info`
- `warning` only when adapter status is limited or stale

Severity not allowed:

- `critical`

This is a proposed and approved future type in documentation only. It is not implemented in `signalcore-contract.ts` yet.

## Future Signal Details Shape

The only allowed future details shape is:

```ts
{
  fixture_id: string;
  pressure_kind: "rule_based_pressure_hint";
  pressure_level: "none" | "low" | "medium" | "high";
  pressure_score: number;
  source: "stored_scores_snapshot";
  adapter_status: "available" | "unavailable" | "error";
  evidence_count: number;
  evaluated_records: number;
  usable_records: number;
  latest_seq: number | null;
  latest_ts: number | null;
  limitations: string[];
}
```

Contract limits for future SignalCore details:

- Do not include `confidence`.
- Do not include `probability`.
- Do not include `prediction`.
- Do not include `recommendation`.
- Do not include betting language.
- Do not expose the full raw payload.
- Do not expose proprietary formulas beyond simple documented weights.
- Do not expose every debug lineage item in SignalCore by default.

## Allowed User-Facing Presenter Language Later

Allowed phrasing:

```text
Rule-based pressure hint is available from stored score data.
Current pressure hint: low/medium/high.
This is based on observed score-state fields and sparse possessionType events.
This is not a prediction or probability.
```

Forbidden phrasing:

```text
Team X is likely to score.
This is a strong betting signal.
The model predicts the winner.
High confidence pick.
Sharp market movement.
Guaranteed pressure.
```

## Integration Gate Requirements

Before implementing SignalCore integration, the following must stay true:

- Adapter test coverage remains green.
- SignalCore contract is updated intentionally.
- `assertNoForbiddenSignalFields` still passes.
- No forbidden output keys appear.
- No public API exposure without separate review.
- No frontend integration without separate presenter review.
- No probability, prediction, or betting language.
- Pressure details stay compact by default.
- Debug lineage may remain internal-only.

## Proposed Future Implementation Plan

- Phase 1D - Add internal Pressure SignalCore integration behind `includePressure` option
- Phase 1E - Add internal route smoke test if needed
- Phase 1F - Add presenter-safe pressure wording
- Phase 1G - Frontend display contract for pressure card

Phase 1D implemented the internal SignalCore integration behind `includePressure`. Public API, presenter, and frontend exposure remain blocked.

Notes:

- Phase 1D may modify `signalcore-contract.ts` and `signalcore-v0.ts`.
- Phase 1D must not modify public frontend.
- Phase 1F must review language carefully before user-facing display.
- Phase 1G is frontend-only and should happen after the backend contract is stable.

## Final Decision Table

| Decision | Status | Reason |
| --- | --- | --- |
| Pressure Engine v1 | Approved for internal use | pure rule-based engine exists |
| Stored Payload Adapter | Approved for internal use | reads stored scores only |
| SignalCore Pressure Signal | Approved for future implementation | contract shape defined |
| Public API Exposure | Blocked | requires separate review |
| Presenter Exposure | Blocked | requires safe wording review |
| Frontend Display | Blocked | requires backend contract first |
| Probability Output | Blocked | not calibrated, not allowed |
| Betting Guidance | Blocked | product safety boundary |

## Related Docs

- [Pressure Engine v1](./pressure-engine-v1.md)
- [Pressure Engine v1 Stored Payload Adapter](./pressure-engine-v1-adapter.md)
- [Agent Runtime Assumptions](./agent-runtime-assumptions.md)
