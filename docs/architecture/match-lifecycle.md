# Match Lifecycle

Lifecycle resolution uses provider status first, then persisted phase, kickoff evidence, and
capture windows. Terminal evidence always wins over time heuristics.

```mermaid
stateDiagram-v2
  [*] --> scheduled
  scheduled --> prematch
  prematch --> live_first_half
  live_first_half --> halftime
  halftime --> live_second_half
  live_second_half --> finished
  scheduled --> postponed
  scheduled --> cancelled
  scheduled --> abandoned
  live_first_half --> finished_unconfirmed
```

Upcoming requires scheduled or prematch and a kickoff strictly after the request snapshot.
Finished, interrupted, live, unknown-in-progress, and past-kickoff rows are excluded.
Public lifecycle fields include safe source, confidence, reason code, active, and terminal
flags without exposing raw provider payloads.
