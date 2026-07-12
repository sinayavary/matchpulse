import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompetitionPredictionSnapshot,
  type CompetitionPredictionInput,
} from "./competition-model-profile.js";

function baseInput(): CompetitionPredictionInput {
  return {
    fixture_id: "competition-fixture-1",
    as_of: "2026-07-13T10:00:00.000Z",
    generated_at: "2026-07-13T10:00:01.000Z",
    sequence: 67,
    trigger: "odds_movement",
    feature_reference: {
      feature_version: "competition-feature-v1",
      feature_hash: "competition-feature-hash",
      feature_count: 12,
    },
    phase: "H2",
    normalized_phase: "second_half",
    minute: 67,
    home_score: 1,
    away_score: 1,
    freshness_score: 0.92,
    market: {
      available: true,
      usable_for_model: true,
      assessment_id: "odds-assessment-v1:competition",
      reliability_score: 0.86,
      approved_model_weight_cap: 0.2,
      final_outcome: { home: 0.42, draw: 0.33, away: 0.25 },
      next_goal: { home: 0.39, none: 0.28, away: 0.33 },
      direction: "home",
      limitations: [],
    },
    events: {
      available: true,
      home_pressure: 0.72,
      away_pressure: 0.48,
      home_impact: 0.65,
      away_impact: 0.35,
      limitations: [],
    },
  };
}

function total(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

test("competition baseline is deterministic and returns every prediction family", () => {
  const input = baseInput();
  const before = structuredClone(input);
  const first = buildCompetitionPredictionSnapshot(input);
  const second = buildCompetitionPredictionSnapshot(structuredClone(input));

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.match(first.identity.snapshot_id, /^prediction-snapshot-v1:[a-f0-9]{64}$/);
  assert.ok(Math.abs(total(first.model_output.final_outcome) - 1) < 1e-9);
  assert.ok(Math.abs(total(first.model_output.next_goal) - 1) < 1e-9);
  assert.ok(Math.abs(total(first.model_output.current_result_survival) - 1) < 1e-9);
  assert.ok(Math.abs(total(first.model_output.momentum_shift) - 1) < 1e-9);
  assert.ok(first.model_output.goal_horizon.next_5m <= first.model_output.goal_horizon.next_10m);
  assert.ok(first.model_output.goal_horizon.next_10m <= first.model_output.goal_horizon.next_15m);
  assert.ok(first.model_output.final_score.outcomes.length > 0);
  assert.equal(first.confidence.calibration_score, 0.45);
  assert.equal(first.explanation.limitations.some((item) => item.includes("not production calibrated")), true);
});

test("market contribution remains inside the approved model-use cap", () => {
  const input = baseInput();
  input.market.approved_model_weight_cap = 0.08;
  const snapshot = buildCompetitionPredictionSnapshot(input);

  assert.ok(snapshot.odds_intelligence_reference.assigned_market_weight <= 0.08);
  assert.equal(snapshot.odds_intelligence_reference.usable_for_model, true);
  assert.equal(
    snapshot.specialist_contributions.reduce((sum, item) => sum + item.assigned_weight, 0),
    1,
  );
});

test("finished matches collapse to deterministic terminal values", () => {
  const input = baseInput();
  input.phase = "FT";
  input.normalized_phase = "finished";
  input.minute = 95;
  input.home_score = 2;
  input.away_score = 1;

  const snapshot = buildCompetitionPredictionSnapshot(input);
  assert.deepEqual(snapshot.model_output.final_outcome, { home: 1, draw: 0, away: 0 });
  assert.deepEqual(snapshot.model_output.next_goal, { home: 0, none: 1, away: 0 });
  assert.deepEqual(snapshot.model_output.goal_horizon, { next_5m: 0, next_10m: 0, next_15m: 0 });
  assert.deepEqual(snapshot.model_output.final_score, {
    outcomes: [{ home_score: 2, away_score: 1, probability: 1 }],
    other_probability: 0,
  });
  assert.deepEqual(snapshot.model_output.current_result_survival, {
    current_result_holds: 1,
    current_result_changes: 0,
  });
});

test("partial inputs still return complete bounded output with degraded confidence", () => {
  const input = baseInput();
  input.minute = null;
  input.home_score = null;
  input.away_score = null;
  input.freshness_score = 0.3;
  input.market = {
    available: false,
    usable_for_model: false,
    assessment_id: null,
    reliability_score: 0,
    approved_model_weight_cap: 0,
    final_outcome: null,
    next_goal: null,
    direction: "unknown",
    limitations: ["Market evidence is unavailable."],
  };
  input.events = {
    available: false,
    home_pressure: 0,
    away_pressure: 0,
    home_impact: 0,
    away_impact: 0,
    limitations: ["Event evidence is unavailable."],
  };

  const snapshot = buildCompetitionPredictionSnapshot(input);
  assert.equal(snapshot.risk.level, "high");
  assert.equal(snapshot.risk.reasons.includes("stale_data"), true);
  assert.equal(snapshot.risk.reasons.includes("missing_odds"), true);
  assert.equal(snapshot.risk.reasons.includes("missing_events"), true);
  assert.equal(snapshot.risk.reasons.includes("inference_fallback"), true);
  assert.equal(snapshot.odds_intelligence_reference.assigned_market_weight, 0);
  assert.ok(Math.abs(total(snapshot.model_output.final_outcome) - 1) < 1e-9);
  assert.ok(Math.abs(total(snapshot.model_output.next_goal) - 1) < 1e-9);
});

test("no-goal probability increases when the same match state is much later", () => {
  const earlier = baseInput();
  earlier.minute = 60;
  const later = baseInput();
  later.minute = 91;

  const earlySnapshot = buildCompetitionPredictionSnapshot(earlier);
  const lateSnapshot = buildCompetitionPredictionSnapshot(later);
  assert.ok(lateSnapshot.model_output.next_goal.none > earlySnapshot.model_output.next_goal.none);
});

test("scoreline output never goes below the current score", () => {
  const input = baseInput();
  input.home_score = 2;
  input.away_score = 1;
  const snapshot = buildCompetitionPredictionSnapshot(input);

  for (const outcome of snapshot.model_output.final_score.outcomes) {
    assert.ok(outcome.home_score >= 2);
    assert.ok(outcome.away_score >= 1);
  }
  const scoreTotal = snapshot.model_output.final_score.outcomes.reduce(
    (sum, outcome) => sum + outcome.probability,
    snapshot.model_output.final_score.other_probability,
  );
  assert.ok(Math.abs(scoreTotal - 1) < 1e-9);
});

test("invalid usable market evidence is rejected", () => {
  const input = baseInput();
  input.market.assessment_id = null;
  assert.throws(
    () => buildCompetitionPredictionSnapshot(input),
    /Usable market evidence requires/,
  );
});
