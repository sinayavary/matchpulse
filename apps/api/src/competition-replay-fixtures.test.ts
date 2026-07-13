import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPETITION_REPLAY_FIXTURE_ID,
  getCompetitionReplayCheckpoint,
  listCompetitionReplayCheckpoints,
} from "./competition-replay-fixtures.js";

const FORBIDDEN_TEXT = [
  "replay-private-opening",
  "replay-private-shift",
  "replay-private-terminal",
  "assessment_id",
  "approved_model_weight_cap",
  "specialist_contributions",
  "feature_reference",
  "odds_intelligence_reference",
  "fair_probability",
  "consensus_probability",
  "provider_payload",
  "raw_payload",
];

test("competition replay exposes a stable ordered checkpoint summary", () => {
  const checkpoints = listCompetitionReplayCheckpoints();
  assert.deepEqual(
    checkpoints.map((checkpoint) => checkpoint.checkpoint_id),
    ["opening-balance", "pressure-shift", "terminal-home"],
  );
  assert.deepEqual(
    checkpoints.map((checkpoint) => checkpoint.minute),
    [18, 67, 95],
  );
  assert.equal(checkpoints[0]?.market_freshness, "fresh");
  assert.equal(checkpoints[1]?.market_freshness, "aging");
  assert.equal(checkpoints[2]?.market_freshness, "stale");
});

test("every replay checkpoint contains the full public prediction and market boundaries", () => {
  for (const summary of listCompetitionReplayCheckpoints()) {
    const checkpoint = getCompetitionReplayCheckpoint(summary.checkpoint_id);
    if (checkpoint === null) throw new Error("Replay checkpoint is missing.");
    const { response } = checkpoint;
    if (response.data === null) throw new Error("Replay prediction data is missing.");
    const prediction = response.data;
    assert.equal(prediction.fixture_id, COMPETITION_REPLAY_FIXTURE_ID);
    assert.equal(response.meta.mode, "replay");
    assert.equal(response.market_analysis.fixture_id, COMPETITION_REPLAY_FIXTURE_ID);
    assert.deepEqual(Object.keys(prediction.final_outcome).sort(), ["away", "draw", "home"]);
    assert.deepEqual(Object.keys(prediction.next_goal).sort(), ["away", "home", "none"]);
    assert.deepEqual(Object.keys(prediction.goal_horizon).sort(), ["next_10m", "next_15m", "next_5m"]);
    assert.ok(prediction.final_score.outcomes.length > 0);
    assert.equal(typeof prediction.current_result_survival.current_result_holds, "number");
    assert.equal(typeof prediction.momentum_shift.neutral, "number");
    assert.equal(typeof prediction.confidence.score, "number");
    assert.equal(typeof prediction.risk.level, "string");
    assert.equal(typeof prediction.explanation.summary, "string");
    assert.equal(typeof prediction.data_quality.freshness, "string");
  }
});

test("replay progression demonstrates market and terminal state changes", () => {
  const opening = getCompetitionReplayCheckpoint("opening-balance");
  const shift = getCompetitionReplayCheckpoint("pressure-shift");
  const terminal = getCompetitionReplayCheckpoint("terminal-home");
  if (opening === null || shift === null || terminal === null) {
    throw new Error("Replay progression checkpoint is missing.");
  }
  assert.equal(opening.response.market_analysis.reliability, "strong");
  assert.equal(shift.response.market_analysis.reliability, "limited");
  assert.equal(shift.response.market_analysis.volatility, "high");
  assert.equal(terminal.response.data?.match_state.normalized_phase, "finished");
  assert.deepEqual(terminal.response.data?.final_outcome, { home: 1, draw: 0, away: 0 });
  assert.equal(terminal.response.data?.next_goal.none, 1);
  assert.equal(terminal.response.market_analysis.usable_market_count, 0);
});

test("replay responses are deterministic and recursively exclude protected internals", () => {
  const first = getCompetitionReplayCheckpoint("pressure-shift");
  const second = getCompetitionReplayCheckpoint("pressure-shift");
  assert.deepEqual(first, second);
  const text = JSON.stringify(first);
  for (const forbidden of FORBIDDEN_TEXT) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test("unknown replay checkpoint is a bounded null result", () => {
  assert.equal(getCompetitionReplayCheckpoint("not-a-checkpoint"), null);
});
