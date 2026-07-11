import assert from "node:assert/strict";
import test from "node:test";
import {
  composeFinalPredictionSnapshot,
  type PredictionCompositionInput,
} from "./prediction-engine-v1.js";
import type { FinalPredictionModelOutput } from "./final-prediction-domain.js";

const fallback: FinalPredictionModelOutput = {
  final_outcome: { home: 0.34, draw: 0.33, away: 0.33 },
  next_goal: { home: 0.33, none: 0.34, away: 0.33 },
  goal_horizon: { next_5m: 0.08, next_10m: 0.16, next_15m: 0.24 },
  final_score: {
    outcomes: [{ home_score: 1, away_score: 1, probability: 0.2 }],
    other_probability: 0.8,
  },
  current_result_survival: {
    current_result_holds: 0.5,
    current_result_changes: 0.5,
  },
  momentum_shift: {
    home_strengthens: 0.33,
    neutral: 0.34,
    away_strengthens: 0.33,
  },
};

function baseInput(): PredictionCompositionInput {
  return {
    fixture_id: "17952170",
    as_of: "2026-07-11T20:00:00.000Z",
    generated_at: "2026-07-11T20:00:01.000Z",
    sequence: 960,
    trigger: "odds_movement",
    feature_reference: {
      feature_version: "feature-v1",
      feature_hash: "feature-hash",
      feature_count: 18,
    },
    match_context: {
      phase: "H2",
      normalized_phase: "second_half",
      minute: 72,
      home_score: 1,
      away_score: 1,
      score_diff: 0,
    },
    data_coverage: {
      has_fixture: true,
      has_scoreboard: true,
      has_minute: true,
      has_odds: true,
      has_reliable_odds: true,
      has_events: true,
      has_event_impact: true,
      has_pre_match_features: true,
      feature_coverage_score: 0.9,
    },
    specialists: [
      {
        model_role: "pre_match_prior",
        model_version: "prior-v1",
        available: true,
        assigned_weight: 0.3,
        output_quality: 0.8,
        limitations: [],
        output: {
          final_outcome: { home: 0.4, draw: 0.35, away: 0.25 },
          next_goal: { home: 0.35, none: 0.35, away: 0.3 },
        },
      },
      {
        model_role: "live_state",
        model_version: "live-v1",
        available: true,
        assigned_weight: 0.5,
        output_quality: 0.9,
        limitations: [],
        output: {
          final_outcome: { home: 0.5, draw: 0.3, away: 0.2 },
          next_goal: { home: 0.45, none: 0.25, away: 0.3 },
          goal_horizon: { next_5m: 0.12, next_10m: 0.22, next_15m: 0.34 },
          final_score: {
            outcomes: [
              { home_score: 2, away_score: 1, probability: 0.3 },
              { home_score: 1, away_score: 1, probability: 0.25 },
            ],
            other_probability: 0.45,
          },
          current_result_survival: {
            current_result_holds: 0.38,
            current_result_changes: 0.62,
          },
          momentum_shift: {
            home_strengthens: 0.5,
            neutral: 0.3,
            away_strengthens: 0.2,
          },
        },
      },
      {
        model_role: "market",
        model_version: "market-v1",
        available: true,
        assigned_weight: 0.2,
        output_quality: 0.95,
        limitations: [],
        output: {
          final_outcome: { home: 0.55, draw: 0.27, away: 0.18 },
          next_goal: { home: 0.48, none: 0.24, away: 0.28 },
          goal_horizon: { next_5m: 0.1, next_10m: 0.2, next_15m: 0.3 },
          final_score: {
            outcomes: [
              { home_score: 2, away_score: 1, probability: 0.26 },
              { home_score: 1, away_score: 1, probability: 0.3 },
            ],
            other_probability: 0.44,
          },
          current_result_survival: {
            current_result_holds: 0.42,
            current_result_changes: 0.58,
          },
          momentum_shift: {
            home_strengthens: 0.48,
            neutral: 0.32,
            away_strengthens: 0.2,
          },
        },
      },
    ],
    fallback_output: fallback,
    confidence: {
      level: "high",
      score: 0.82,
      calibration_score: 0.8,
      model_agreement_score: 0.84,
      data_coverage_score: 0.9,
      freshness_score: 0.95,
      out_of_distribution_score: 0.1,
      reasons: ["fresh complete canonical state"],
    },
    risk: { level: "low", reasons: [] },
    odds_intelligence_reference: {
      odds_intelligence_version: "odds-intelligence-v1",
      assessment_id: "odds-assessment-v1:abc",
      usable_for_model: true,
      reliability_score: 0.88,
      assigned_market_weight: 0.2,
    },
    explanation: {
      summary: "The live state and reliable market context modestly favor the home scenario.",
      main_factors: ["Level score in the second half", "Reliable market context available"],
      limitations: [],
    },
    composition_policy: { max_scorelines: 8 },
  };
}

