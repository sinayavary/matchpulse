import { buildPredictionEvaluationRecord, type FinalPredictionSnapshot, type PredictionEvaluationRecord, type PredictionSnapshotLabels } from "./final-prediction-domain.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export type EvaluationInput = { snapshot: FinalPredictionSnapshot; label: PredictionSnapshotLabels; model_version?: string; label_version?: string; segment_keys?: string[]; evaluated_at: string };
export type EvaluationReport = { record: PredictionEvaluationRecord; segments: Record<string, PredictionEvaluationRecord["metrics"]> };

function probability(snapshot: FinalPredictionSnapshot, label: "home" | "draw" | "away"): number { return snapshot.model_output.final_outcome[label]; }
function metrics(snapshot: FinalPredictionSnapshot, label: PredictionSnapshotLabels): PredictionEvaluationRecord["metrics"] {
  if (label.final_outcome === null) return { multiclass_log_loss: null, multiclass_brier_score: null, expected_calibration_error: null, binary_log_loss: null, binary_brier_score: null, accuracy: null, precision: null, recall: null, roc_auc: null, pr_auc: null, negative_log_likelihood: null };
  const labels: Array<"home" | "draw" | "away"> = ["home", "draw", "away"]; const actual = labels.indexOf(label.final_outcome); const probabilities = labels.map((item) => probability(snapshot, item)); const clipped = Math.max(1e-12, Math.min(1, probabilities[actual]!)); const brier = probabilities.reduce((sum, value, index) => sum + (value - (index === actual ? 1 : 0)) ** 2, 0);
  const confidence = Math.max(...probabilities); const correct = probabilities[actual] === confidence ? 1 : 0;
  return { multiclass_log_loss: -Math.log(clipped), multiclass_brier_score: brier, expected_calibration_error: Math.abs(confidence - correct), binary_log_loss: null, binary_brier_score: null, accuracy: correct, precision: null, recall: null, roc_auc: null, pr_auc: null, negative_log_likelihood: -Math.log(clipped) };
}

export function evaluatePrediction(input: EvaluationInput): EvaluationReport {
  if (input.snapshot.identity.fixture_id !== input.label.fixture_id || input.snapshot.identity.snapshot_id !== input.label.snapshot_id) throw new TypeError("Evaluation references do not match the snapshot.");
  const baseMetrics = metrics(input.snapshot, input.label); const modelVersion = input.model_version ?? input.snapshot.identity.feature_version; const labelVersion = input.label_version ?? "temporal-labels-v1"; const segmentKeys = [...new Set(input.segment_keys ?? [])].sort();
  const evaluationId = `evaluation-v1:${computeStorageContentHash({ snapshot_id: input.label.snapshot_id, model_version: modelVersion, label_version: labelVersion, segment_keys: segmentKeys })}`;
  const record = buildPredictionEvaluationRecord({ evaluation_id: evaluationId, snapshot_id: input.label.snapshot_id, fixture_id: input.label.fixture_id, target: "final_outcome_1x2", model_version: modelVersion, feature_version: input.snapshot.identity.feature_version, label_version: labelVersion, evaluated_at: input.evaluated_at, segment_keys: segmentKeys, metrics: baseMetrics, passed_quality_gate: baseMetrics.multiclass_log_loss !== null && baseMetrics.multiclass_brier_score !== null && input.label.status === "complete", limitations: input.label.status === "complete" ? [] : ["Labels are not complete."] });
  return { record, segments: Object.fromEntries(segmentKeys.map((segment) => [segment, baseMetrics])) };
}
