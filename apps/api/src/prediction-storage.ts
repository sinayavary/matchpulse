import { getDbClient } from "./db.js";
import {
  assertPredictionFeatureBundleValid,
  type PredictionFeatureBundleV1,
} from "./prediction-feature-builder.js";
import {
  assertFinalPredictionSnapshotValid,
  assertPredictionEvaluationRecordValid,
  assertPredictionSnapshotLabelsValid,
  buildFinalPredictionSnapshot,
  buildPredictionEvaluationRecord,
  buildPredictionSnapshotLabels,
  type FinalPredictionSnapshot,
  type PredictionEvaluationRecord,
  type PredictionSnapshotLabels,
} from "./final-prediction-domain.js";
import {
  assertInternalOddsIntelligenceValid,
  buildInternalOddsIntelligenceContext,
  type InternalOddsIntelligenceContext,
  type OddsMarketIntelligence,
} from "./odds-intelligence-contract.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export class PredictionStorageConflictError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PredictionStorageConflictError";
  }
}

export class PredictionStorageReferenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PredictionStorageReferenceError";
  }
}

export class PredictionStorageInvariantError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PredictionStorageInvariantError";
  }
}

type Delegate = {
  create(args: any): Promise<any>;
  findUnique?(args: any): Promise<any>;
  findFirst?(args: any): Promise<any>;
  findMany(args: any): Promise<any[]>;
};

export type PredictionStorageDatabase = {
  predictionFeatureSnapshot: Delegate;
  oddsIntelligenceAssessmentRecord: Delegate;
  oddsIntelligenceMarketRecord: Delegate;
  oddsIntelligenceSelectionRecord: Delegate;
  predictionSnapshotRecord: Delegate;
  predictionSpecialistContributionRecord: Delegate;
  predictionLabelRevisionRecord: Delegate;
  predictionEvaluationRecord: Delegate;
  featureSchemaRegistry?: Delegate;
  labelSchemaRegistry?: Delegate;
  trainingDatasetRegistry?: Delegate;
  modelRegistryEntry?: Delegate;
  $transaction?<T>(fn: (transaction: PredictionStorageDatabase) => Promise<T>): Promise<T>;
};

export type PredictionStorageDependencies = {
  db?: PredictionStorageDatabase;
  now?: () => Date;
};

type AnyRecord = Record<string, unknown>;
type ListOptions = { limit?: number; before?: string };
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const TOLERANCE = 1e-6;

function dbOf(dependencies: PredictionStorageDependencies): PredictionStorageDatabase {
  return (dependencies.db ?? getDbClient()) as unknown as PredictionStorageDatabase;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be non-empty.`);
  return value;
}

function date(value: unknown, name: string): Date {
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new TypeError(`${name} must be a valid timestamp.`);
  return result;
}

function iso(value: Date): string { return value.toISOString(); }

function optionalNumber(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} must be finite or null.`);
  return value;
}

function positiveCount(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new TypeError(`${name} must be a non-negative integer.`);
  return value as number;
}

function listArgs(options: ListOptions = {}, orderField = "createdAt", idField = "id"): AnyRecord {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new RangeError(`limit must be between 1 and ${MAX_LIMIT}.`);
  const args: AnyRecord = { take: limit, orderBy: [{ [orderField]: "desc" }, { [idField]: "desc" }] };
  if (options.before !== undefined) args.where = { createdAt: { lt: date(options.before, "before") } };
  return args;
}

function listWhere(options: ListOptions, fixtureId: string, idField = "id"): AnyRecord {
  const args = listArgs(options, "createdAt", idField);
  args.where = { ...(args.where ?? {}), fixtureId };
  return args;
}

function asObject(value: unknown, name: string): AnyRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new PredictionStorageInvariantError(`${name} is not a persisted object.`);
  return value as AnyRecord;
}

function clone<T>(value: T): T { return structuredClone(value); }

async function findOne(delegate: Delegate, where: AnyRecord): Promise<any | null> {
  if (delegate.findUnique) {
    const row = await delegate.findUnique({ where });
    if (row) return row;
  }
  return delegate.findFirst ? delegate.findFirst({ where }) : null;
}