test("composition is deterministic, valid, and preserves the public safety boundary", () => {
  const input = baseInput();
  const first = composeFinalPredictionSnapshot(input);
  const second = composeFinalPredictionSnapshot(structuredClone(input));

  assert.deepEqual(first, second);
  assert.match(first.identity.snapshot_id, /^prediction-snapshot-v1:[a-f0-9]{64}$/);
  assert.deepEqual(first.model_output.final_outcome, {
    home: 0.48,
    draw: 0.309,
    away: 0.211,
  });
  assert.equal(first.safety_note.includes("not betting recommendations"), true);
  assert.equal(first.specialist_contributions.length, 3);
  assert.equal(first.specialist_contributions.reduce((sum, item) => sum + item.assigned_weight, 0), 1);
});

test("market contribution cannot exceed the odds-intelligence cap", () => {
  const input = baseInput();
  input.odds_intelligence_reference.assigned_market_weight = 0.1;

  assert.throws(
    () => composeFinalPredictionSnapshot(input),
    /Market specialist weight exceeds/,
  );
});

test("unavailable specialists must not carry weight or output", () => {
  const input = baseInput();
  input.specialists = [
    ...input.specialists,
    {
      model_role: "event_sequence",
      model_version: "events-v1",
      available: false,
      assigned_weight: 0.01,
      output_quality: 0,
      limitations: ["unavailable"],
    },
  ];

  assert.throws(
    () => composeFinalPredictionSnapshot(input),
    /Unavailable specialists/,
  );
});

test("missing target output uses the explicit fallback without changing global weights", () => {
  const input = baseInput();
  input.specialists = input.specialists.map((specialist) => ({
    ...specialist,
    output: {
      final_outcome: specialist.output?.final_outcome,
      next_goal: specialist.output?.next_goal,
    },
  }));

  const snapshot = composeFinalPredictionSnapshot(input);
  assert.deepEqual(snapshot.model_output.goal_horizon, fallback.goal_horizon);
  assert.deepEqual(snapshot.model_output.final_score, fallback.final_score);
  assert.deepEqual(
    snapshot.model_output.current_result_survival,
    fallback.current_result_survival,
  );
});

test("scoreline merge is stable and moves omitted mass into other_probability", () => {
  const input = baseInput();
  input.composition_policy.max_scorelines = 1;

  const snapshot = composeFinalPredictionSnapshot(input);
  assert.equal(snapshot.model_output.final_score.outcomes.length, 1);
  const total = snapshot.model_output.final_score.outcomes.reduce(
    (sum, outcome) => sum + outcome.probability,
    snapshot.model_output.final_score.other_probability,
  );
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("weights must be explicit and sum to one", () => {
  const input = baseInput();
  input.specialists = input.specialists.map((specialist, index) => (
    index === 0 ? { ...specialist, assigned_weight: 0.29 } : specialist
  ));

  assert.throws(
    () => composeFinalPredictionSnapshot(input),
    /weights must sum to one/,
  );
});

test("the engine does not mutate caller-owned inputs", () => {
  const input = baseInput();
  const before = structuredClone(input);
  composeFinalPredictionSnapshot(input);
  assert.deepEqual(input, before);
});

test("invalid specialist probability distributions are rejected", () => {
  const input = baseInput();
  input.specialists = input.specialists.map((specialist, index) => (
    index === 0
      ? {
          ...specialist,
          output: {
            ...specialist.output,
            final_outcome: { home: 0.5, draw: 0.4, away: 0.2 },
          },
        }
      : specialist
  ));

  assert.throws(
    () => composeFinalPredictionSnapshot(input),
    /distribution must sum to one/,
  );
});
