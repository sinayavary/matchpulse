import { evaluatePrediction, type EvaluationReport } from "./prediction-evaluation.js";
import type { FinalPredictionSnapshot, PredictionSnapshotLabels, PredictionEvaluationMetrics } from "./final-prediction-domain.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";
import { getDbClient } from "./db.js";
import { createPredictionStorage } from "./prediction-storage.js";
import { updateManagedWorkerHealth, WORKER_SERVICES } from "./automatic-data-runtime.js";
import { buildTemporalLabels } from "./temporal-labels.js";
import { resolveMatchLifecycle } from "./match-lifecycle.js";

export type EvaluationLearningRecord = { snapshot: FinalPredictionSnapshot; labels: PredictionSnapshotLabels; segment_keys?: string[] };
export type EvaluationLearningPolicy = { minimum_training_rows?: number; minimum_validation_rows?: number; minimum_test_rows?: number; now?: string };
export type SealedDataset = { dataset_version: string; label_version: string; feature_version: string; split_strategy: "fixture_grouped_chronological_60_20_20"; row_count: number; fixture_count: number; training_row_count: number; validation_row_count: number; test_row_count: number; snapshot_ids: string[]; manifest_hash: string; sealed_at: string };
export type PromotionDecision = { action: "promote" | "shadow" | "rollback"; reason: string; candidate_version: string; champion_version: string | null };
export type EvaluationLearningResult = { status: "EVALUATED" | "WAITING_FOR_TRAINING_DATA"; dataset: SealedDataset | null; evaluations: EvaluationReport[]; aggregate: PredictionEvaluationMetrics | null; split_counts: { training: number; validation: number; test: number }; learning: { mode: "batch_then_shadow"; model_created: false; promotion: "blocked" | "shadow_only" }; limitations: string[] };

const DEFAULTS = { minimum_training_rows: 30, minimum_validation_rows: 10, minimum_test_rows: 10 };
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const mean = (values: number[]): number | null => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
function timestamp(value: string, name: string): number { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new TypeError(`${name} must be a valid timestamp.`); return parsed; }

function eligible(record: EvaluationLearningRecord): boolean {
  const snapshotTime = timestamp(record.snapshot.identity.as_of, "as_of");
  const labelTime = timestamp(record.labels.labeled_at, "labeled_at");
  if (record.snapshot.identity.fixture_id !== record.labels.fixture_id || record.snapshot.identity.snapshot_id !== record.labels.snapshot_id) return false;
  if (snapshotTime >= labelTime || record.labels.status !== "complete" || record.labels.limitations.length > 0) return false;
  return record.labels.source_finalized_at === null || timestamp(record.labels.source_finalized_at, "source_finalized_at") >= snapshotTime;
}

function split(records: EvaluationLearningRecord[]): { training: EvaluationLearningRecord[]; validation: EvaluationLearningRecord[]; test: EvaluationLearningRecord[] } {
  const groups = new Map<string, EvaluationLearningRecord[]>();
  for (const record of records) groups.set(record.snapshot.identity.fixture_id, [...(groups.get(record.snapshot.identity.fixture_id) ?? []), record]);
  const fixtures = [...groups.entries()].sort((a, b) => Math.max(...a[1].map((x) => timestamp(x.snapshot.identity.as_of, "as_of"))) - Math.max(...b[1].map((x) => timestamp(x.snapshot.identity.as_of, "as_of"))) || a[0].localeCompare(b[0]));
  const counts = { training: Math.floor(fixtures.length * 0.6), validation: Math.floor(fixtures.length * 0.2) };
  const training: EvaluationLearningRecord[] = [], validation: EvaluationLearningRecord[] = [], test: EvaluationLearningRecord[] = [];
  fixtures.forEach(([, rows], index) => (index < counts.training ? training : index < counts.training + counts.validation ? validation : test).push(...rows.sort((a, b) => timestamp(a.snapshot.identity.as_of, "as_of") - timestamp(b.snapshot.identity.as_of, "as_of"))));
  return { training, validation, test };
}

