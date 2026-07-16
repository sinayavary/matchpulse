import { createPredictionStorage, type PredictionStorageDatabase } from "./prediction-storage.js";
import type { PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";
import type { PredictionOrchestrationRequest } from "./prediction-runtime-orchestrator.js";
import type { PredictionAdapterResult } from "./prediction-model-adapter.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

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
    const featureVersion = typeof featureBundle.feature_version === "string" ? featureBundle.feature_version : "prediction-features-v1";
    const featureHash = computeStorageContentHash(featureBundle);
    const featureCount = featureBundle.features !== null && typeof featureBundle.features === "object" ? Object.keys(featureBundle.features as Record<string, unknown>).length : 0;
    const snapshot = structuredClone(result.snapshot);
    snapshot.identity.feature_version = featureVersion;
    snapshot.feature_reference = { ...snapshot.feature_reference, feature_version: featureVersion, feature_hash: featureHash, feature_count: featureCount };
    await storage.savePredictionFeatureSnapshot({ snapshot_id: featureSnapshotId, fixture_id: input.fixture_id, as_of: input.features.as_of, sequence: input.sequence ?? null, trigger: input.trigger, feature_bundle: featureBundle });
    await storage.saveFinalPredictionSnapshot({ snapshot, feature_snapshot_id: featureSnapshotId, inference_engine_version: "scenario-engine-v1", ensemble_version: "scenario-engine-v1", fallback_used: result.status !== "private_model_applied" });
  };
}
