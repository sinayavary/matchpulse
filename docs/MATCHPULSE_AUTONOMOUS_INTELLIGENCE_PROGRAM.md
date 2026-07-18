# MatchPulse Autonomous Intelligence Program A

Program ID: `MATCHPULSE-AUTONOMOUS-INTELLIGENCE-PROGRAM-A`

MatchPulse is a protected live-scenario intelligence product. It uses real persisted provider observations, never fabricates production data, never exposes private model internals, and never provides betting execution or wagering recommendations.

## Ordered phases

1. `MATCH-LIFECYCLE-CATALOG-A`
2. `BACKGROUND-AGENT-PREDICTION-A`
3. `EVALUATION-LEARNING-A`
4. `MATCHES-EXPERIENCE-A`
5. `PROD-LIVE-E2E-ACCEPTANCE-B`

The program requires UTC backend/DB timestamps, browser-local rendering, additive migrations only, immutable versioned prediction snapshots, temporal labels, shadow-only learning, champion immutability, public-safe mapping, and evidence-backed acceptance. `WAITING_FOR_REAL_FIXTURE` and `WAITING_FOR_TRAINING_DATA` are valid terminal states; neither may be reported as success.

## Safety boundary

No bet execution, stake, payout, profit, wallet, wagering recommendation, raw provider payload, secret, private coefficient, private threshold, model weight, fabricated fixture, mock production record, or future-data leakage is allowed.

## Governance transition record

The previous production acceptance phase is preserved as `paused_superseded_for_remediation`. Its evidence remains read-only and records `WAITING_FOR_REAL_FIXTURE`. This bootstrap installs the ordered program and activates only the lifecycle phase; it does not claim production acceptance.
