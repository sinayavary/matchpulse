import { getDbClient } from "./db.js";
import {
  PredictionStorageConflictError,
  PredictionStorageInvariantError,
  PredictionStorageReferenceError,
  type PredictionStorageDatabase,
} from "./prediction-storage.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

type AnyRecord = Record<string, any>;
type ListOptions = { limit?: number; before?: string };
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const FORBIDDEN = new Set(["model_bytes", "model_binary", "weights", "coefficients", "model_weights", "model_coefficients", "secret", "api_key", "token"]);

export type RegistryStorageDependencies = { db?: PredictionStorageDatabase };

function dbOf(dependencies: RegistryStorageDependencies): PredictionStorageDatabase { return (dependencies.db ?? getDbClient()) as unknown as PredictionStorageDatabase; }
function text(value: unknown, name: string): string { if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be non-empty.`); return value; }
function date(value: unknown, name: string): Date { const d = value instanceof Date ? new Date(value.getTime()) : new Date(String(value)); if (!Number.isFinite(d.getTime())) throw new TypeError(`${name} must be a valid timestamp.`); return d; }
function clone<T>(value: T): T { return structuredClone(value); }
function invariant(message: string, cause?: unknown): never { throw new PredictionStorageInvariantError(message, cause ? { cause } : undefined); }
function conflict(identity: string): never { throw new PredictionStorageConflictError(`Immutable registry conflict for ${identity}.`); }
function missing(identity: string): never { throw new PredictionStorageReferenceError(`Required registry reference does not exist: ${identity}.`); }
async function findOne(delegate: any, where: AnyRecord): Promise<any | null> { if (delegate.findUnique) { const row = await delegate.findUnique({ where }); if (row) return row; } return delegate.findFirst ? delegate.findFirst({ where }) : null; }
function scanMetadata(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) { if (FORBIDDEN.has(key.toLowerCase())) invariant(`Registry metadata contains forbidden field: ${key}.`); scanMetadata(child, seen); }
}
function listArgs(options: ListOptions = {}): AnyRecord { const limit = options.limit ?? DEFAULT_LIMIT; if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new RangeError(`limit must be between 1 and ${MAX_LIMIT}.`); const args: AnyRecord = { take: limit, orderBy: [{ createdAt: "desc" }, { featureVersion: "desc" }] }; if (options.before !== undefined) args.where = { createdAt: { lt: date(options.before, "before") } }; return args; }
function readDate(value: unknown): string | null { return value === null || value === undefined ? null : date(value, "registry timestamp").toISOString(); }
function featureRecord(row: AnyRecord) { return { featureVersion: row.featureVersion, schemaHash: row.schemaHash, featureCount: row.featureCount, status: row.status, schemaPayload: clone(row.schemaPayload), description: row.description ?? null, activatedAt: readDate(row.activatedAt), retiredAt: readDate(row.retiredAt) }; }
function labelRecord(row: AnyRecord) { return { labelVersion: row.labelVersion, schemaHash: row.schemaHash, predictionContractVersion: row.predictionContractVersion, status: row.status, targetIds: clone(row.targetIds), schemaPayload: clone(row.schemaPayload), description: row.description ?? null, activatedAt: readDate(row.activatedAt), retiredAt: readDate(row.retiredAt) }; }
function datasetRecord(row: AnyRecord) { return { datasetVersion: row.datasetVersion, featureVersion: row.featureVersion, labelVersion: row.labelVersion, status: row.status, manifestUri: row.manifestUri, manifestHash: row.manifestHash, splitStrategy: row.splitStrategy, trainingStart: readDate(row.trainingStart), trainingEnd: readDate(row.trainingEnd), validationStart: readDate(row.validationStart), validationEnd: readDate(row.validationEnd), testStart: readDate(row.testStart), testEnd: readDate(row.testEnd), rowCount: row.rowCount, fixtureCount: row.fixtureCount, trainRowCount: row.trainRowCount, validationRowCount: row.validationRowCount, testRowCount: row.testRowCount, metadataPayload: clone(row.metadataPayload), sealedAt: readDate(row.sealedAt) }; }
function modelRecord(row: AnyRecord) { return { modelVersion: row.modelVersion, modelRole: row.modelRole, target: row.target ?? null, status: row.status, featureVersion: row.featureVersion, labelVersion: row.labelVersion, datasetVersion: row.datasetVersion, calibrationVersion: row.calibrationVersion ?? null, artifactUri: row.artifactUri ?? null, artifactHash: row.artifactHash ?? null, configurationHash: row.configurationHash, metricsPayload: clone(row.metricsPayload), metadataPayload: clone(row.metadataPayload), trainedAt: readDate(row.trainedAt), validatedAt: readDate(row.validatedAt), promotedAt: readDate(row.promotedAt), retiredAt: readDate(row.retiredAt) }; }
function datasetHash(value: AnyRecord): string { return computeStorageContentHash({ ...value, trainingStart: value.trainingStart ? date(value.trainingStart, "training_start").toISOString() : null, trainingEnd: value.trainingEnd ? date(value.trainingEnd, "training_end").toISOString() : null, validationStart: value.validationStart ? date(value.validationStart, "validation_start").toISOString() : null, validationEnd: value.validationEnd ? date(value.validationEnd, "validation_end").toISOString() : null, testStart: value.testStart ? date(value.testStart, "test_start").toISOString() : null, testEnd: value.testEnd ? date(value.testEnd, "test_end").toISOString() : null, sealedAt: value.sealedAt ? date(value.sealedAt, "sealed_at").toISOString() : null }); }

export type FeatureSchemaRegistration = { featureVersion: string; schemaHash: string; featureCount: number; status: "draft" | "active" | "retired"; schemaPayload: unknown; description?: string | null; activatedAt?: string | Date | null; retiredAt?: string | Date | null };
export type LabelSchemaRegistration = { labelVersion: string; schemaHash: string; predictionContractVersion: string; status: "draft" | "active" | "retired"; targetIds: string[]; schemaPayload: unknown; description?: string | null; activatedAt?: string | Date | null; retiredAt?: string | Date | null };
export type TrainingDatasetRegistration = { datasetVersion: string; featureVersion: string; labelVersion: string; status: "building" | "sealed" | "deprecated"; manifestUri: string; manifestHash: string; splitStrategy: string; trainingStart?: string | Date | null; trainingEnd?: string | Date | null; validationStart?: string | Date | null; validationEnd?: string | Date | null; testStart?: string | Date | null; testEnd?: string | Date | null; rowCount: number; fixtureCount: number; trainRowCount: number; validationRowCount: number; testRowCount: number; metadataPayload: unknown; sealedAt?: string | Date | null };
export type ModelRegistryRegistration = { modelVersion: string; modelRole: string; target?: string | null; status: "candidate" | "validated" | "shadow" | "champion" | "retired"; featureVersion: string; labelVersion: string; datasetVersion: string; calibrationVersion?: string | null; artifactUri?: string | null; artifactHash?: string | null; configurationHash: string; metricsPayload: unknown; metadataPayload: unknown; trainedAt?: string | Date | null; validatedAt?: string | Date | null; promotedAt?: string | Date | null; retiredAt?: string | Date | null };

function requiredCount(value: unknown, name: string): number { if (!Number.isInteger(value) || (value as number) < 0) throw new TypeError(`${name} must be a non-negative integer.`); return value as number; }
function nullableDate(value: unknown, name: string): Date | null { return value === null || value === undefined ? null : date(value, name); }

export function createPredictionRegistryStorage(dependencies: RegistryStorageDependencies = {}) {
  const db = () => dbOf(dependencies);
  const registerFeatureSchema = async (input: FeatureSchemaRegistration) => {
    const featureVersion = text(input.featureVersion, "feature_version"); const schemaHash = text(input.schemaHash, "schema_hash"); scanMetadata(input.schemaPayload);
    const row = { featureVersion, schemaHash, featureCount: requiredCount(input.featureCount, "feature_count"), status: input.status, schemaPayload: clone(input.schemaPayload), description: input.description ?? null, activatedAt: nullableDate(input.activatedAt, "activated_at"), retiredAt: nullableDate(input.retiredAt, "retired_at") };
    const existing = await findOne(db().featureSchemaRegistry as any, { featureVersion }); if (existing) return existing.schemaHash === schemaHash ? featureRecord(existing) : conflict(featureVersion);
    try { await (db() as any).featureSchemaRegistry.create({ data: row }); } catch { const retry = await findOne((db() as any).featureSchemaRegistry, { featureVersion }); if (retry?.schemaHash === schemaHash) return featureRecord(retry); conflict(featureVersion); }
    return featureRecord(row);
  };
  const getFeatureSchemaVersion = async (featureVersion: string) => { const row = await findOne((db() as any).featureSchemaRegistry, { featureVersion: text(featureVersion, "feature_version") }); return row ? featureRecord(row) : null; };

  const registerLabelSchema = async (input: LabelSchemaRegistration) => {
    const labelVersion = text(input.labelVersion, "label_version"); const schemaHash = text(input.schemaHash, "schema_hash"); const targetIds = clone(input.targetIds) as string[]; if (!Array.isArray(targetIds) || !targetIds.every((x) => typeof x === "string" && x.trim() !== "")) throw new TypeError("target_ids must contain non-empty strings."); scanMetadata(input.schemaPayload);
    const row = { labelVersion, schemaHash, predictionContractVersion: text(input.predictionContractVersion, "prediction_contract_version"), status: input.status, targetIds, schemaPayload: clone(input.schemaPayload), description: input.description ?? null, activatedAt: nullableDate(input.activatedAt, "activated_at"), retiredAt: nullableDate(input.retiredAt, "retired_at") };
    const existing = await findOne((db() as any).labelSchemaRegistry, { labelVersion }); if (existing) return existing.schemaHash === schemaHash ? labelRecord(existing) : conflict(labelVersion);
    try { await (db() as any).labelSchemaRegistry.create({ data: row }); } catch { const retry = await findOne((db() as any).labelSchemaRegistry, { labelVersion }); if (retry?.schemaHash === schemaHash) return labelRecord(retry); conflict(labelVersion); }
    return labelRecord(row);
  };
  const getLabelSchemaVersion = async (labelVersion: string) => { const row = await findOne((db() as any).labelSchemaRegistry, { labelVersion: text(labelVersion, "label_version") }); return row ? labelRecord(row) : null; };

  const registerTrainingDataset = async (input: TrainingDatasetRegistration) => {
    const datasetVersion = text(input.datasetVersion, "dataset_version"); const feature = await findOne((db() as any).featureSchemaRegistry, { featureVersion: text(input.featureVersion, "feature_version") }); if (!feature) missing(input.featureVersion); const label = await findOne((db() as any).labelSchemaRegistry, { labelVersion: text(input.labelVersion, "label_version") }); if (!label) missing(input.labelVersion);
    scanMetadata(input.metadataPayload); const counts = ["rowCount", "fixtureCount", "trainRowCount", "validationRowCount", "testRowCount"] as const; for (const key of counts) requiredCount(input[key], key);
    if (input.status === "sealed" && input.sealedAt === undefined) invariant("Sealed datasets require sealed_at.");
    const row = { datasetVersion, featureVersion: input.featureVersion, labelVersion: input.labelVersion, status: input.status, manifestUri: text(input.manifestUri, "manifest_uri"), manifestHash: text(input.manifestHash, "manifest_hash"), splitStrategy: text(input.splitStrategy, "split_strategy"), trainingStart: nullableDate(input.trainingStart, "training_start"), trainingEnd: nullableDate(input.trainingEnd, "training_end"), validationStart: nullableDate(input.validationStart, "validation_start"), validationEnd: nullableDate(input.validationEnd, "validation_end"), testStart: nullableDate(input.testStart, "test_start"), testEnd: nullableDate(input.testEnd, "test_end"), rowCount: input.rowCount, fixtureCount: input.fixtureCount, trainRowCount: input.trainRowCount, validationRowCount: input.validationRowCount, testRowCount: input.testRowCount, metadataPayload: clone(input.metadataPayload), sealedAt: nullableDate(input.sealedAt, "sealed_at") };
    const existing = await findOne((db() as any).trainingDatasetRegistry, { datasetVersion }); if (existing) return datasetHash(datasetRecord(existing)) === datasetHash(input as AnyRecord) ? datasetRecord(existing) : conflict(datasetVersion);
    try { await (db() as any).trainingDatasetRegistry.create({ data: row }); } catch { const retry = await findOne((db() as any).trainingDatasetRegistry, { datasetVersion }); if (retry && retry.manifestHash === input.manifestHash) return datasetRecord(retry); conflict(datasetVersion); }
    return datasetRecord(row);
  };
  const getTrainingDatasetVersion = async (datasetVersion: string) => { const row = await findOne((db() as any).trainingDatasetRegistry, { datasetVersion: text(datasetVersion, "dataset_version") }); return row ? datasetRecord(row) : null; };

  const registerModelEntry = async (input: ModelRegistryRegistration) => {
    try {
      const modelVersion = text(input.modelVersion, "model_version");
      const dataset = await findOne((db() as any).trainingDatasetRegistry, { datasetVersion: text(input.datasetVersion, "dataset_version") });
      if (!dataset) missing(input.datasetVersion);
      const feature = await findOne((db() as any).featureSchemaRegistry, { featureVersion: input.featureVersion });
      if (!feature) missing(input.featureVersion);
      const label = await findOne((db() as any).labelSchemaRegistry, { labelVersion: input.labelVersion });
      if (!label) missing(input.labelVersion);

      if (dataset.featureVersion !== input.featureVersion) invariant("Model feature version does not match its dataset."); if (dataset.labelVersion !== input.labelVersion) invariant("Model label version does not match its dataset.");
      scanMetadata(input.metricsPayload); scanMetadata(input.metadataPayload); const row = { modelVersion, modelRole: text(input.modelRole, "model_role"), target: input.target ?? null, status: input.status, featureVersion: text(input.featureVersion, "feature_version"), labelVersion: text(input.labelVersion, "label_version"), datasetVersion: input.datasetVersion, calibrationVersion: input.calibrationVersion ?? null, artifactUri: input.artifactUri ?? null, artifactHash: input.artifactHash ?? null, configurationHash: text(input.configurationHash, "configuration_hash"), metricsPayload: clone(input.metricsPayload), metadataPayload: clone(input.metadataPayload), trainedAt: nullableDate(input.trainedAt, "trained_at"), validatedAt: nullableDate(input.validatedAt, "validated_at"), promotedAt: nullableDate(input.promotedAt, "promoted_at"), retiredAt: nullableDate(input.retiredAt, "retired_at") };
      const existing = await findOne((db() as any).modelRegistryEntry, { modelVersion }); if (existing) return existing.configurationHash === input.configurationHash ? modelRecord(existing) : conflict(modelVersion);
      try { await (db() as any).modelRegistryEntry.create({ data: row }); } catch { const retry = await findOne((db() as any).modelRegistryEntry, { modelVersion }); if (retry?.configurationHash === input.configurationHash) return modelRecord(retry); conflict(modelVersion); }
      return modelRecord(row);
    } catch (e) {
      if (e instanceof PredictionStorageInvariantError || e instanceof PredictionStorageConflictError || e instanceof PredictionStorageReferenceError) throw e;
      throw new PredictionStorageInvariantError(e instanceof Error ? e.message : "Invalid model registry input", { cause: e });
    }
  };
  const getModelRegistryEntry = async (modelVersion: string) => { const row = await findOne((db() as any).modelRegistryEntry, { modelVersion: text(modelVersion, "model_version") }); return row ? modelRecord(row) : null; };
  return { registerFeatureSchema, getFeatureSchemaVersion, registerLabelSchema, getLabelSchemaVersion, registerTrainingDataset, getTrainingDatasetVersion, registerModelEntry, getModelRegistryEntry };
}

export function registerFeatureSchema(input: FeatureSchemaRegistration, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).registerFeatureSchema(input); }
export function getFeatureSchemaVersion(featureVersion: string, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).getFeatureSchemaVersion(featureVersion); }
export function registerLabelSchema(input: LabelSchemaRegistration, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).registerLabelSchema(input); }
export function getLabelSchemaVersion(labelVersion: string, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).getLabelSchemaVersion(labelVersion); }
export function registerTrainingDataset(input: TrainingDatasetRegistration, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).registerTrainingDataset(input); }
export function getTrainingDatasetVersion(datasetVersion: string, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).getTrainingDatasetVersion(datasetVersion); }
export function registerModelEntry(input: ModelRegistryRegistration, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).registerModelEntry(input); }
export function getModelRegistryEntry(modelVersion: string, dependencies?: RegistryStorageDependencies) { return createPredictionRegistryStorage(dependencies).getModelRegistryEntry(modelVersion); }