async function transaction<T>(db: PredictionStorageDatabase, fn: (tx: PredictionStorageDatabase) => Promise<T>): Promise<T> {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function conflict(identity: string): never { throw new PredictionStorageConflictError(`Immutable storage record conflict for ${identity}.`); }
function missing(reference: string): never { throw new PredictionStorageReferenceError(`Required storage reference does not exist: ${reference}.`); }
function invariant(message: string, cause?: unknown): never { throw new PredictionStorageInvariantError(message, cause ? { cause } : undefined); }

function featureInput(input: AnyRecord): { snapshotId: string; asOf: Date; sequence: number | null; trigger: string; bundle: PredictionFeatureBundleV1 } {
  try {
    const bundle = (input.featureBundle ?? input.feature_bundle ?? input.bundle ?? input.feature ?? input.payload) as PredictionFeatureBundleV1;
    assertPredictionFeatureBundleValid(bundle);
    const snapshotId = text(input.snapshotId ?? input.snapshot_id, "snapshot_id");
    const fixtureId = text(input.fixtureId ?? input.fixture_id, "fixture_id");
    if (bundle.fixture_id !== fixtureId) invariant("Feature bundle fixture ID does not match the snapshot.");
    const sequence = input.sequence === null || input.sequence === undefined ? null : positiveCount(input.sequence, "sequence");
    const trigger = text(input.trigger, "trigger");
    return { snapshotId, asOf: date(input.asOf ?? input.as_of, "as_of"), sequence, trigger, bundle };
  } catch (e) {
    if (e instanceof PredictionStorageInvariantError) throw e;
    throw new PredictionStorageInvariantError(e instanceof Error ? e.message : "Invalid feature input", { cause: e });
  }
}

function featureRow(input: ReturnType<typeof featureInput>, contentHash: string): AnyRecord {
  const { bundle } = input;
  const summary = asObject(bundle.input_summary, "feature input summary");
  const features = asObject(bundle.features, "features");
  return {
    snapshotId: input.snapshotId,
    fixtureId: bundle.fixture_id,
    asOf: input.asOf,
    generatedAt: date(bundle.generated_at, "generated_at"),
    sequence: input.sequence,
    trigger: input.trigger,
    featureVersion: bundle.feature_version,
    featureHash: computeStorageContentHash(bundle),
    featureCount: Object.keys(features).length,
    normalizedPhase: bundle.normalized_phase,
    minute: summary.minute === null || summary.minute === undefined ? null : positiveCount(summary.minute, "minute"),
    homeScore: summary.home_score === null || summary.home_score === undefined ? null : positiveCount(summary.home_score, "home_score"),
    awayScore: summary.away_score === null || summary.away_score === undefined ? null : positiveCount(summary.away_score, "away_score"),
    scoreDiff: optionalNumber(summary.score_diff, "score_diff"),
    coverageScore: optionalNumber(features.coverage_score, "coverage_score") ?? invariant("coverage_score is required"),
    featurePayload: clone(bundle),
    contentHash,
  };
}

function mapFeatureRow(row: AnyRecord): PredictionFeatureBundleV1 {
  const payload = asObject(row.featurePayload ?? row.feature_payload, "feature payload") as unknown as PredictionFeatureBundleV1;
  try { assertPredictionFeatureBundleValid(payload); } catch { invariant("Persisted feature payload failed validation."); }
  return clone(payload);
}

function assessmentInput(input: unknown): InternalOddsIntelligenceContext {
  try {
    const candidate = asObject(input, "odds assessment");
    const context = (candidate.assessment ?? candidate.context ?? candidate.payload ?? input) as InternalOddsIntelligenceContext;
    if (typeof context !== "object" || context === null) invariant("Assessment must be an object.");
    if (!Array.isArray((context as any).markets)) invariant("Assessment markets must be an array.");
    const built = buildInternalOddsIntelligenceContext(context);
    assertInternalOddsIntelligenceValid(built);
    return built;
  } catch (e) {
    if (e instanceof PredictionStorageInvariantError) throw e;
    throw new PredictionStorageInvariantError(e instanceof Error ? e.message : "Invalid odds assessment input", { cause: e });
  }
}

function selectionKey(selection: string, line: number | null): string {
  return `${selection}:${line === null ? "null" : String(line)}`;
}

function assessmentRows(context: InternalOddsIntelligenceContext, contentHash: string): { root: AnyRecord; markets: AnyRecord[]; selections: AnyRecord[] } {
  const markets = context.markets.map((market) => {
    const id = `${context.assessment_id}:${market.market_key}`;
    return { id, market };
  });
  return {
    root: {
      assessmentId: context.assessment_id, fixtureId: context.fixture_id,
      oddsIntelligenceVersion: context.odds_intelligence_version, generatedAt: date(context.generated_at, "generated_at"),
      status: context.status, usableForModel: context.usable_for_model,
      overallReliabilityScore: context.overall_reliability_score, recommendedMarketModelWeight: context.recommended_market_model_weight,
      marketCount: context.market_count, usableMarketCount: context.usable_market_count, providerCount: context.provider_count,
      snapshotCount: context.snapshot_count, consensusScore: context.consensus_score, freshnessScore: context.freshness_score,
      volatilityScore: context.volatility_score, anomalyScore: context.anomaly_score,
      primaryMarketKey: context.primary_match_result_market?.market_key ?? null,
      assessmentPayload: clone(context), contentHash,
    },
    markets: markets.map(({ id, market }) => ({
      id, assessmentId: context.assessment_id, marketKey: market.market_key, marketType: market.market_type, line: market.line,
      complete: market.complete, usable: market.usable, selectionCount: market.selection_count, providerCount: market.provider_count,
      snapshotCount: market.snapshot_count, overround: market.overround, providerDispersion: market.provider_dispersion,
      volatilityScore: market.volatility_score, reliabilityLevel: market.reliability_level, reliabilityScore: market.reliability_score,
      recommendedModelWeight: market.recommended_model_weight, componentScores: clone(market.component_scores), issues: clone(market.issues),
      limitations: clone(market.limitations), latestTimestamp: market.latest_timestamp === null ? null : date(market.latest_timestamp, "latest_timestamp"),
    })),
    selections: markets.flatMap(({ id, market }) => market.selections.map((selection) => ({
      id: `${id}:${selectionKey(selection.selection, selection.line)}`, marketRecordId: id,
      selectionKey: selectionKey(selection.selection, selection.line), selection: selection.selection, line: selection.line,
      fairProbability: selection.fair_probability, consensusProbability: selection.consensus_probability,
      probabilityChange1m: selection.probability_change_1m, probabilityChange5m: selection.probability_change_5m,
      movementVelocity: selection.movement_velocity, movementAcceleration: selection.movement_acceleration,
    }))),
  };
}

async function readAssessment(db: PredictionStorageDatabase, assessmentId: string): Promise<InternalOddsIntelligenceContext | null> {
  const root = await findOne(db.oddsIntelligenceAssessmentRecord, { assessmentId });
  if (!root) return null;
  const markets = await db.oddsIntelligenceMarketRecord.findMany({ where: { assessmentId }, orderBy: [{ marketKey: "asc" }, { id: "asc" }] });
  const selections = markets.length === 0 ? [] : await db.oddsIntelligenceSelectionRecord.findMany({ where: { marketRecordId: { in: markets.map((m) => m.id) } }, orderBy: [{ selectionKey: "asc" }, { id: "asc" }] });
  const payload = asObject(root.assessmentPayload ?? root.assessment_payload, "assessment payload") as unknown as InternalOddsIntelligenceContext;
  try { assertInternalOddsIntelligenceValid(payload); } catch { invariant("Persisted Odds Intelligence payload failed validation."); }
  const mapped = clone(payload);
  mapped.markets = markets.map((market) => {
    const stored = asObject(market.componentScores ?? market.component_scores, "market component scores");
    const marketSelections = selections.filter((selection) => selection.marketRecordId === market.id).map((selection) => ({
      selection: selection.selection, line: selection.line, fair_probability: selection.fairProbability,
      consensus_probability: selection.consensusProbability, probability_change_1m: selection.probabilityChange1m,
      probability_change_5m: selection.probabilityChange5m, movement_velocity: selection.movementVelocity,
      movement_acceleration: selection.movementAcceleration,
    }));
    return {
      market_key: market.marketKey, market_type: market.marketType, line: market.line, complete: market.complete, usable: market.usable,
      selection_count: market.selectionCount, provider_count: market.providerCount, snapshot_count: market.snapshotCount,
      overround: market.overround, provider_dispersion: market.providerDispersion, volatility_score: market.volatilityScore,
      selections: marketSelections, component_scores: stored, reliability_level: market.reliabilityLevel,
      reliability_score: market.reliabilityScore, recommended_model_weight: market.recommendedModelWeight,
      issues: market.issues, limitations: market.limitations,
      latest_timestamp: market.latestTimestamp instanceof Date ? iso(market.latestTimestamp) : market.latestTimestamp,
    } as OddsMarketIntelligence;
  });
  const primaryKey = root.primaryMarketKey ?? root.primary_market_key;
  mapped.primary_match_result_market = primaryKey === null || primaryKey === undefined ? null : mapped.markets.find((m) => m.market_key === primaryKey) ?? null;
  try { assertInternalOddsIntelligenceValid(mapped); } catch { invariant("Persisted Odds Intelligence payload failed validation."); }
  return mapped;
}

function snapshotInput(input: AnyRecord): { snapshot: FinalPredictionSnapshot; featureSnapshotId: string; inferenceEngineVersion: string; ensembleVersion: string; calibrationVersion: string | null; inferenceLatencyMs: number | null; fallbackUsed: boolean } {
  try {
    const snapshot = buildFinalPredictionSnapshot((input.snapshot ?? input.prediction ?? input.payload) as FinalPredictionSnapshot);
    return {
      snapshot, featureSnapshotId: text(input.featureSnapshotId ?? input.feature_snapshot_id, "feature_snapshot_id"),
      inferenceEngineVersion: text(input.inferenceEngineVersion ?? input.inference_engine_version, "inference_engine_version"),
      ensembleVersion: text(input.ensembleVersion ?? input.ensemble_version, "ensemble_version"),
      calibrationVersion: (input.calibrationVersion ?? input.calibration_version ?? null) as string | null,
      inferenceLatencyMs: (input.inferenceLatencyMs ?? input.inference_latency_ms ?? null) as number | null,
      fallbackUsed: (input.fallbackUsed ?? input.fallback_used ?? false) as boolean,
    };
  } catch (e) {
    if (e instanceof PredictionStorageInvariantError) throw e;
    throw new PredictionStorageInvariantError(e instanceof Error ? e.message : "Invalid final prediction snapshot input", { cause: e });
  }
}

function snapshotRow(input: ReturnType<typeof snapshotInput>, contentHash: string): AnyRecord {
  const p = input.snapshot;
  const i = p.identity; const c = p.match_context; const f = p.feature_reference; const o = p.odds_intelligence_reference;
  const m = p.model_output;
  return {
    snapshotId: i.snapshot_id, fixtureId: i.fixture_id, featureSnapshotId: input.featureSnapshotId, oddsAssessmentId: o.assessment_id,
    asOf: date(i.as_of, "as_of"), generatedAt: date(i.generated_at, "generated_at"), sequence: i.sequence, trigger: i.trigger,
    predictionContractVersion: i.prediction_contract_version, featureVersion: f.feature_version, featureHash: f.feature_hash, featureCount: f.feature_count,
    inferenceEngineVersion: input.inferenceEngineVersion, ensembleVersion: input.ensembleVersion, calibrationVersion: input.calibrationVersion,
    inferenceLatencyMs: input.inferenceLatencyMs, fallbackUsed: input.fallbackUsed, normalizedPhase: c.normalized_phase, minute: c.minute,
    homeScore: c.home_score, awayScore: c.away_score, scoreDiff: c.score_diff,
    finalOutcomeHome: m.final_outcome.home, finalOutcomeDraw: m.final_outcome.draw, finalOutcomeAway: m.final_outcome.away,
    nextGoalHome: m.next_goal.home, nextGoalNone: m.next_goal.none, nextGoalAway: m.next_goal.away,
    goalNext5m: m.goal_horizon.next_5m, goalNext10m: m.goal_horizon.next_10m, goalNext15m: m.goal_horizon.next_15m,
    currentResultHolds: m.current_result_survival.current_result_holds, currentResultChanges: m.current_result_survival.current_result_changes,
    momentumHomeStrengthens: m.momentum_shift.home_strengthens, momentumNeutral: m.momentum_shift.neutral, momentumAwayStrengthens: m.momentum_shift.away_strengthens,
    confidenceLevel: p.confidence.level, confidenceScore: p.confidence.score, riskLevel: p.risk.level,
    oddsUsableForModel: o.usable_for_model, oddsReliabilityScore: o.reliability_score, assignedMarketWeight: o.assigned_market_weight,
    finalScorePayload: clone(m.final_score), dataCoveragePayload: clone(p.data_coverage), modelOutputPayload: clone(m),
    confidencePayload: clone(p.confidence), riskPayload: clone(p.risk), explanationPayload: clone(p.explanation), snapshotPayload: clone(p), contentHash,
  };
}

function specialistRows(snapshot: FinalPredictionSnapshot): AnyRecord[] {
  return snapshot.specialist_contributions.map((s) => ({
    id: `${snapshot.identity.snapshot_id}:${s.model_role}:${s.model_version}`, predictionSnapshotId: snapshot.identity.snapshot_id,
    modelRole: s.model_role, modelVersion: s.model_version, available: s.available, assignedWeight: s.assigned_weight,
    outputQuality: s.output_quality, limitations: clone(s.limitations),
  }));
}

function mapSnapshotRow(row: AnyRecord): FinalPredictionSnapshot {
  const payload = asObject(row.snapshotPayload ?? row.snapshot_payload, "snapshot payload") as unknown as FinalPredictionSnapshot;
  try { assertFinalPredictionSnapshotValid(payload); } catch { invariant("Persisted prediction snapshot payload failed validation."); }
  return clone(payload);
}

async function readSnapshot(db: PredictionStorageDatabase, snapshotId: string): Promise<FinalPredictionSnapshot | null> {
  const row = await findOne(db.predictionSnapshotRecord, { snapshotId });
  if (!row) return null;
  const payload = mapSnapshotRow(row);
  const children = await db.predictionSpecialistContributionRecord.findMany({ where: { predictionSnapshotId: snapshotId }, orderBy: [{ modelRole: "asc" }, { modelVersion: "asc" }, { id: "asc" }] });
  if (children.length !== payload.specialist_contributions.length) invariant("Persisted specialist contribution rows are incomplete.");
  payload.specialist_contributions = children.map((child) => ({
    model_role: child.modelRole,
    model_version: child.modelVersion,
    available: child.available,
    assigned_weight: child.assignedWeight,
    output_quality: child.outputQuality,
    limitations: child.limitations,
  }));
  try { assertFinalPredictionSnapshotValid(payload); } catch { invariant("Persisted prediction specialist contribution rows failed validation."); }
  return clone(payload);
}

function progressionAllowed(previous: string, next: string): boolean {
  if (previous === "complete" || previous === "invalid") return previous === next;
  if (next === "invalid") return true;
  if (previous === "pending") return ["pending", "partial", "complete"].includes(next);
  if (previous === "partial") return ["partial", "complete"].includes(next);
  return false;
}

function mapLabelRow(row: AnyRecord): PredictionSnapshotLabels {
  const payload = asObject(row.labelPayload ?? row.label_payload, "label payload") as unknown as PredictionSnapshotLabels;
  try { assertPredictionSnapshotLabelsValid(payload); } catch { invariant("Persisted label payload failed validation."); }
  return clone(payload);
}

function mapEvaluationRow(row: AnyRecord): PredictionEvaluationRecord {
  const payload = asObject(row.evaluationPayload ?? row.evaluation_payload, "evaluation payload") as unknown as PredictionEvaluationRecord;
  try { assertPredictionEvaluationRecordValid(payload); } catch { invariant("Persisted evaluation payload failed validation."); }
  return clone(payload);
}

export function createPredictionStorage(dependencies: PredictionStorageDependencies = {}) {
  const db = () => dbOf(dependencies);
  const savePredictionFeatureSnapshot = async (rawInput: AnyRecord) => {
    const input = featureInput(rawInput); const contentHash = computeStorageContentHash({ snapshot_id: input.snapshotId, as_of: iso(input.asOf), sequence: input.sequence, trigger: input.trigger, feature: input.bundle });
    const existing = await findOne(db().predictionFeatureSnapshot, { snapshotId: input.snapshotId });
    if (existing) return existing.contentHash === contentHash ? mapFeatureRow(existing) : conflict(input.snapshotId);
    const row = featureRow(input, contentHash);
    try { await db().predictionFeatureSnapshot.create({ data: row }); } catch { const retry = await findOne(db().predictionFeatureSnapshot, { snapshotId: input.snapshotId }); if (retry?.contentHash === contentHash) return mapFeatureRow(retry); return conflict(input.snapshotId); }
    return clone(input.bundle);
  };
  const getPredictionFeatureSnapshotById = async (snapshotId: string) => {
    const row = await findOne(db().predictionFeatureSnapshot, { snapshotId: text(snapshotId, "snapshot_id") });
    return row ? mapFeatureRow(row) : null;
  };
  const listPredictionFeatureSnapshotsForFixture = async (fixtureId: string, options: ListOptions = {}) => {
    const rows = await db().predictionFeatureSnapshot.findMany(listWhere(options, text(fixtureId, "fixture_id"), "snapshotId"));
    return rows.map(mapFeatureRow);
  };

  const saveOddsIntelligenceAssessment = async (rawInput: unknown) => {
    const context = assessmentInput(rawInput); const contentHash = computeStorageContentHash(context);
    const existing = await findOne(db().oddsIntelligenceAssessmentRecord, { assessmentId: context.assessment_id });
    if (existing) return existing.contentHash === contentHash ? (await readAssessment(db(), context.assessment_id))! : conflict(context.assessment_id);
    const rows = assessmentRows(context, contentHash);
    await transaction(db(), async (tx) => {
      await tx.oddsIntelligenceAssessmentRecord.create({ data: rows.root });
      for (const market of rows.markets) await tx.oddsIntelligenceMarketRecord.create({ data: market });
      for (const selection of rows.selections) await tx.oddsIntelligenceSelectionRecord.create({ data: selection });
    });
    return clone(context);
  };
  const getOddsIntelligenceAssessmentById = async (assessmentId: string) => readAssessment(db(), text(assessmentId, "assessment_id"));
  const listOddsIntelligenceAssessmentsForFixture = async (fixtureId: string, options: ListOptions = {}) => {
    const rows = await db().oddsIntelligenceAssessmentRecord.findMany(listWhere(options, text(fixtureId, "fixture_id"), "assessmentId"));
    const result: InternalOddsIntelligenceContext[] = []; for (const row of rows) { const value = await readAssessment(db(), row.assessmentId); if (value) result.push(value); } return result;
  };

  const saveFinalPredictionSnapshot = async (rawInput: AnyRecord) => {
    const input = snapshotInput(rawInput); const p = input.snapshot; const i = p.identity; const feature = await findOne(db().predictionFeatureSnapshot, { snapshotId: input.featureSnapshotId });
    if (!feature) missing(input.featureSnapshotId);
    if (feature.fixtureId !== i.fixture_id) invariant("Prediction and feature fixture IDs do not match.");
    if (feature.featureVersion !== i.feature_version || feature.featureHash !== p.feature_reference.feature_hash || feature.featureCount !== p.feature_reference.feature_count) invariant("Prediction feature reference does not match the stored feature snapshot.");
    if (date(i.as_of, "as_of").getTime() < new Date(feature.asOf).getTime() || date(i.generated_at, "generated_at").getTime() < new Date(feature.generatedAt).getTime()) invariant("Prediction timestamps are earlier than the linked feature snapshot.");
    const oddsId = p.odds_intelligence_reference.assessment_id; let assessment: AnyRecord | null = null;
    if (oddsId !== null) {
      assessment = await findOne(db().oddsIntelligenceAssessmentRecord, { assessmentId: oddsId }); if (!assessment) missing(oddsId);
      if (assessment.fixtureId !== i.fixture_id || assessment.oddsIntelligenceVersion !== p.odds_intelligence_reference.odds_intelligence_version) invariant("Prediction Odds reference does not match the stored assessment.");
      if (new Date(assessment.generatedAt as string | number | Date).getTime() > date(i.generated_at, "generated_at").getTime()) invariant("Prediction cannot link to a future Odds assessment.");
      if (assessment.usableForModel !== p.odds_intelligence_reference.usable_for_model || Math.abs((assessment.overallReliabilityScore as number) - p.odds_intelligence_reference.reliability_score) > TOLERANCE) invariant("Prediction Odds reference values do not match the stored assessment.");
      if (p.odds_intelligence_reference.assigned_market_weight > (assessment.recommendedMarketModelWeight as number) + TOLERANCE) invariant("Assigned market weight exceeds the assessed recommendation.");
    } else if (p.odds_intelligence_reference.usable_for_model || p.odds_intelligence_reference.assigned_market_weight !== 0) invariant("Predictions without a usable Odds assessment must have no Odds model weight.");
    const contentHash = computeStorageContentHash({ snapshot: p, featureSnapshotId: input.featureSnapshotId, inferenceEngineVersion: input.inferenceEngineVersion, ensembleVersion: input.ensembleVersion, calibrationVersion: input.calibrationVersion, inferenceLatencyMs: input.inferenceLatencyMs, fallbackUsed: input.fallbackUsed });
    const existing = await findOne(db().predictionSnapshotRecord, { snapshotId: i.snapshot_id });
    if (existing) return existing.contentHash === contentHash ? (await readSnapshot(db(), i.snapshot_id))! : conflict(i.snapshot_id);
    const row = snapshotRow(input, contentHash); const specialists = specialistRows(p);
    await transaction(db(), async (tx) => { await tx.predictionSnapshotRecord.create({ data: row }); for (const specialist of specialists) await tx.predictionSpecialistContributionRecord.create({ data: specialist }); });
    return clone(p);
  };
  const getFinalPredictionSnapshotById = async (snapshotId: string) => readSnapshot(db(), text(snapshotId, "snapshot_id"));
  const listFinalPredictionSnapshotsForFixture = async (fixtureId: string, options: ListOptions = {}) => { const rows = await db().predictionSnapshotRecord.findMany(listWhere(options, text(fixtureId, "fixture_id"), "snapshotId")); const result: FinalPredictionSnapshot[] = []; for (const row of rows) { const value = await readSnapshot(db(), row.snapshotId); if (value) result.push(value); } return result; };

  const savePredictionLabelRevision = async (input: { labelVersion: string; revision: number; labels: PredictionSnapshotLabels }) => {
    try {
      const labelVersion = text(input.labelVersion, "label_version"); if (!Number.isInteger(input.revision) || input.revision < 1) throw new TypeError("revision must be a positive integer.");
      const labels = buildPredictionSnapshotLabels(input.labels); const snapshot = await findOne(db().predictionSnapshotRecord, { snapshotId: labels.snapshot_id }); if (!snapshot) missing(labels.snapshot_id);
      if (snapshot.fixtureId !== labels.fixture_id || new Date(snapshot.asOf).getTime() !== date(labels.as_of, "as_of").getTime()) invariant("Label fixture or as_of does not match the prediction snapshot.");
      const contentHash = computeStorageContentHash({ label_version: labelVersion, revision: input.revision, labels });
      const existing = await db().predictionLabelRevisionRecord.findFirst?.({ where: { predictionSnapshotId: labels.snapshot_id, labelVersion, revision: input.revision } });
      if (existing) return existing.contentHash === contentHash ? mapLabelRow(existing) : conflict(`${labels.snapshot_id}:${labelVersion}:${input.revision}`);
      const lower = await db().predictionLabelRevisionRecord.findFirst?.({ where: { predictionSnapshotId: labels.snapshot_id, labelVersion, revision: { lt: input.revision } }, orderBy: { revision: "desc" } });
      if (lower && !progressionAllowed(lower.status, labels.status)) invariant("Label revision regresses an immutable label state.");
      const row = { id: `${labels.snapshot_id}:${labelVersion}:${input.revision}`, predictionSnapshotId: labels.snapshot_id, fixtureId: labels.fixture_id, labelVersion, revision: input.revision, asOf: date(labels.as_of, "as_of"), labeledAt: date(labels.labeled_at, "labeled_at"), status: labels.status, finalOutcome: labels.final_outcome, nextGoalSide: labels.next_goal_side, goalInNext5m: labels.goal_in_next_5m, goalInNext10m: labels.goal_in_next_10m, goalInNext15m: labels.goal_in_next_15m, finalHomeScore: labels.final_home_score, finalAwayScore: labels.final_away_score, currentResultSurvival: labels.current_result_survival, momentumShift: labels.momentum_shift, sourceFinalizedAt: labels.source_finalized_at === null ? null : date(labels.source_finalized_at, "source_finalized_at"), limitations: clone(labels.limitations), labelPayload: clone(labels), contentHash };
      try { await db().predictionLabelRevisionRecord.create({ data: row }); } catch { const retry = await db().predictionLabelRevisionRecord.findFirst?.({ where: { predictionSnapshotId: labels.snapshot_id, labelVersion, revision: input.revision } }); if (retry?.contentHash === contentHash) return mapLabelRow(retry); conflict(`${labels.snapshot_id}:${labelVersion}:${input.revision}`); }
      return clone(labels);
    } catch (e) {
      if (e instanceof PredictionStorageInvariantError || e instanceof PredictionStorageConflictError || e instanceof PredictionStorageReferenceError) throw e;
      throw new PredictionStorageInvariantError(e instanceof Error ? e.message : "Invalid prediction label revision.", { cause: e });
    }
  };
  const getLatestPredictionLabelRevision = async (snapshotId: string, labelVersion: string) => { const row = await db().predictionLabelRevisionRecord.findFirst?.({ where: { predictionSnapshotId: text(snapshotId, "snapshot_id"), labelVersion: text(labelVersion, "label_version") }, orderBy: [{ revision: "desc" }, { id: "desc" }] }); return row ? mapLabelRow(row) : null; };
  const listPredictionLabelRevisions = async (snapshotId: string, labelVersion: string, options: ListOptions = {}) => { const args = listArgs(options, "revision", "id"); args.where = { ...(args.where ?? {}), predictionSnapshotId: text(snapshotId, "snapshot_id"), labelVersion: text(labelVersion, "label_version") }; const rows = await db().predictionLabelRevisionRecord.findMany(args); return rows.map(mapLabelRow); };

  const savePredictionEvaluationRecord = async (evaluation: PredictionEvaluationRecord) => {
    const built = buildPredictionEvaluationRecord(evaluation); const snapshot = await findOne(db().predictionSnapshotRecord, { snapshotId: built.snapshot_id }); if (!snapshot) missing(built.snapshot_id);
    if (snapshot.fixtureId !== built.fixture_id || snapshot.featureVersion !== built.feature_version) invariant("Evaluation reference does not match the prediction snapshot.");
    const label = await db().predictionLabelRevisionRecord.findFirst?.({ where: { predictionSnapshotId: built.snapshot_id, labelVersion: built.label_version } }); if (!label) missing(`${built.snapshot_id}:${built.label_version}`);
    const contentHash = computeStorageContentHash(built); const existing = await findOne(db().predictionEvaluationRecord, { evaluationId: built.evaluation_id }); if (existing) return existing.contentHash === contentHash ? mapEvaluationRow(existing) : conflict(built.evaluation_id);
    const row = { evaluationId: built.evaluation_id, predictionSnapshotId: built.snapshot_id, fixtureId: built.fixture_id, target: built.target, modelVersion: built.model_version, featureVersion: built.feature_version, labelVersion: built.label_version, evaluatedAt: date(built.evaluated_at, "evaluated_at"), multiclassLogLoss: built.metrics.multiclass_log_loss, multiclassBrierScore: built.metrics.multiclass_brier_score, expectedCalibrationError: built.metrics.expected_calibration_error, binaryLogLoss: built.metrics.binary_log_loss, binaryBrierScore: built.metrics.binary_brier_score, accuracy: built.metrics.accuracy, precision: built.metrics.precision, recall: built.metrics.recall, rocAuc: built.metrics.roc_auc, prAuc: built.metrics.pr_auc, negativeLogLikelihood: built.metrics.negative_log_likelihood, segmentKeys: clone(built.segment_keys), passedQualityGate: built.passed_quality_gate, limitations: clone(built.limitations), evaluationPayload: clone(built), contentHash };
    try { await db().predictionEvaluationRecord.create({ data: row }); } catch { const retry = await findOne(db().predictionEvaluationRecord, { evaluationId: built.evaluation_id }); if (retry?.contentHash === contentHash) return mapEvaluationRow(retry); conflict(built.evaluation_id); }
    return clone(built);
  };
  const getPredictionEvaluationRecordById = async (evaluationId: string) => { const row = await findOne(db().predictionEvaluationRecord, { evaluationId: text(evaluationId, "evaluation_id") }); return row ? mapEvaluationRow(row) : null; };
  const listPredictionEvaluationsForSnapshot = async (snapshotId: string, options: ListOptions = {}) => { const args = listArgs(options, "createdAt", "evaluationId"); args.where = { ...(args.where ?? {}), predictionSnapshotId: text(snapshotId, "snapshot_id") }; const rows = await db().predictionEvaluationRecord.findMany(args); return rows.map(mapEvaluationRow); };

  return { savePredictionFeatureSnapshot, getPredictionFeatureSnapshotById, listPredictionFeatureSnapshotsForFixture, saveOddsIntelligenceAssessment, getOddsIntelligenceAssessmentById, listOddsIntelligenceAssessmentsForFixture, saveFinalPredictionSnapshot, getFinalPredictionSnapshotById, listFinalPredictionSnapshotsForFixture, savePredictionLabelRevision, getLatestPredictionLabelRevision, listPredictionLabelRevisions, savePredictionEvaluationRecord, getPredictionEvaluationRecordById, listPredictionEvaluationsForSnapshot };
}

export function savePredictionFeatureSnapshot(input: AnyRecord, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).savePredictionFeatureSnapshot(input); }
export function getPredictionFeatureSnapshotById(snapshotId: string, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).getPredictionFeatureSnapshotById(snapshotId); }
export function listPredictionFeatureSnapshotsForFixture(fixtureId: string, options?: ListOptions, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).listPredictionFeatureSnapshotsForFixture(fixtureId, options); }
export function saveOddsIntelligenceAssessment(input: unknown, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).saveOddsIntelligenceAssessment(input); }
export function getOddsIntelligenceAssessmentById(assessmentId: string, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).getOddsIntelligenceAssessmentById(assessmentId); }
export function listOddsIntelligenceAssessmentsForFixture(fixtureId: string, options?: ListOptions, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).listOddsIntelligenceAssessmentsForFixture(fixtureId, options); }
export function saveFinalPredictionSnapshot(input: AnyRecord, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).saveFinalPredictionSnapshot(input); }
export function getFinalPredictionSnapshotById(snapshotId: string, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).getFinalPredictionSnapshotById(snapshotId); }
export function listFinalPredictionSnapshotsForFixture(fixtureId: string, options?: ListOptions, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).listFinalPredictionSnapshotsForFixture(fixtureId, options); }
export function savePredictionLabelRevision(input: { labelVersion: string; revision: number; labels: PredictionSnapshotLabels }, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).savePredictionLabelRevision(input); }
export function getLatestPredictionLabelRevision(snapshotId: string, labelVersion: string, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).getLatestPredictionLabelRevision(snapshotId, labelVersion); }
export function listPredictionLabelRevisions(snapshotId: string, labelVersion: string, options?: ListOptions, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).listPredictionLabelRevisions(snapshotId, labelVersion, options); }
export function savePredictionEvaluationRecord(input: PredictionEvaluationRecord, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).savePredictionEvaluationRecord(input); }
export function getPredictionEvaluationRecordById(evaluationId: string, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).getPredictionEvaluationRecordById(evaluationId); }
export function listPredictionEvaluationsForSnapshot(snapshotId: string, options?: ListOptions, dependencies?: PredictionStorageDependencies) { return createPredictionStorage(dependencies).listPredictionEvaluationsForSnapshot(snapshotId, options); }
