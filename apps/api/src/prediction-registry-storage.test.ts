import assert from "node:assert/strict";
import test from "node:test";
import { createPredictionRegistryStorage } from "./prediction-registry-storage.js";
import { PredictionStorageConflictError, PredictionStorageInvariantError, PredictionStorageReferenceError, type PredictionStorageDatabase } from "./prediction-storage.js";

type FakeDbArgs = { where?: any; orderBy?: any; take?: number; data?: any };

class FakeDelegate {
    rows: any[] = [];
    async create({ data }: FakeDbArgs) { this.rows.push(structuredClone(data)); return data; }
    async findUnique({ where }: FakeDbArgs) { return this.rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null; }
    async findFirst({ where }: FakeDbArgs = {}) { return this.rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null; }
    async findMany({ }: FakeDbArgs = {}) { return this.rows; }
}

type FakePredictionStorageDatabase = {
    predictionFeatureSnapshot: FakeDelegate;
    oddsIntelligenceAssessmentRecord: FakeDelegate;
    oddsIntelligenceMarketRecord: FakeDelegate;
    oddsIntelligenceSelectionRecord: FakeDelegate;
    predictionSnapshotRecord: FakeDelegate;
    predictionSpecialistContributionRecord: FakeDelegate;
    predictionLabelRevisionRecord: FakeDelegate;
    predictionEvaluationRecord: FakeDelegate;
    featureSchemaRegistry: FakeDelegate;
    labelSchemaRegistry: FakeDelegate;
    trainingDatasetRegistry: FakeDelegate;
    modelRegistryEntry: FakeDelegate;
    $transaction<T>(fn: (transaction: PredictionStorageDatabase) => Promise<T>): Promise<T>;
};

function database(): FakePredictionStorageDatabase {
    return {
        predictionFeatureSnapshot: new FakeDelegate(),
        oddsIntelligenceAssessmentRecord: new FakeDelegate(),
        oddsIntelligenceMarketRecord: new FakeDelegate(),
        oddsIntelligenceSelectionRecord: new FakeDelegate(),
        predictionSnapshotRecord: new FakeDelegate(),
        predictionSpecialistContributionRecord: new FakeDelegate(),
        predictionLabelRevisionRecord: new FakeDelegate(),
        predictionEvaluationRecord: new FakeDelegate(),
        featureSchemaRegistry: new FakeDelegate(),
        labelSchemaRegistry: new FakeDelegate(),
        trainingDatasetRegistry: new FakeDelegate(),
        modelRegistryEntry: new FakeDelegate(),
        $transaction: async (fn: any) => await fn()
    };
}
const feature = { featureVersion: "prediction-features-v1", schemaHash: "fh1", featureCount: 12, status: "active" as const, schemaPayload: { fields: ["phase"] } };
const label = { labelVersion: "labels-v1", schemaHash: "lh1", predictionContractVersion: "prediction-domain-v1", status: "active" as const, targetIds: ["final_outcome_1x2"], schemaPayload: { targets: ["final_outcome_1x2"] } };
const dataset = { datasetVersion: "dataset-v1", featureVersion: feature.featureVersion, labelVersion: label.labelVersion, status: "sealed" as const, manifestUri: "s3://private/manifest.json", manifestHash: "mh1", splitStrategy: "time", rowCount: 10, fixtureCount: 2, trainRowCount: 6, validationRowCount: 2, testRowCount: 2, metadataPayload: { format: "parquet" }, sealedAt: "2026-07-10T12:00:00.000Z" };
const model = { modelVersion: "model-v1", modelRole: "live_state", status: "candidate" as const, featureVersion: feature.featureVersion, labelVersion: label.labelVersion, datasetVersion: dataset.datasetVersion, configurationHash: "config1", metricsPayload: { accuracy: 0.7 }, metadataPayload: { framework: "external" }, artifactUri: "s3://private/model" };

// --- Part K: Registry Tests ---
test("registry-97: Feature schema registration succeeds", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.ok(await registry.registerFeatureSchema(feature)); });
test("registry-98: Identical feature schema registration is idempotent", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); assert.ok(await registry.registerFeatureSchema(feature)); });
test("registry-99: Same feature version with different schema conflicts", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await assert.rejects(() => registry.registerFeatureSchema({ ...feature, schemaHash: "other" }), PredictionStorageConflictError); });
test("registry-100: Label schema registration succeeds", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.ok(await registry.registerLabelSchema(label)); });
test("registry-101: Identical label registration is idempotent", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerLabelSchema(label); assert.ok(await registry.registerLabelSchema(label)); });
test("registry-102: Same label version with changed schema conflicts", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerLabelSchema(label); await assert.rejects(() => registry.registerLabelSchema({ ...label, schemaHash: "other" }), PredictionStorageConflictError); });
test("registry-103: Dataset requires feature schema", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerLabelSchema(label); await assert.rejects(() => registry.registerTrainingDataset(dataset), PredictionStorageReferenceError); });
test("registry-104: Dataset requires label schema", async () => { const registry = createPredictionRegistryStorage({ db: database() as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await assert.rejects(() => registry.registerTrainingDataset(dataset), PredictionStorageReferenceError); });
test("registry-105: Dataset version is immutable", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await assert.rejects(() => registry.registerTrainingDataset({ ...dataset, splitStrategy: "other" }), PredictionStorageConflictError); });
test("registry-106: Dataset count fields are validated", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await assert.rejects(() => registry.registerTrainingDataset({ ...dataset, rowCount: -1 }), TypeError); });
test("registry-107: Dataset split dates are validated", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await assert.rejects(() => registry.registerTrainingDataset({ ...dataset, trainingStart: "invalid" }), TypeError); });
test("registry-108: Model requires feature schema (via dataset check)", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); db.featureSchemaRegistry.rows.length = 0; await assert.rejects(() => registry.registerModelEntry(model), PredictionStorageReferenceError); });
test("registry-113: Same model version with same metadata is idempotent", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await registry.registerModelEntry(model); assert.ok(await registry.registerModelEntry(model)); });
test("registry-114: Same model version with changed metadata conflicts", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await registry.registerModelEntry(model); await assert.rejects(() => registry.registerModelEntry({ ...model, configurationHash: "other" }), PredictionStorageConflictError); });
test("registry-115: Artifact metadata rejects embedded weights", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await assert.rejects(() => registry.registerModelEntry({ ...model, metadataPayload: { weights: [1, 2] } }), PredictionStorageInvariantError); });
test("registry-116: Artifact metadata rejects binary payloads", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await assert.rejects(() => registry.registerModelEntry({ ...model, metadataPayload: { model_binary: "010101" } }), PredictionStorageInvariantError); });
test("registry-117: Registry reads return validated domain-shaped values", async () => { const db = database(); const registry = createPredictionRegistryStorage({ db: db as unknown as PredictionStorageDatabase }); await registry.registerFeatureSchema(feature); await registry.registerLabelSchema(label); await registry.registerTrainingDataset(dataset); await registry.registerModelEntry(model); assert.ok(await registry.getModelRegistryEntry(model.modelVersion)); });
