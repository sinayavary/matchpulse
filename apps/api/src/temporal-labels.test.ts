import test from "node:test";
import assert from "node:assert/strict";
import { buildTemporalLabels } from "./temporal-labels.js";
import type { FinalPredictionSnapshot } from "./final-prediction-domain.js";

const snapshot = { identity: { snapshot_id: "s", fixture_id: "f", as_of: "2026-01-01T12:00:00.000Z", generated_at: "2026-01-01T12:00:00.000Z", sequence: 1, trigger: "manual", feature_version: "v", prediction_contract_version: "prediction-domain-v1" }, match_context: { phase: "2h", normalized_phase: "second_half", minute: 60, home_score: 1, away_score: 0, score_diff: 1 } } as FinalPredictionSnapshot;

test("labels only future timeline and preserves monotonic goal horizons", () => {
  const labels = buildTemporalLabels({ snapshot, finalized_at: "2026-01-01T12:20:00Z", final_home_score: 2, final_away_score: 1, timeline: [{ event_id: "g", stream_kind: "scores", fixture_id: "f", sequence: 2, provider_timestamp: "2026-01-01T12:03:00Z", event_type: "goal", payload: { team_side: "home" } }] });
  assert.equal(labels.status, "complete"); assert.equal(labels.final_outcome, "home"); assert.equal(labels.next_goal_side, "home"); assert.equal(labels.goal_in_next_5m, true); assert.equal(labels.goal_in_next_10m, true); assert.equal(labels.goal_in_next_15m, true);
});

test("incomplete and non-monotonic timelines never fabricate complete labels", () => {
  const labels = buildTemporalLabels({ snapshot, finalized_at: null, final_home_score: null, final_away_score: null, timeline: [{ event_id: "b", stream_kind: "scores", fixture_id: "f", sequence: 3, provider_timestamp: "2026-01-01T11:59:00Z", event_type: "goal", payload: {} }] });
  assert.equal(labels.status, "partial"); assert.equal(labels.next_goal_side, null); assert.equal(labels.goal_in_next_5m, null);
});
