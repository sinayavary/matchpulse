import assert from "node:assert/strict";
import test from "node:test";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { buildPredictionSpecialists } from "./prediction-specialists.js";

function features(overrides: Record<string, unknown> = {}) {
  return buildPredictionEngineFeatures({
    fixture_id: "f1",
    as_of: "2026-07-11T10:00:00Z",
    has_fixture: true,
    normalized_phase: "second_half",
    phase: "H2",
    minute: 75,
    home_score: 1,
    away_score: 0,
    score_timestamp: "2026-07-11T09:59:55Z",
    event_timestamp: "2026-07-11T09:59:50Z",
    pre_match_prior: { home: 0.42, draw: 0.3, away: 0.28 },
    event_context: {
      event_count: 8,
      pressure_level: "medium",
      pressure_side: "home",
      home_activity: 0.75,
      away_activity: 0.3,
      home_red_cards: 0,
      away_red_cards: 0,
      has_event_impact: true,
    },
    ...overrides,
  });
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

test("specialists are deterministic and all available distributions are normalized", () => {
  const first = buildPredictionSpecialists(features());
  const second = buildPredictionSpecialists(features());
  assert.deepEqual(first, second);
  assert.ok(first.state.final_outcome);
  assert.ok(first.tempo.next_goal);
  assert.ok(first.tempo.goal_horizon);
  assert.ok(first.tempo.momentum_shift);
  assert.ok(first.score_distribution.final_score);
  assert.ok(Math.abs(sum(first.state.final_outcome!) - 1) < 1e-6);
  assert.ok(Math.abs(sum(first.tempo.next_goal!) - 1) < 1e-6);
  assert.ok(Math.abs(sum(first.tempo.momentum_shift!) - 1) < 1e-6);
  const score = first.score_distribution.final_score!;
  const scoreTotal = score.outcomes.reduce((total, item) => total + item.probability, 0) + score.other_probability;
  assert.ok(Math.abs(scoreTotal - 1) < 1e-6);
});

test("a late home lead materially raises the home state outcome", () => {
  const tied = buildPredictionSpecialists(features({ home_score: 0, away_score: 0 }));
  const leading = buildPredictionSpecialists(features({ home_score: 2, away_score: 0 }));
  assert.ok(leading.state.final_outcome!.home > tied.state.final_outcome!.home);
  assert.ok(leading.state.current_result_survival!.current_result_holds > 0.5);
});

test("a red card reduces the affected side share", () => {
  const even = buildPredictionSpecialists(features());
  const homeRed = buildPredictionSpecialists(features({
    event_context: {
      event_count: 8,
      pressure_level: "medium",
      pressure_side: "home",
      home_activity: 0.75,
      away_activity: 0.3,
      home_red_cards: 1,
      away_red_cards: 0,
      has_event_impact: true,
    },
  }));
  assert.ok(homeRed.tempo.next_goal!.home < even.tempo.next_goal!.home);
});

test("goal horizon probabilities are monotonic", () => {
  const output = buildPredictionSpecialists(features()).tempo.goal_horizon!;
  assert.ok(output.next_5m <= output.next_10m);
  assert.ok(output.next_10m <= output.next_15m);
});

test("finished matches produce deterministic state and final score", () => {
  const output = buildPredictionSpecialists(features({
    normalized_phase: "finished",
    phase: "F",
    minute: 95,
    home_score: 2,
    away_score: 1,
  }));
  assert.deepEqual(output.state.final_outcome, { home: 1, draw: 0, away: 0 });
  assert.deepEqual(output.score_distribution.final_score, {
    outcomes: [{ home_score: 2, away_score: 1, probability: 1 }],
    other_probability: 0,
  });
  assert.deepEqual(output.tempo.goal_horizon, { next_5m: 0, next_10m: 0, next_15m: 0 });
  assert.deepEqual(output.tempo.next_goal, { home: 0, none: 1, away: 0 });
});

test("missing score disables state and score specialists but preserves fallback", () => {
  const output = buildPredictionSpecialists(features({
    home_score: null,
    away_score: null,
    minute: null,
    event_context: null,
  }));
  assert.equal(output.state.available, false);
  assert.equal(output.score_distribution.available, false);
  assert.equal(output.fallback.available, true);
  assert.ok(output.fallback.final_outcome);
});

test("specialist outputs contain no wagering or provider internals", () => {
  const serialized = JSON.stringify(buildPredictionSpecialists(features()));
  for (const forbidden of [
    "recommended_bet",
    "stake",
    "payout",
    "profit",
    "provider_key",
    "component_scores",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
