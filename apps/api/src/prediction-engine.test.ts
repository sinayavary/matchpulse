import assert from "node:assert/strict";
import test from "node:test";
import type { InternalOddsIntelligenceContext } from "./odds-intelligence-contract.js";
import { assertFinalPredictionSnapshotValid } from "./final-prediction-domain.js";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { PREDICTION_ENGINE_VERSION, buildFinalScenarioPrediction } from "./prediction-engine.js";

function odds(): InternalOddsIntelligenceContext {
  return {
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: "odds-assessment-v1:abc",
    fixture_id: "f1",
    generated_at: "2026-07-11T10:00:00Z",
    status: "reliable",
    usable_for_model: true,
    overall_reliability_score: 0.8,
    recommended_market_model_weight: 0.2,
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
        { selection: "home", line: null, fair_probability: 0.55, consensus_probability: 0.55, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
        { selection: "draw", line: null, fair_probability: 0.25, consensus_probability: 0.25, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
        { selection: "away", line: null, fair_probability: 0.2, consensus_probability: 0.2, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null },
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
      recommended_model_weight: 0.2,
      issues: [],
      limitations: [],
      latest_timestamp: "2026-07-11T09:59:30Z",
    },
    markets: [],
    issues: [],
    limitations: [],
  };
}

function features(overrides: Record<string, unknown> = {}) {
  return buildPredictionEngineFeatures({
    fixture_id: "f1",
    as_of: "2026-07-11T10:00:00Z",
    sequence: 50,
    has_fixture: true,
    normalized_phase: "second_half",
    phase: "H2",
    minute: 72,
    home_score: 1,
    away_score: 0,
    score_timestamp: "2026-07-11T09:59:50Z",
    event_timestamp: "2026-07-11T09:59:45Z",
    pre_match_prior: { home: 0.43, draw: 0.3, away: 0.27 },
    event_context: {
      event_count: 9,
      pressure_level: "medium",
      pressure_side: "home",
      home_activity: 0.7,
      away_activity: 0.35,
      home_red_cards: 0,
      away_red_cards: 0,
      has_event_impact: true,
    },
    odds_intelligence: odds(),
    ...overrides,
  });
}

function total(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

test("engine builds a contract-valid deterministic prediction snapshot", () => {
  const input = { features: features(), trigger: "score_change" as const, generated_at: "2026-07-11T10:00:01Z" };
  const first = buildFinalScenarioPrediction(input);
  const second = buildFinalScenarioPrediction(input);
  assert.equal(PREDICTION_ENGINE_VERSION, "scenario-engine-v1");
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => assertFinalPredictionSnapshotValid(first));
  assert.ok(first.identity.snapshot_id.startsWith("prediction-snapshot-v1:"));
  assert.ok(Math.abs(total(first.model_output.final_outcome) - 1) < 1e-6);
  assert.ok(Math.abs(total(first.model_output.next_goal) - 1) < 1e-6);
});

test("snapshot identity is content-based and independent of generation latency", () => {
  const source = features();
  const early = buildFinalScenarioPrediction({ features: source, trigger: "timer", generated_at: source.as_of });
  const late = buildFinalScenarioPrediction({ features: source, trigger: "timer", generated_at: "2026-07-11T10:00:15Z" });
  assert.equal(early.identity.snapshot_id, late.identity.snapshot_id);
  assert.notEqual(early.identity.generated_at, late.identity.generated_at);
});

test("market contribution respects the sanitized model weight cap", () => {
  const prediction = buildFinalScenarioPrediction({ features: features(), trigger: "odds_movement" });
  assert.equal(prediction.odds_intelligence_reference.usable_for_model, true);
  assert.ok(prediction.odds_intelligence_reference.assigned_market_weight <= 0.2);
  const contribution = prediction.specialist_contributions.find((item) => item.model_role === "market");
  assert.equal(contribution?.assigned_weight, prediction.odds_intelligence_reference.assigned_market_weight);
  const weightTotal = prediction.specialist_contributions.reduce((sum, item) => sum + item.assigned_weight, 0);
  assert.ok(Math.abs(weightTotal - 1) < 1e-6);
});

test("missing data produces a bounded fallback with explicit risk", () => {
  const sparse = buildPredictionEngineFeatures({
    fixture_id: "f2",
    as_of: "2026-07-11T10:00:00Z",
    has_fixture: false,
    normalized_phase: "unknown",
  });
  const prediction = buildFinalScenarioPrediction({ features: sparse, trigger: "manual" });
  assert.doesNotThrow(() => assertFinalPredictionSnapshotValid(prediction));
  assert.equal(prediction.odds_intelligence_reference.assigned_market_weight, 0);
  assert.deepEqual(prediction.model_output.final_score, { outcomes: [], other_probability: 1 });
  assert.ok(prediction.risk.reasons.includes("inference_fallback"));
  assert.ok(prediction.risk.reasons.includes("partial_feature_coverage"));
  assert.ok(["high", "critical"].includes(prediction.risk.level));
});

test("finished state remains terminal through the ensemble", () => {
  const prediction = buildFinalScenarioPrediction({
    features: features({
      normalized_phase: "finished",
      phase: "F",
      minute: 95,
      home_score: 2,
      away_score: 1,
      odds_intelligence: null,
    }),
    trigger: "phase_change",
  });
  assert.ok(prediction.model_output.final_outcome.home > 0.95);
  assert.deepEqual(prediction.model_output.next_goal, { home: 0, none: 1, away: 0 });
  assert.deepEqual(prediction.model_output.goal_horizon, { next_5m: 0, next_10m: 0, next_15m: 0 });
  assert.deepEqual(prediction.model_output.final_score, {
    outcomes: [{ home_score: 2, away_score: 1, probability: 1 }],
    other_probability: 0,
  });
});

test("terminal matches suppress otherwise usable market influence", () => {
  const prediction = buildFinalScenarioPrediction({
    features: features({ normalized_phase: "finished", phase: "F", minute: 95, home_score: 1, away_score: 1 }),
    trigger: "phase_change",
  });
  assert.deepEqual(prediction.model_output.final_outcome, { home: 0, draw: 1, away: 0 });
  assert.equal(prediction.odds_intelligence_reference.usable_for_model, false);
  assert.equal(prediction.odds_intelligence_reference.assigned_market_weight, 0);
  assert.doesNotThrow(() => assertFinalPredictionSnapshotValid(prediction));
});

test("goal horizons remain monotonic and all output values are finite", () => {
  const prediction = buildFinalScenarioPrediction({ features: features(), trigger: "event_batch" });
  const horizon = prediction.model_output.goal_horizon;
  assert.ok(horizon.next_5m <= horizon.next_10m);
  assert.ok(horizon.next_10m <= horizon.next_15m);
  const numbers = JSON.stringify(prediction).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  assert.ok(numbers.every(Number.isFinite));
});

test("engine does not mutate features and rejects invalid generation ordering", () => {
  const source = features();
  const before = structuredClone(source);
  buildFinalScenarioPrediction({ features: source, trigger: "timer" });
  assert.deepEqual(source, before);
  assert.throws(() => buildFinalScenarioPrediction({
    features: source,
    trigger: "timer",
    generated_at: "2026-07-11T09:59:59Z",
  }));
});

test("prediction contains no wagering, provider, or private-weight fields", () => {
  const serialized = JSON.stringify(buildFinalScenarioPrediction({ features: features(), trigger: "timer" }));
  for (const forbidden of [
    "recommended_bet",
    "stake",
    "payout",
    "profit",
    "expected_value",
    "provider_key",
    "raw_payload",
    "component_scores",
    "model_coefficients",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
