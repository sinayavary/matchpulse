# Phase 10B — Prediction Feature Builder

Phase 10B adds deterministic, bounded feature engineering for the internal MatchPulse live prediction pipeline. The builder consumes `CanonicalMatchState` and optional `InternalIntelligenceContext`, and returns a `PredictionFeatureBundleV1` for the future baseline probability engine.

The builder is pure, synchronous, database-independent, and internal-only. It adds no public API, trains no model, and implements no final probability formula. Match minute is accepted only as an explicit input and is never fabricated. Heterogeneous odds are not averaged; odds direction is used only for generic market-movement features, and no side-specific implied probability is extracted.

Missing data is represented with bounded flags and stable diagnostics. Phase, score, reliability, event pressure/impact, freshness, data quality, and coverage are mapped deterministically into model-ready numeric features. The next phase is the baseline live probability engine.
