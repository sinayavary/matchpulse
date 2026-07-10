import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLivePredictionAgentOutputSafe,
  buildLivePredictionAgentOutput,
  normalizeOutcomeProbabilities,
  type LivePredictionInputSummary
} from "./live-prediction-agent.js";

const inputSummary: LivePredictionInputSummary = {
  fixture_id: "fixture-10a",
  phase: "second_half",
  minute: 67,
  home_score: 1,
  away_score: 0,
  score_diff: 1,
  has_scoreboard: true,
  has_odds: true,
  odds_count: 3,
  data_quality: "complete",
  freshness_label: "fresh",
  market_reliability: "available",
  event_pressure: "low"
};

test("builds a complete live prediction agent output", () => {
  const output = buildLivePredictionAgentOutput({
    fixture_id: inputSummary.fixture_id,
    generated_at: "2026-07-10T10:00:00.000Z",
    input_summary: inputSummary
  });

  assert.equal(output.agent_version, "live-predictor-v1");
  for (const field of ["fixture_id", "generated_at", "input_summary", "outcome_probabilities", "scenario_probabilities", "confidence", "risk", "explanation", "safety_note"]) {
    assert.ok(field in output);
  }
  assert.equal(Object.values(output.outcome_probabilities).reduce((sum, value) => sum + value, 0), 1);
});

test("normalizes and falls back for invalid outcome probabilities", () => {
  const normalized = normalizeOutcomeProbabilities({ home_result: 0.8, draw_result: 0.4, away_result: 0.4 });
  assert.deepEqual(normalized, { home_result: 0.5, draw_result: 0.25, away_result: 0.25 });
  const fallback = normalizeOutcomeProbabilities({ home_result: Number.NaN, draw_result: 0, away_result: Number.POSITIVE_INFINITY });
  assert.deepEqual(fallback, { home_result: 1 / 3, draw_result: 1 / 3, away_result: 1 / 3 });
});

test("clamps scenarios and confidence and defaults risk", () => {
  const output = buildLivePredictionAgentOutput({
    fixture_id: inputSummary.fixture_id,
    generated_at: "2026-07-10T10:00:00.000Z",
    input_summary: inputSummary,
    scenario_probabilities: { home_pressure_increase: 2, away_pressure_increase: -1 },
    confidence: { score: 4 },
    risk: {}
  });

  assert.equal(output.scenario_probabilities.home_pressure_increase, 1);
  assert.equal(output.scenario_probabilities.away_pressure_increase, 0);
  assert.equal(output.confidence.score, 1);
  assert.equal(output.risk.level, "medium");
});

test("allows negative safety language but rejects forbidden structured keys recursively", () => {
  const output = buildLivePredictionAgentOutput({
    fixture_id: inputSummary.fixture_id,
    generated_at: "2026-07-10T10:00:00.000Z",
    input_summary: inputSummary
  });
  assert.match(output.safety_note, /betting|wagering/i);
  assert.doesNotThrow(() => assertLivePredictionAgentOutputSafe({ outcome_probabilities: {}, scenario_probabilities: {}, confidence: {} }));

  for (const key of ["recommended_bet", "stake", "wallet", "expected_value", "raw_payload"]) {
    assert.throws(() => assertLivePredictionAgentOutputSafe({ nested: [{ [key.toUpperCase()]: true }] }), /Forbidden/);
  }
});
