import { createPredictionStorage, type PredictionStorageDatabase } from "./prediction-storage.js";
import type { PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";
import type { PredictionOrchestrationRequest } from "./prediction-runtime-orchestrator.js";
import type { PredictionAdapterResult } from "./prediction-model-adapter.js";

export type RuntimeFeatureBundle = Record<string, unknown>;
export type PredictionRuntimeStorage = {
  savePredictionFeatureSnapshot(input: unknown): Promise<unknown>;
  saveFinalPredictionSnapshot(input: unknown): Promise<unknown>;
};

export function buildRuntimeFeatureSnapshotId(input: PredictionEngineFeatureSnapshot): string { return `feature-snapshot-v1:${input.fixture_id}:${input.feature_hash}`; }

export function createPredictionRuntimePersistence(database?: PredictionStorageDatabase, storageOverride?: PredictionRuntimeStorage) {
  const storage: PredictionRuntimeStorage = storageOverride ?? createPredictionStorage(database === undefined ? {} : { db: database });
  return async (input: PredictionOrchestrationRequest, result: PredictionAdapterResult, featureBundle: RuntimeFeatureBundle): Promise<void> => {
    const featureSnapshotId = buildRuntimeFeatureSnapshotId(input.features);
    await storage.savePredictionFeatureSnapshot({ snapshot_id: featureSnapshotId, fixture_id: input.fixture_id, as_of: input.features.as_of, sequence: input.sequence ?? null, trigger: input.trigger, feature_bundle: featureBundle });
    await storage.saveFinalPredictionSnapshot({ snapshot: result.snapshot, feature_snapshot_id: featureSnapshotId, inference_engine_version: "scenario-engine-v1", ensemble_version: "scenario-engine-v1", fallback_used: result.status !== "private_model_applied" });
  };
}