export function sealTemporalDataset(records: readonly EvaluationLearningRecord[], input: { dataset_version: string; now: string }): SealedDataset | null {
  const valid = records.filter(eligible).sort((a, b) => a.snapshot.identity.snapshot_id.localeCompare(b.snapshot.identity.snapshot_id));
  if (valid.length === 0) return null;
  const sets = split(valid);
  const snapshotIds = valid.map((x) => x.snapshot.identity.snapshot_id);
  return { dataset_version: input.dataset_version, label_version: valid[0]!.labels.status === "complete" ? "temporal-labels-v1" : "unknown", feature_version: valid[0]!.snapshot.identity.feature_version, split_strategy: "fixture_grouped_chronological_60_20_20", row_count: valid.length, fixture_count: new Set(valid.map((x) => x.snapshot.identity.fixture_id)).size, training_row_count: sets.training.length, validation_row_count: sets.validation.length, test_row_count: sets.test.length, snapshot_ids: snapshotIds, manifest_hash: computeStorageContentHash({ dataset_version: input.dataset_version, snapshot_ids: snapshotIds, split_strategy: "fixture_grouped_chronological_60_20_20" }), sealed_at: new Date(timestamp(input.now, "now")).toISOString() };
}

function aggregate(reports: EvaluationReport[]): PredictionEvaluationMetrics | null {
  if (reports.length === 0) return null;
  const keys: (keyof PredictionEvaluationMetrics)[] = ["multiclass_log_loss", "multiclass_brier_score", "expected_calibration_error", "binary_log_loss", "binary_brier_score", "accuracy", "precision", "recall", "roc_auc", "pr_auc", "negative_log_likelihood"];
  return Object.fromEntries(keys.map((key) => [key, mean(reports.map((report) => report.record.metrics[key]).filter(finite))])) as PredictionEvaluationMetrics;
}

export function decidePromotion(input: { candidate_version: string; champion_version?: string | null; candidate_passed_gate: boolean; regression_detected?: boolean }): PromotionDecision {
  if (input.regression_detected) return { action: "rollback", reason: "Quality or runtime regression detected; champion remains immutable.", candidate_version: input.candidate_version, champion_version: input.champion_version ?? null };
  if (!input.candidate_passed_gate) return { action: "shadow", reason: "Candidate is retained for bounded shadow evaluation only.", candidate_version: input.candidate_version, champion_version: input.champion_version ?? null };
  return { action: "shadow", reason: "Candidate passed evaluation but automatic promotion is disabled; human review is required.", candidate_version: input.candidate_version, champion_version: input.champion_version ?? null };
}

export function runEvaluationLearning(records: readonly EvaluationLearningRecord[], policy: EvaluationLearningPolicy = {}): EvaluationLearningResult {
  const now = new Date(timestamp(policy.now ?? new Date().toISOString(), "now")).toISOString();
  const valid = records.filter(eligible); const sets = split(valid); const dataset = sealTemporalDataset(valid, { dataset_version: `temporal-dataset-v1:${computeStorageContentHash(valid.map((x) => x.snapshot.identity.snapshot_id).sort())}`, now });
  const minimum = { ...DEFAULTS, ...policy }; const enough = sets.training.length >= minimum.minimum_training_rows! && sets.validation.length >= minimum.minimum_validation_rows! && sets.test.length >= minimum.minimum_test_rows!;
  const evaluations = enough ? sets.test.map((record) => evaluatePrediction({ snapshot: record.snapshot, label: record.labels, model_version: record.snapshot.identity.feature_version, label_version: "temporal-labels-v1", segment_keys: record.segment_keys, evaluated_at: now })) : [];
  const limitations: string[] = []; if (!enough) limitations.push("Insufficient complete, temporally valid training data."); if (valid.length !== records.length) limitations.push("Some records were excluded by identity, ordering, or label-completeness checks.");
  return { status: enough ? "EVALUATED" : "WAITING_FOR_TRAINING_DATA", dataset: enough ? dataset : null, evaluations, aggregate: aggregate(evaluations), split_counts: { training: sets.training.length, validation: sets.validation.length, test: sets.test.length }, learning: { mode: "batch_then_shadow", model_created: false, promotion: enough ? "shadow_only" : "blocked" }, limitations };
}

export type EvaluationWorkerResult = { status: "ok" | "partial" | "failed"; attempted: number; labeled: number; evaluated: number; failed: number; checkpoint: string | null; learning: "shadow_only" };

