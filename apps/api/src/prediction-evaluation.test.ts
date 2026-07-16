import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePrediction } from "./prediction-evaluation.js";
import type { FinalPredictionSnapshot } from "./final-prediction-domain.js";

const snapshot = { identity: { snapshot_id: "s", fixture_id: "f", as_of: "2026-01-01T12:00:00.000Z", generated_at: "2026-01-01T12:00:00.000Z", sequence: 1, trigger: "manual", feature_version: "v", prediction_contract_version: "prediction-domain-v1" }, model_output: { final_outcome: { home: 0.6, draw: 0.2, away: 0.2 } } } as FinalPredictionSnapshot;
const label = { snapshot_id: "s", fixture_id: "f", as_of: "2026-01-01T12:00:00.000Z", labeled_at: "2026-01-01T12:20:00.000Z", status: "complete", final_outcome: "home", next_goal_side: "home", goal_in_next_5m: true, goal_in_next_10m: true, goal_in_next_15m: true, final_home_score: 2, final_away_score: 1, current_result_survival: "changed", momentum_shift: "unavailable", source_finalized_at: "2026-01-01T12:20:00.000Z", limitations: [] } as any;

test("evaluation metrics are deterministic and segmented", () => { const report = evaluatePrediction({ snapshot, label, evaluated_at: "2026-01-01T12:21:00Z", segment_keys: ["second_half", "fresh"] }); assert.equal(report.record.metrics.accuracy, 1); assert.equal(report.record.passed_quality_gate, true); assert.equal(Object.keys(report.segments).length, 2); assert.ok((report.record.metrics.multiclass_log_loss ?? 0) > 0); });
test("incomplete labels produce bounded non-passing evaluation", () => { const report = evaluatePrediction({ snapshot, label: { ...label, status: "partial" }, evaluated_at: "2026-01-01T12:21:00Z" }); assert.equal(report.record.passed_quality_gate, false); });
