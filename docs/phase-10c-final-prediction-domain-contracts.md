# Phase 10C — Final Prediction Domain Contracts

These are permanent, production-grade, versioned contracts for MatchPulse prediction snapshots, labels, evaluation, Odds Intelligence, and public Market Intelligence. Prediction targets use stable identifiers rather than user-facing text. Snapshots are immutable observations at `as_of`; future data must not enter their features. Labels are created only from information occurring after `as_of`.

Odds Intelligence has two separate outputs. Internal Odds Intelligence may support model weighting only after structural validity, timestamp validity, freshness, market identification and completeness, provider coverage and agreement, dispersion, outlier, movement integrity, event consistency, and overall reliability have been assessed. Public Market Intelligence contains safe summaries and never raw odds, provider payloads, private rankings, weights, coefficients, or fair-probability internals.

No odds data influences a prediction before its validity, freshness,
market completeness, provider agreement, anomaly status, and reliability
have been assessed.

This phase defines contracts, recursive safety validation, and immutable cloning builders. It does not calculate predictions, implied probabilities, overround, provider consensus, or anomaly algorithms; train models; create database tables; or change API routes, frontend, workers, Telegram, Solana, or TxLINE integrations. The next phase is permanent prediction snapshot and label storage.

## Phase 10C-H enforced invariants

Snapshot validation now checks identity and feature-version agreement, score-difference consistency, minute and odds coverage consistency, and the relationship between usable Odds Intelligence and its assessment, reliability, and assigned weight. Specialist roles are checked against the declared enum; unavailable specialists have zero weight and available specialist weights normalize to one. All probability values are finite, bounded, and normalized, including scoreline uniqueness and monotonic goal horizons.

Labels validate boolean horizon fields, monotonic horizon truth, timestamp ordering, pending/partial/complete/invalid status rules, and the requirement that a resolved `none` next-goal label has a finalized source. Evaluation records have runtime validation and cloning builders; identifiers and ISO timestamps are required, targets are declared prediction targets, arrays contain strings, and nullable metrics obey non-negative or 0..1 constraints.

Internal Odds Intelligence requires the exact ten component-score keys, component/reliability agreement, market and selection count agreement, provider/snapshot context coverage, usable-market status and weights, root status/weight consistency, primary 1X2 market attachment, complete-market probability sums, duplicate detection, and timestamps no later than `generated_at`. Public Market Intelligence enforces count, availability, provider-coverage, and `last_update` ordering rules while deduplicating limitations and identical movement records.

Recursive forbidden-key scanning is case-insensitive and traverses plain objects, arrays, nested arrays, and mixed nested structures. Public output additionally rejects internal model, probability, feature, and Odds Intelligence fields. Disclaimer text is not inspected as a forbidden key.

Contract builders never calculate or normalize prediction probabilities. Invalid probability distributions are rejected. All permanent storage invariants have explicit named tests.

## Phase 10C-H2 coverage matrix