export async function runEvaluationWorkerCycle(): Promise<EvaluationWorkerResult> {
  const db = getDbClient();
  const storage = createPredictionStorage();
  let labeled = 0;
  let failed = 0;
  const unlabeled = await db.predictionSnapshotRecord.findMany({
    where: { labelRevisions: { none: {} } }, orderBy: [{ asOf: "asc" }, { snapshotId: "asc" }], take: 100,
    select: { snapshotId: true, fixtureId: true, snapshotPayload: true }
  });
  for (const row of unlabeled) {
    try {
      const [fixture, state, events] = await Promise.all([
        db.fixture.findUnique({ where: { fixtureId: row.fixtureId }, select: { status: true, startTimeUtc: true, updatedAt: true } }),
        db.matchState.findUnique({ where: { fixtureId: row.fixtureId }, select: { homeScore: true, awayScore: true, phase: true, lastDataReceivedAt: true } }),
        db.matchEvent.findMany({ where: { fixtureId: row.fixtureId }, orderBy: [{ sourceTimestamp: "asc" }, { id: "asc" }], select: { id: true, eventType: true, teamSide: true, sourceTimestamp: true, createdAt: true } })
      ]);
      if (!fixture || !state) continue;
      const lifecycle = resolveMatchLifecycle({ providerStatus: fixture.status, persistedPhase: state.phase, startTimeUtc: fixture.startTimeUtc });
      if (!lifecycle.is_terminal || state.homeScore === null || state.awayScore === null) continue;
      const finalizedAt = (state.lastDataReceivedAt ?? fixture.updatedAt).toISOString();
      const labels = buildTemporalLabels({
        snapshot: row.snapshotPayload as unknown as FinalPredictionSnapshot,
        finalized_at: finalizedAt,
        final_home_score: state.homeScore,
        final_away_score: state.awayScore,
        labeled_at: new Date().toISOString(),
        timeline: events.map((event, index) => ({ event_id: event.id, stream_kind: "scores" as const, fixture_id: row.fixtureId, sequence: index + 1, provider_timestamp: (event.sourceTimestamp ?? event.createdAt).toISOString(), event_type: event.eventType, payload: { team_side: event.teamSide } }))
      });
      await storage.savePredictionLabelRevision({ labelVersion: "temporal-labels-v1", revision: 1, labels });
      labeled += 1;
    } catch { failed += 1; }
  }
  const rows = await db.predictionLabelRevisionRecord.findMany({
    where: { status: "complete", predictionSnapshot: { evaluations: { none: {} } } },
    orderBy: [{ labeledAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { id: true, labelVersion: true, labelPayload: true, predictionSnapshot: { select: { snapshotPayload: true, inferenceEngineVersion: true } } }
  });
  let evaluated = 0;
  let checkpoint: string | null = null;
  for (const row of rows) {
    checkpoint = row.id;
    try {
      const report = evaluatePrediction({
        snapshot: row.predictionSnapshot.snapshotPayload as unknown as FinalPredictionSnapshot,
        label: row.labelPayload as unknown as PredictionSnapshotLabels,
        model_version: row.predictionSnapshot.inferenceEngineVersion,
        label_version: row.labelVersion,
        evaluated_at: new Date().toISOString()
      });
      await storage.savePredictionEvaluationRecord(report.record);
      evaluated += 1;
    } catch { failed += 1; }
  }
  return { status: failed === 0 ? "ok" : evaluated > 0 || labeled > 0 ? "partial" : "failed", attempted: unlabeled.length + rows.length, labeled, evaluated, failed, checkpoint, learning: "shadow_only" };
}

export async function runManagedEvaluationWorkerCycle(): Promise<EvaluationWorkerResult> {
  const startedAt = new Date();
  await updateManagedWorkerHealth(WORKER_SERVICES.evaluation, { status: "running", errorCount: 0, cycle: { checkpoint: null, started_at: startedAt.toISOString(), learning: "shadow_only" } });
  try {
    const result = await runEvaluationWorkerCycle();
    await updateManagedWorkerHealth(WORKER_SERVICES.evaluation, { status: result.status === "ok" ? "healthy" : result.status, errorCount: result.failed, cycle: { ...result, started_at: startedAt.toISOString(), finished_at: new Date().toISOString() } });
    return result;
  } catch (error) {
    await updateManagedWorkerHealth(WORKER_SERVICES.evaluation, { status: "failed", error, errorCount: 1, stage: "evaluation", cycle: { checkpoint: null, started_at: startedAt.toISOString(), finished_at: new Date().toISOString(), learning: "shadow_only" } });
    throw error;
  }
}
