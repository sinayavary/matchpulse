# COMP-A — Competition Prediction Baseline

## Delivered boundary

`competition_baseline_v1` is the competition model profile behind the permanent `FinalPredictionSnapshot` contract. It reuses `prediction-engine-v1` for deterministic specialist composition and does not introduce a second composition path.

## Inputs

The pure profile accepts normalized, bounded values only:

- fixture identity and deterministic timestamps;
- match phase, minute and score;
- approved market distributions plus reliability and model-use cap;
- bounded event pressure and event impact;
- feature reference and freshness.

It does not read Prisma, call TxLINE, register routes, persist snapshots, or access the network.

## Outputs

Every invocation returns the complete competition prediction family:

- final outcome probabilities;
- next-goal probabilities;
- goal probability in the next 5, 10 and 15 minutes;
- bounded final-score distribution;
- current-result hold/change probability;
- momentum-shift probabilities;
- confidence and risk;
- concise explanation and limitations.

## Safety and degraded behavior

- Market contribution cannot exceed the approved odds-intelligence cap.
- Missing or unusable odds receive zero market weight.
- Missing event evidence does not fabricate pressure.
- Missing score or minute activates a complete conservative fallback, lowers confidence and raises risk.
- Finished matches collapse to deterministic terminal values.
- The competition profile is intentionally limited and is not described as production calibrated.
- No public route or DTO is added in COMP-A; user-facing prediction and odds presentation begins in COMP-B and COMP-C.

## Compatibility

Future production specialists may replace the competition specialists without changing the composition engine, `FinalPredictionSnapshot`, service, API, replay adapter or web caller.