| Invariant ID | Contract area | Rule | Exact test name | Status |
|---:|---|---|---|---|
| 1 | Snapshot | Valid snapshot passes | `valid snapshot passes` | Pass |
| 2 | Snapshot | Builder returns a deep clone | `snapshot builder returns a deep clone` | Pass |
| 3 | Snapshot | Builder does not mutate input | `snapshot builder does not mutate input` | Pass |
| 4 | Snapshot | Deduplicate confidence reasons | `snapshot builder deduplicates confidence reasons` | Pass |
| 5 | Snapshot | Deduplicate risk reasons | `snapshot builder deduplicates risk reasons` | Pass |
| 6 | Snapshot | Deduplicate explanation factors | `snapshot builder deduplicates explanation factors` | Pass |
| 7 | Snapshot | Preserve all probability values exactly | `snapshot builder preserves all probability values exactly` | Pass |
| 8 | Snapshot | Invalid prediction contract version fails | `invalid prediction contract version fails` | Pass |
| 9 | Snapshot | Empty snapshot ID fails | `empty snapshot ID fails` | Pass |
| 10 | Snapshot | Empty fixture ID fails | `empty fixture ID fails` | Pass |
| 11 | Snapshot | Invalid `as_of` fails | `invalid as_of fails` | Pass |
| 12 | Snapshot | Invalid `generated_at` fails | `invalid generated_at fails` | Pass |
| 13 | Snapshot | `generated_at < as_of` fails | `generated_at less than as_of fails` | Pass |
| 14 | Snapshot | Negative sequence fails | `negative sequence fails` | Pass |
| 15 | Snapshot | Non-integer sequence fails | `non-integer sequence fails` | Pass |
| 16 | Snapshot | Invalid trigger fails | `invalid trigger fails` | Pass |
| 17 | Snapshot | Identity and feature-reference versions match | `identity and feature-reference versions must match` | Pass |
| 18 | Snapshot | Empty feature hash fails | `empty feature hash fails` | Pass |
| 19 | Snapshot | Negative feature count fails | `negative feature count fails` | Pass |
| 20 | Snapshot | Invalid minute fails | `invalid minute fails` | Pass |
| 21 | Snapshot | Negative score fails | `negative score fails` | Pass |
| 22 | Snapshot | Score difference equals actual score difference | `score difference must equal actual score difference` | Pass |
| 23 | Snapshot | Missing score requires null score difference | `missing score requires null score difference` | Pass |
| 24 | Snapshot | `has_minute` matches minute presence | `coverage has_minute must match minute presence` | Pass |
| 25 | Snapshot | Reliable Odds require Odds availability | `reliable Odds require Odds availability` | Pass |
| 26 | Snapshot | Unusable Odds require zero market weight | `unusable Odds require zero market weight` | Pass |
| 27 | Snapshot | Usable Odds require non-empty assessment ID | `usable Odds require non-empty assessment ID` | Pass |
| 28 | Snapshot | Usable Odds require positive reliability | `usable Odds require positive reliability` | Pass |
| 29 | Snapshot | Usable Odds require positive assigned weight | `usable Odds require positive assigned market weight` | Pass |
| 30 | Snapshot | Invalid specialist role fails | `invalid specialist role fails` | Pass |
| 31 | Snapshot | Unavailable specialist requires zero weight | `unavailable specialist requires zero weight` | Pass |
| 32 | Snapshot | Available specialist requires model version | `available specialist requires model version` | Pass |
| 33 | Snapshot | Specialist weight is bounded | `specialist weight must be bounded` | Pass |
| 34 | Snapshot | Available specialist weights sum to one | `available specialist weights must sum to one` | Pass |
| 35 | Snapshot | Final-outcome distribution sums to one | `final-outcome distribution must sum to one` | Pass |
| 36 | Snapshot | Next-goal distribution sums to one | `next-goal distribution must sum to one` | Pass |
| 37 | Snapshot | Goal horizons are bounded | `goal horizons must be bounded` | Pass |
| 38 | Snapshot | Goal horizons are monotonic | `goal horizons must be monotonic` | Pass |
| 39 | Snapshot | Current-result distribution sums to one | `current-result distribution must sum to one` | Pass |
| 40 | Snapshot | Momentum distribution sums to one | `momentum distribution must sum to one` | Pass |
| 41 | Snapshot | Final-score distribution sums to one | `final-score distribution must sum to one` | Pass |
| 42 | Snapshot | Duplicate scoreline fails | `duplicate scoreline fails` | Pass |
| 43 | Snapshot | Invalid confidence level fails | `invalid confidence level fails` | Pass |
| 44 | Snapshot | Confidence scores are bounded | `every confidence score must be bounded` | Pass |
| 45 | Snapshot | Invalid risk reason fails | `invalid risk reason fails` | Pass |
| 46 | Snapshot | Recursive forbidden model field fails | `recursive forbidden model field fails` | Pass |
| 47 | Snapshot | Fixed safety note is required | `safety note must match the fixed value` | Pass |
| 48 | Labels | Valid pending label passes | `valid pending label passes` | Pass |
| 49 | Labels | Pending label requires all targets null | `pending label requires all targets null` | Pass |
| 50 | Labels | Valid partial label passes | `valid partial label passes` | Pass |
| 51 | Labels | Partial label requires at least one target | `partial label requires at least one target` | Pass |
| 52 | Labels | Partial label cannot satisfy complete requirements | `partial label must not satisfy complete requirements` | Pass |
| 53 | Labels | Valid complete label passes | `valid complete label passes` | Pass |
| 54 | Labels | Complete label requires every target | `complete label requires every required target` | Pass |
| 55 | Labels | Invalid status requires a limitation | `invalid status requires a limitation` | Pass |
| 56 | Labels | Horizon values are boolean or null | `goal-horizon values must be boolean or null` | Pass |
| 57 | Labels | Five-minute true implies ten-minute true | `five-minute true implies ten-minute true` | Pass |
| 58 | Labels | Ten-minute true implies fifteen-minute true | `ten-minute true implies fifteen-minute true` | Pass |
| 59 | Labels | Invalid labeled timestamp fails | `invalid labeled timestamp fails` | Pass |
| 60 | Labels | `labeled_at < as_of` fails | `labeled_at less than as_of fails` | Pass |
| 61 | Labels | `source_finalized_at < as_of` fails | `source_finalized_at less than as_of fails` | Pass |
| 62 | Labels | `source_finalized_at > labeled_at` fails | `source_finalized_at greater than labeled_at fails` | Pass |
| 63 | Labels | `next_goal_side=none` requires finalized source | `next_goal_side none requires finalized source` | Pass |
| 64 | Labels | Negative final score fails | `negative final score fails` | Pass |
| 65 | Labels | Invalid label enum fails | `invalid label enum fails` | Pass |
| 66 | Labels | Builder returns a deep clone | `label builder returns a deep clone` | Pass |
| 67 | Labels | Builder preserves target labels exactly | `label builder preserves target labels exactly` | Pass |
| 68 | Labels | Builder deduplicates limitations | `label builder deduplicates limitations` | Pass |
| 69 | Evaluation | Valid evaluation passes | `valid evaluation passes` | Pass |
| 70 | Evaluation | Builder does not mutate input | `evaluation builder does not mutate input` | Pass |
| 71 | Evaluation | Builder deduplicates segment keys | `evaluation builder deduplicates segment keys` | Pass |
| 72 | Evaluation | Builder deduplicates limitations | `evaluation builder deduplicates limitations` | Pass |
| 73 | Evaluation | Invalid target fails | `invalid evaluation target fails` | Pass |
| 74 | Evaluation | Empty model version fails | `empty model version fails` | Pass |
| 75 | Evaluation | Invalid evaluation timestamp fails | `invalid evaluation timestamp fails` | Pass |
| 76 | Evaluation | Non-boolean quality gate fails | `non-boolean quality gate fails` | Pass |
| 77 | Evaluation | Null non-applicable metrics pass | `null non-applicable metrics pass` | Pass |
| 78 | Evaluation | Non-finite metric fails | `non-finite metric fails` | Pass |
| 79 | Evaluation | Negative log loss fails | `negative log loss fails` | Pass |
| 80 | Evaluation | Negative Brier score fails | `negative Brier score fails` | Pass |
| 81 | Evaluation | Calibration error outside 0..1 fails | `calibration error outside 0..1 fails` | Pass |
| 82 | Evaluation | Accuracy outside 0..1 fails | `accuracy outside 0..1 fails` | Pass |
| 83 | Evaluation | Precision outside 0..1 fails | `precision outside 0..1 fails` | Pass |
| 84 | Evaluation | Recall outside 0..1 fails | `recall outside 0..1 fails` | Pass |
| 85 | Evaluation | ROC-AUC outside 0..1 fails | `ROC-AUC outside 0..1 fails` | Pass |
| 86 | Evaluation | PR-AUC outside 0..1 fails | `PR-AUC outside 0..1 fails` | Pass |
| 87 | Internal Odds | Valid context passes | `valid internal Odds context passes` | Pass |
| 88 | Internal Odds | Builder returns a deep clone | `internal Odds builder returns a deep clone` | Pass |
| 89 | Internal Odds | Builder preserves numeric values exactly | `internal Odds builder preserves all probability and reliability values exactly` | Pass |
| 90 | Internal Odds | Builder deduplicates root issues | `internal Odds builder deduplicates root issues` | Pass |
| 91 | Internal Odds | Builder deduplicates market issues | `internal Odds builder deduplicates market issues` | Pass |
| 92 | Internal Odds | Missing component score fails | `missing component score fails` | Pass |
| 93 | Internal Odds | Unexpected component score fails | `unexpected component score fails` | Pass |
| 94 | Internal Odds | Component score outside 0..1 fails | `component score outside 0..1 fails` | Pass |
| 95 | Internal Odds | Component reliability matches market reliability | `component overall reliability must match market reliability` | Pass |
| 96 | Internal Odds | Root market count matches array length | `root market count must match array length` | Pass |
| 97 | Internal Odds | Usable-market count matches actual markets | `usable-market count must match actual usable markets` | Pass |
| 98 | Internal Odds | Selection count matches selections length | `selection count must match selections length` | Pass |
| 99 | Internal Odds | Root provider count is not lower | `root provider count cannot be lower than market provider count` | Pass |
| 100 | Internal Odds | Root snapshot count is not lower | `root snapshot count cannot be lower than market snapshot count` | Pass |
| 101 | Internal Odds | Complete fair probabilities sum to one | `complete fair probabilities must sum to one` | Pass |
| 102 | Internal Odds | Complete consensus probabilities sum to one | `complete consensus probabilities must sum to one` | Pass |
| 103 | Internal Odds | Duplicate selection and line fails | `duplicate selection and line fails` | Pass |
| 104 | Internal Odds | Duplicate market key fails | `duplicate market key fails` | Pass |
| 105 | Internal Odds | Unusable market requires zero weight | `unusable market requires zero model weight` | Pass |
| 106 | Internal Odds | Usable market requires complete market | `usable market requires complete market` | Pass |
| 107 | Internal Odds | Usable market requires positive weight | `usable market requires positive model weight` | Pass |
| 108 | Internal Odds | Unusable root requires zero weight | `root unusable context requires zero market-model weight` | Pass |
| 109 | Internal Odds | Usable root requires usable markets | `root usable context requires usable markets` | Pass |
| 110 | Internal Odds | Usable root requires positive reliability | `root usable context requires positive reliability` | Pass |
| 111 | Internal Odds | Primary market is 1X2 | `primary market must be match_result_1x2` | Pass |
| 112 | Internal Odds | Primary market key exists | `primary market key must exist in markets` | Pass |
| 113 | Internal Odds | Invalid market timestamp fails | `invalid market timestamp fails` | Pass |
| 114 | Internal Odds | Market timestamp after generated time fails | `market timestamp after generated time fails` | Pass |
| 115 | Internal Odds | Empty markets require unavailable/invalid status | `empty markets require unavailable or invalid status` | Pass |
| 116 | Internal Odds | Recursive provider payload fails | `recursive provider payload fails` | Pass |
| 117 | Internal Odds | Private provider weights fail | `private provider weights fail` | Pass |
| 118 | Internal Odds | Raw Odds rows fail | `raw Odds rows fail` | Pass |
| 119 | Public Market | Valid public output passes | `valid public output passes` | Pass |
| 120 | Public Market | Builder returns a deep clone | `public builder returns a deep clone` | Pass |
| 121 | Public Market | Builder preserves counts and labels | `public builder preserves public counts and labels exactly` | Pass |
| 122 | Public Market | Builder deduplicates limitations | `public builder deduplicates limitations` | Pass |
| 123 | Public Market | Builder deduplicates identical movements | `public builder deduplicates identical movements` | Pass |
| 124 | Public Market | Usable count cannot exceed market count | `usable count cannot exceed market count` | Pass |
| 125 | Public Market | Unavailable output requires zero usable markets | `unavailable output requires zero usable markets` | Pass |
| 126 | Public Market | Zero providers require none coverage | `zero providers require none coverage` | Pass |
| 127 | Public Market | One provider requires single coverage | `one provider requires single coverage` | Pass |
| 128 | Public Market | Invalid generated timestamp fails | `invalid generated timestamp fails` | Pass |
| 129 | Public Market | Invalid last-update timestamp fails | `invalid last-update timestamp fails` | Pass |
| 130 | Public Market | Last update after generated time fails | `last update after generated time fails` | Pass |
| 131 | Public Market | Public fair probability fails | `public fair probability fails` | Pass |
| 132 | Public Market | Public consensus probability fails | `public consensus probability fails` | Pass |
| 133 | Public Market | Public model weight fails | `public model weight fails` | Pass |
| 134 | Public Market | Public provider-quality internals fail | `public provider-quality internals fail` | Pass |
| 135 | Public Market | Public component scores fail | `public component scores fail` | Pass |
| 136 | Public Market | Public feature reference fails | `public feature reference fails` | Pass |
| 137 | Public Market | Betting disclaimer text remains allowed | `negative betting disclaimer text remains allowed` | Pass |
| 138 | Public Market | Recursive nested forbidden key fails | `recursive nested forbidden key fails` | Pass |
