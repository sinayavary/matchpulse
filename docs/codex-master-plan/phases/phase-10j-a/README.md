# Phase 10J-A — Temporal labels

Adds strict temporal label generation from a prediction snapshot and finalized timeline. Only events at or after `as_of` and at or before finalization are eligible; sequence regressions are invalid, incomplete finalization remains partial, and goal horizons are monotonic.

Evidence: temporal label tests 2/2, domain validation, API typecheck/build, and diff-check pass. No network or database mutation is required by this phase.
