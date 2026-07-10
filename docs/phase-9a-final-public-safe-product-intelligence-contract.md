# Phase 9A — Final Public-Safe Product Intelligence Contract

This phase defines final product contract work for MatchPulse. It is not demo-only behavior.

`mapProductAgentToFinalProductIntelligence` maps the protected internal Product Agent v1 response into the reduced `FinalProductIntelligence` object. The mapper is pure and is not wired into a public route yet. No public route, `server.ts` change, frontend change, or UI change is included in this phase.

The internal `decision_context` is read only to derive safe buckets for market data status and match activity level. It is never returned. Raw SignalCore output, raw event or odds rows, `internal_context`, debug lineage, formulas, and signal details/top signals are never public in this contract.

Market data is exposed only as `available`, `limited`, or `unavailable`; this is a data-coverage status, not betting advice. Match activity is exposed only as `none`, `low`, `medium`, or `high`; it is an activity bucket, not a prediction.

The contract exposes readiness, data quality, freshness, market data status, match activity, signal counts, sanitized user-facing notes, and a fixed safety note. It contains no prediction, probability, confidence, winner, edge, expected value, betting, wagering, wallet, deposit, payout, profit, or stake fields.

`assertFinalProductIntelligencePublicSafe` recursively rejects forbidden structured keys case-insensitively. It scans keys rather than disclaimer text, so the fixed negative safety disclaimer may use words such as “prediction,” “probability,” and “betting recommendation.”

The next phase should wire this public-safe contract into the final product API. That wiring is intentionally not part of Phase 9A.
