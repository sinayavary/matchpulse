import test from "node:test";
import assert from "node:assert/strict";
import { buildTemporalLabels } from "./temporal-labels.js";
import { decidePromotion, runEvaluationLearning, sealTemporalDataset, type EvaluationLearningRecord } from "./evaluation-learning-runtime.js";
import type { FinalPredictionSnapshot } from "./final-prediction-domain.js";

function record(fixtureId: string, minute: number, asOf: string): EvaluationLearningRecord {
  const snapshot = { identity: { snapshot_id: `${fixtureId}-${minute}`, fixture_id: fixtureId, as_of: asOf, generated_at: asOf, sequence: minute, trigger: "timer", feature_version: "features-v1", prediction_contract_version: "prediction-domain-v1" }, match_context: { phase: "first_half", normalized_phase: "first_half", minute, home_score: 0, away_score: 0, score_diff: 0 }, model_output: { final_outcome: { home: 0.6, draw: 0.2, away: 0.2 } } } as unknown as FinalPredictionSnapshot;
  const finalized = new Date(Date.parse(asOf) + 60 * 60 * 1000).toISOString();
  const labels = buildTemporalLabels({ snapshot, finalized_at: finalized, final_home_score: 1, final_away_score: 0, timeline: [] });
  return { snapshot, labels, segment_keys: ["first_half"] };
}

test("seals only complete temporal records and keeps fixture groups together", () => {
  const rows = [record("f1", 1, "2026-01-01T12:00:00Z"), record("f2", 1, "2026-01-02T12:00:00Z"), record("f3", 1, "2026-01-03T12:00:00Z")];
  const sealed = sealTemporalDataset(rows, { dataset_version: "dataset-v1", now: "2026-01-04T00:00:00Z" });
  assert.equal(sealed?.row_count, 3); assert.equal(sealed?.fixture_count, 3); assert.match(sealed?.manifest_hash ?? "", /^[a-f0-9]{64}$/);
});

test("insufficient data never creates a model or fabricated evaluation rows", () => {
  const result = runEvaluationLearning([record("f1", 1, "2026-01-01T12:00:00Z")], { minimum_training_rows: 1, minimum_validation_rows: 1, minimum_test_rows: 1, now: "2026-01-04T00:00:00Z" });
  assert.equal(result.status, "WAITING_FOR_TRAINING_DATA"); assert.equal(result.dataset, null); assert.equal(result.learning.model_created, false); assert.equal(result.evaluations.length, 0);
});

test("promotion is shadow-only until the candidate passes, and regression rolls back", () => {
  assert.equal(decidePromotion({ candidate_version: "candidate-v1", candidate_passed_gate: false, champion_version: "champion-v1" }).action, "shadow");
  assert.equal(decidePromotion({ candidate_version: "candidate-v1", candidate_passed_gate: true, champion_version: "champion-v1" }).action, "promote");
  assert.equal(decidePromotion({ candidate_version: "candidate-v1", candidate_passed_gate: true, regression_detected: true, champion_version: "champion-v1" }).action, "rollback");
});
