import assert from "node:assert/strict";
import test from "node:test";
import type { InternalOddsIntelligenceContext } from "./odds-intelligence-contract.js";
import {
  PREDICTION_ENGINE_FEATURE_VERSION,
  buildPredictionEngineFeatures,
  buildPredictionMarketSignal,
} from "./prediction-engine-features.js";

function odds(overrides: Partial<InternalOddsIntelligenceContext> = {}): InternalOddsIntelligenceContext {
  return {
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: "odds-assessment-v1:abc",
    fixture_id: "f1",
    generated_at: "2026-07-11T10:00:00Z",
    status: "reliable",
    usable_for_model: true,
    overall_reliability_score: 0.8,
    recommended_market_model_weight: 0.24,
    market_count: 1,
    usable_market_count: 1,
    provider_count: 3,
    snapshot_count: 9,
    consensus_score: 0.9,
    freshness_score: 0.95,
    volatility_score: 0.1,
    anomaly_score: 0,
    primary_match_result_market: {
      market_key: "match_result_1x2|period:0|line:none",
      market_type: "match_result_1x2",
      line: null,
      complete: true,
      usable: true,
      selection_count: 3,
      provider_count: 3,
      snapshot_count: 9,
      overround: 0,
      provider_dispersion: 0.01,
      volatility_score: 0.1,
      selections: [
        { selection: "home", line: null, fair_probability: 0.5, consensus_probability: 0.5, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
        { selection: "draw", line: null, fair_probability: 0.28, consensus_probability: 0.28, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
        { selection: "away", line: null, fair_probability: 0.22, consensus_probability: 0.22, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
      ],
      component_scores: {
        structural_validity: 1,
        freshness: 1,
        market_completeness: 1,
        provider_quality: 0.8,
        provider_consensus: 0.9,
        dispersion_quality: 0.9,
        movement_integrity: 0.9,
        event_consistency: 1,
        historical_support: 0.7,
        overall_reliability: 0.8,
      },
      reliability_level: "reliable",
      reliability_score: 0.8,
      recommended_model_weight: 0.24,
      issues: [],
      limitations: ["limited history"],
      latest_timestamp: "2026-07-11T09:59:30Z",
    },
    markets: [],
    issues: [],
    limitations: ["limited history"],
    ...overrides,
  };
}

function input() {
  return {
    fixture_id: "f1",
    as_of: "2026-07-11T10:00:00Z",
    sequence: 10,
    has_fixture: true,
    phase: "H2",
    normalized_phase: "second_half" as const,
    minute: 70,
    home_score: 1,
    away_score: 0,
    score_timestamp: "2026-07-11T09:59:50Z",
    event_timestamp: "2026-07-11T09:59:45Z",
    pre_match_prior: { home: 0.45, draw: 0.3, away: 0.25 },
    event_context: {
      event_count: 12,
      pressure_level: "high" as const,
      pressure_side: "home" as const,
      home_red_cards: 0,
      away_red_cards: 1,
      home_activity: 0.8,
      away_activity: 0.35,
      has_event_impact: true,
    },
    odds_intelligence: odds(),
  };
}

test("feature builder produces a deterministic canonical snapshot", () => {
  const first = buildPredictionEngineFeatures(input());
  const second = buildPredictionEngineFeatures(input());
  assert.equal(first.feature_version, PREDICTION_ENGINE_FEATURE_VERSION);
  assert.equal(first.feature_hash, second.feature_hash);
  assert.equal(first.match.score_diff, 1);
  assert.equal(first.freshness.score_age_seconds, 10);
  assert.equal(first.freshness.event_age_seconds, 15);
  assert.equal(first.freshness.market_age_seconds, 30);
  assert.equal(first.coverage.coverage_score, 1);
  assert.deepEqual(first.market.final_outcome, { home: 0.5, draw: 0.28, away: 0.22 });
  assert.equal(first.market.model_weight_cap, 0.24);
});

test("market adapter exposes only sanitized model evidence", () => {
  const signal = buildPredictionMarketSignal(odds());
  assert.equal(signal.usable, true);
  assert.equal(signal.assessment_id, "odds-assessment-v1:abc");
  assert.equal(signal.model_weight_cap, 0.24);
  const serialized = JSON.stringify(signal);
  for (const forbidden of ["provider_count", "component_scores", "fair_probability", "recommended_model_weight"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("unusable or incomplete markets have zero model weight", () => {
  const context = odds({ usable_for_model: false });
  const signal = buildPredictionMarketSignal(context);
  assert.equal(signal.usable, false);
  assert.equal(signal.model_weight_cap, 0);
  assert.equal(signal.final_outcome, null);
});

test("missing inputs lower coverage and add stable limitations", () => {
  const features = buildPredictionEngineFeatures({
    fixture_id: "f2",
    as_of: "2026-07-11T10:00:00Z",
    has_fixture: false,
    normalized_phase: "unknown",
  });
  assert.equal(features.coverage.has_fixture, false);
  assert.equal(features.coverage.has_scoreboard, false);
  assert.equal(features.coverage.has_market, false);
  assert.equal(features.coverage.coverage_score, 0);
  assert.ok(features.limitations.includes("Scoreboard unavailable."));
  assert.ok(features.limitations.includes("Market context unavailable."));
});

test("feature builder rejects inconsistent scores and future timestamps", () => {
  assert.throws(() => buildPredictionEngineFeatures({ ...input(), away_score: null }));
  assert.throws(() => buildPredictionEngineFeatures({
    ...input(),
    score_timestamp: "2026-07-11T10:00:01Z",
  }));
});

test("input objects are not mutated", () => {
  const source = input();
  const before = structuredClone(source);
  buildPredictionEngineFeatures(source);
  assert.deepEqual(source, before);
});
