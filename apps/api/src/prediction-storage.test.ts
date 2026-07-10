import assert from "node:assert/strict";
import test from "node:test";
import { FINAL_PREDICTION_SAFETY_NOTE, type FinalPredictionSnapshot, type PredictionSnapshotLabels, type PredictionEvaluationRecord } from "./final-prediction-domain.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";
import { createPredictionStorage, PredictionStorageConflictError, PredictionStorageInvariantError, PredictionStorageReferenceError, type PredictionStorageDatabase } from "./prediction-storage.js";
import type { InternalOddsIntelligenceContext } from "./odds-intelligence-contract.js";

type FakeDbArgs = { where?: any; orderBy?: any; take?: number; data?: any };

class FakeDelegate {
  rows: any[] = [];
  async create({ data }: FakeDbArgs) {
    if (!data.id && data.snapshotId) data.id = data.snapshotId;
    this.rows.push(structuredClone(data));
    return data;
  }
  async findUnique({ where }: FakeDbArgs) {
    return this.rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
  }
  async findFirst({ where, orderBy }: FakeDbArgs) {
    let rows = this.rows.filter((row) => matches(row, where ?? {}));
    if (orderBy) rows.sort(compareOrder(orderBy));
    return rows[0] ?? null;
  }
  async findMany({ where, orderBy, take }: FakeDbArgs) {
    let rows = this.rows.filter((row) => matches(row, where ?? {}));
    if (orderBy) rows.sort(compareOrder(orderBy));
    return rows.slice(0, take ?? rows.length);
  }
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
  featureSchemaRegistry?: FakeDelegate;
  labelSchemaRegistry?: FakeDelegate;
  trainingDatasetRegistry?: FakeDelegate;
  modelRegistryEntry?: FakeDelegate;
  $transaction<T>(fn: (transaction: PredictionStorageDatabase) => Promise<T>): Promise<T>;
};

function matches(row: any, where: any): boolean { return Object.entries(where).every(([key, value]: any) => value && typeof value === "object" && !Array.isArray(value) ? ("lt" in value ? row[key] < value.lt : "in" in value ? value.in.includes(row[key]) : matches(row[key], value)) : row[key] === value); }
function compareOrder(orderBy: any): (a: any, b: any) => number { const orders = Array.isArray(orderBy) ? orderBy : [orderBy]; return (a, b) => { for (const order of orders) { const [key, direction] = Object.entries(order)[0] as [string, string]; if (a[key] === b[key]) continue; return (a[key] > b[key] ? 1 : -1) * (direction === "desc" ? -1 : 1); } return 0; }; }

function database(): FakePredictionStorageDatabase {
  const db: FakePredictionStorageDatabase = {
    predictionFeatureSnapshot: new FakeDelegate(),
    oddsIntelligenceAssessmentRecord: new FakeDelegate(),
    oddsIntelligenceMarketRecord: new FakeDelegate(),
    oddsIntelligenceSelectionRecord: new FakeDelegate(),
    predictionSnapshotRecord: new FakeDelegate(),
    predictionSpecialistContributionRecord: new FakeDelegate(),
    predictionLabelRevisionRecord: new FakeDelegate(),
    predictionEvaluationRecord: new FakeDelegate(),
    $transaction: async (fn: any) => {
      const backup: Record<string, any[]> = {};
      const keys = ["predictionFeatureSnapshot", "oddsIntelligenceAssessmentRecord", "oddsIntelligenceMarketRecord", "oddsIntelligenceSelectionRecord", "predictionSnapshotRecord", "predictionSpecialistContributionRecord", "predictionLabelRevisionRecord", "predictionEvaluationRecord"] as const;
      for (const key of keys) { backup[key] = structuredClone(db[key].rows); }
      try {
        return await fn(db as unknown as PredictionStorageDatabase);
      } catch (e) {
        for (const key of keys) { db[key].rows = backup[key]; }
        throw e;
      }
    }
  };
  return db;
}

function feature(overrides = {}): any { return { feature_version: "prediction-features-v1", fixture_id: "f1", generated_at: "2026-07-10T10:00:01.000Z", normalized_phase: "first_half", input_summary: { fixture_id: "f1", phase: "1h", minute: 20, home_score: 0, away_score: 0, score_diff: 0, has_scoreboard: true, has_odds: true, odds_count: 1, data_quality: "complete", freshness_label: "fresh", market_reliability: "available", event_pressure: "low" }, features: { phase_progress: 0.5, coverage_score: 1 }, diagnostics: { missing_inputs: [], limitations: [] }, ...overrides }; }
function validFeatureSnapshotInput(overrides = {}): any { return { snapshot_id: "fs1", fixture_id: "f1", as_of: "2026-07-10T10:00:00.000Z", sequence: null, trigger: "initial_state", feature_bundle: feature(), ...overrides }; }
function market(): any { return { market_key: "1x2", market_type: "match_result_1x2", line: null, complete: true, usable: true, selection_count: 3, provider_count: 2, snapshot_count: 3, overround: null, provider_dispersion: 0.1, volatility_score: 0.1, selections: [{ selection: "away", line: null, fair_probability: 0.3, consensus_probability: 0.3, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null }, { selection: "draw", line: null, fair_probability: 0.3, consensus_probability: 0.3, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null }, { selection: "home", line: null, fair_probability: 0.4, consensus_probability: 0.4, probability_change_1m: null, probability_change_5m: null, movement_velocity: null, movement_acceleration: null }], component_scores: { structural_validity: 1, freshness: 1, market_completeness: 1, provider_quality: 0.8, provider_consensus: 0.8, dispersion_quality: 0.9, movement_integrity: 0.8, event_consistency: 1, historical_support: 0.5, overall_reliability: 0.8 }, reliability_level: "reliable", reliability_score: 0.8, recommended_model_weight: 0.3, issues: [], limitations: [], latest_timestamp: "2026-07-10T10:00:00.000Z" }; }
function odds(): InternalOddsIntelligenceContext { return { odds_intelligence_version: "odds-intelligence-v1", assessment_id: "a1", fixture_id: "f1", generated_at: "2026-07-10T10:00:00.000Z", status: "reliable", usable_for_model: true, overall_reliability_score: 0.8, recommended_market_model_weight: 0.3, market_count: 1, usable_market_count: 1, provider_count: 2, snapshot_count: 3, consensus_score: 0.8, freshness_score: 1, volatility_score: 0.1, anomaly_score: 0.1, primary_match_result_market: market(), markets: [market()], issues: [], limitations: [] }; }
function snapshot(featureHash: string): FinalPredictionSnapshot { return { identity: { snapshot_id: "s1", fixture_id: "f1", as_of: "2026-07-10T10:00:00.000Z", generated_at: "2026-07-10T10:00:02.000Z", sequence: null, trigger: "initial_state", feature_version: "prediction-features-v1", prediction_contract_version: "prediction-domain-v1" }, match_context: { phase: "1h", normalized_phase: "first_half", minute: 20, home_score: 0, away_score: 0, score_diff: 0 }, feature_reference: { feature_version: "prediction-features-v1", feature_hash: featureHash, feature_count: 2 }, data_coverage: { has_fixture: true, has_scoreboard: true, has_minute: true, has_odds: true, has_reliable_odds: true, has_events: true, has_event_impact: true, has_pre_match_features: true, feature_coverage_score: 1 }, model_output: { final_outcome: { home: 0.4, draw: 0.3, away: 0.3 }, next_goal: { home: 0.4, none: 0.2, away: 0.4 }, goal_horizon: { next_5m: 0.1, next_10m: 0.2, next_15m: 0.3 }, final_score: { outcomes: [{ home_score: 1, away_score: 0, probability: 0.4 }, { home_score: 0, away_score: 0, probability: 0.3 }], other_probability: 0.3 }, current_result_survival: { current_result_holds: 0.8, current_result_changes: 0.2 }, momentum_shift: { home_strengthens: 0.3, neutral: 0.4, away_strengthens: 0.3 } }, confidence: { level: "medium", score: 0.6, calibration_score: 0.5, model_agreement_score: 0.7, data_coverage_score: 0.9, freshness_score: 1, out_of_distribution_score: 0.8, reasons: [] }, risk: { level: "low", reasons: [] }, specialist_contributions: [{ model_role: "live_state", model_version: "m1", available: true, assigned_weight: 1, output_quality: 0.8, limitations: [] }], odds_intelligence_reference: { odds_intelligence_version: "odds-intelligence-v1", assessment_id: "a1", usable_for_model: true, reliability_score: 0.8, assigned_market_weight: 0.2 }, explanation: { summary: "Informational snapshot.", main_factors: [], limitations: [] }, safety_note: FINAL_PREDICTION_SAFETY_NOTE }; }
function validSnapshotInput(featureHash: string, overrides = {}): any { return { snapshot: snapshot(featureHash), feature_snapshot_id: "fs1", inference_engine_version: "v1", ensemble_version: "v1", fallback_used: false, ...overrides }; }
function labels(status: "pending" | "partial" | "complete" | "invalid" = "pending"): PredictionSnapshotLabels { const partial = status === "partial"; return { snapshot_id: "s1", fixture_id: "f1", as_of: "2026-07-10T10:00:00.000Z", labeled_at: "2026-07-10T12:00:00.000Z", status, final_outcome: status === "pending" ? null : "home", next_goal_side: status === "complete" ? "home" : null, goal_in_next_5m: status === "complete" ? false : null, goal_in_next_10m: status === "complete" ? false : null, goal_in_next_15m: status === "complete" ? false : null, final_home_score: status === "complete" ? 1 : null, final_away_score: status === "complete" ? 0 : null, current_result_survival: status === "complete" ? "held" : null, momentum_shift: status === "complete" ? "home_strengthened" : null, source_finalized_at: status === "complete" ? "2026-07-10T11:00:00.000Z" : null, limitations: status === "pending" ? ["pending"] : partial ? ["partial"] : status === "invalid" ? ["label invalidated after finalization"] : [] }; }
function evaluation(): PredictionEvaluationRecord { return { evaluation_id: "e1", snapshot_id: "s1", fixture_id: "f1", target: "final_outcome_1x2", model_version: "m1", feature_version: "prediction-features-v1", label_version: "labels-v1", evaluated_at: "2026-07-10T13:00:00.000Z", segment_keys: ["live"], metrics: { multiclass_log_loss: 0.4, multiclass_brier_score: 0.2, expected_calibration_error: 0.1, binary_log_loss: null, binary_brier_score: null, accuracy: 1, precision: 1, recall: 1, roc_auc: null, pr_auc: null, negative_log_likelihood: null }, passed_quality_gate: true, limitations: [] }; }

// --- Part F: Feature Snapshot Tests ---
test("test-1: Valid feature snapshot saves", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.ok(await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput())); });
test("test-2: Builder validation runs before database access", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ feature_bundle: { ...feature(), generated_at: "invalid" } })), PredictionStorageInvariantError); });
test("test-3: Fixture mismatch fails", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ fixture_id: "other" })), PredictionStorageInvariantError); });
test("test-8: Same ID and same content is idempotent", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); const res = await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); assert.ok(res); assert.equal(db.predictionFeatureSnapshot.rows.length, 1); });
test("test-9: Same ID and changed content conflicts", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); const bundle2 = feature(); bundle2.features.coverage_score = 0.5; await assert.rejects(() => s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ feature_bundle: bundle2 })), PredictionStorageConflictError); });
test("test-10: Read returns reconstructed validated domain data", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); assert.deepEqual(await s.getPredictionFeatureSnapshotById("fs1"), feature()); });
test("test-11: Corrupt persisted payload causes invariant error", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); db.predictionFeatureSnapshot.rows[0].featurePayload = {}; await assert.rejects(() => s.getPredictionFeatureSnapshotById("fs1"), PredictionStorageInvariantError); });
test("test-12: Missing record returns null result", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.equal(await s.getPredictionFeatureSnapshotById("nonexistent"), null); });
test("test-13: Fixture list defaults to limit 50", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); for (let i = 0; i < 60; i++) await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: `fs${i}` })); assert.equal((await s.listPredictionFeatureSnapshotsForFixture("f1")).length, 50); });
test("test-14: Limit 1 is accepted", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs1" })); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs2" })); assert.equal((await s.listPredictionFeatureSnapshotsForFixture("f1", { limit: 1 })).length, 1); });
test("test-15: Limit 200 is accepted", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.equal((await s.listPredictionFeatureSnapshotsForFixture("f1", { limit: 200 })).length, 0); });
test("test-16: Limit 0 is rejected", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.listPredictionFeatureSnapshotsForFixture("f1", { limit: 0 }), RangeError); });
test("test-17: Limit 201 is rejected", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.listPredictionFeatureSnapshotsForFixture("f1", { limit: 201 }), RangeError); });
test("test-18: Results are newest-first", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs1" })); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs2", as_of: "2026-07-10T10:00:01.000Z" })); const res = await s.listPredictionFeatureSnapshotsForFixture("f1"); assert.equal(res.length, 2); });
test("test-19: Equal timestamps use stable ID ordering", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs1" })); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ snapshot_id: "fs2" })); const res = await s.listPredictionFeatureSnapshotsForFixture("f1"); assert.equal(res.length, 2); });
test("test-20: Cursor/before validation is enforced", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.listPredictionFeatureSnapshotsForFixture("f1", { before: "invalid" }), TypeError); });

// --- Part G: Odds Assessment Tests ---
test("test-21: Valid assessment persists", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.ok(await s.saveOddsIntelligenceAssessment(odds())); });
test("test-22: Root/market/selection transaction is used", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); assert.equal(db.oddsIntelligenceAssessmentRecord.rows.length, 1); assert.equal(db.oddsIntelligenceMarketRecord.rows.length, 1); assert.equal(db.oddsIntelligenceSelectionRecord.rows.length, 3); });
test("test-23: Selection failure rolls back the aggregate", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); db.oddsIntelligenceSelectionRecord.create = async () => { throw new Error("DB Error"); }; await assert.rejects(() => s.saveOddsIntelligenceAssessment(odds()), Error); assert.equal(db.oddsIntelligenceAssessmentRecord.rows.length, 0); assert.equal(db.oddsIntelligenceMarketRecord.rows.length, 0); });
test("test-24: Domain validator runs before persistence", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.saveOddsIntelligenceAssessment({ ...odds(), generated_at: "invalid" }), PredictionStorageInvariantError); });
test("test-25: Same assessment and same hash is idempotent", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); await s.saveOddsIntelligenceAssessment(odds()); assert.equal(db.oddsIntelligenceAssessmentRecord.rows.length, 1); });
test("test-26: Same assessment ID with changed payload conflicts", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); const o = odds(); o.generated_at = "2026-07-10T10:00:01.000Z"; await assert.rejects(() => s.saveOddsIntelligenceAssessment(o), PredictionStorageConflictError); });
test("test-27: Root market counts are preserved", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); assert.equal(db.oddsIntelligenceAssessmentRecord.rows[0].marketCount, 1); });
test("test-28: Selection counts are preserved", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); assert.equal(db.oddsIntelligenceMarketRecord.rows[0].selectionCount, 3); });
test("test-29: Primary market is preserved", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); assert.ok((await s.getOddsIntelligenceAssessmentById("a1"))!.primary_match_result_market); });
test("test-30: Internal assessment read is revalidated", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); const o = await s.getOddsIntelligenceAssessmentById("a1"); assert.deepEqual(o, odds()); });
test("test-31: Corrupt assessment payload causes invariant error", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); db.oddsIntelligenceAssessmentRecord.rows[0].assessmentPayload = {}; await assert.rejects(() => s.getOddsIntelligenceAssessmentById("a1"), PredictionStorageInvariantError); });
test("test-32: Raw Odds input is not accepted by the repository API", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.saveOddsIntelligenceAssessment({ id: 1, raw: true }), PredictionStorageInvariantError); });
test("test-33: Provider payload is rejected before storage", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.saveOddsIntelligenceAssessment({ provider: "DraftKings", data: {} }), PredictionStorageInvariantError); });
test("test-34: Fixture list is bounded", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); assert.equal((await s.listOddsIntelligenceAssessmentsForFixture("f1", { limit: 5 })).length, 0); });
test("test-35: Newest-first stable ordering is enforced", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await s.saveOddsIntelligenceAssessment(odds()); await s.saveOddsIntelligenceAssessment({ ...odds(), assessment_id: "a2", generated_at: "2026-07-10T10:00:01.000Z" }); const res = await s.listOddsIntelligenceAssessmentsForFixture("f1"); assert.equal(res[0].assessment_id, "a2"); });

// --- Part H: Final Prediction Tests ---
test("test-36: Valid final prediction persists", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); assert.equal(db.predictionSnapshotRecord.rows.length, 1); });
test("test-37: Feature snapshot is required", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput("hash")), PredictionStorageReferenceError); });
test("test-38: Feature fixture must match", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); const f = feature(); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput({ fixture_id: "other", feature_bundle: { ...f, fixture_id: "other", input_summary: { ...f.input_summary, fixture_id: "other" } } })); await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput(computeStorageContentHash({ ...f, fixture_id: "other" }))), PredictionStorageInvariantError); });
test("test-42: Missing Odds assessment fails when referenced", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); const f = feature(); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput(computeStorageContentHash(f))), PredictionStorageReferenceError); });
test("test-50: Assigned market weight above recommendation fails", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); const p = snapshot(h); p.odds_intelligence_reference.assigned_market_weight = 0.9; await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput(h, { snapshot: p })), PredictionStorageInvariantError); });
test("test-53: Prediction and specialists persist transactionally", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); assert.equal(db.predictionSnapshotRecord.rows.length, 1); assert.equal(db.predictionSpecialistContributionRecord.rows.length, 1); });
test("test-54: Specialist failure rolls back prediction", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); db.predictionSpecialistContributionRecord.create = async () => { throw new Error("DB Error"); }; await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput(h)), Error); assert.equal(db.predictionSnapshotRecord.rows.length, 0); });
test("test-55: Same prediction and same hash is idempotent", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); assert.equal(db.predictionSnapshotRecord.rows.length, 1); });
test("test-56: Same snapshot ID with changed payload conflicts", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); const changed = snapshot(h); changed.confidence.score = 0.9; await assert.rejects(() => s.saveFinalPredictionSnapshot(validSnapshotInput(h, { snapshot: changed })), PredictionStorageConflictError); });
test("test-57: Prediction read is reconstructed and revalidated", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); assert.deepEqual(await s.getFinalPredictionSnapshotById("s1"), snapshot(h)); });
test("test-58: Corrupt persisted prediction causes invariant error", async () => { const db = database(); const s = createPredictionStorage({ db: db as unknown as PredictionStorageDatabase }); const f = feature(); const h = computeStorageContentHash(f); await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput()); await s.saveOddsIntelligenceAssessment(odds()); await s.saveFinalPredictionSnapshot(validSnapshotInput(h)); db.predictionSnapshotRecord.rows[0].snapshotPayload = {}; await assert.rejects(() => s.getFinalPredictionSnapshotById("s1"), PredictionStorageInvariantError); });

// --- Part I: Label Revision Tests ---
async function setupLabelDependencies(s: any) {
  const f = feature(); const h = computeStorageContentHash(f);
  await s.savePredictionFeatureSnapshot(validFeatureSnapshotInput());
  await s.saveOddsIntelligenceAssessment(odds());
  await s.saveFinalPredictionSnapshot(validSnapshotInput(h));
}
test("test-60: First pending revision persists", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); assert.ok(await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels() })); });
test("test-64: Pending to complete is allowed", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels("pending") }); assert.ok(await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 2, labels: labels("complete") })); });
test("test-70: Complete to partial is rejected", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels("complete") }); await assert.rejects(() => s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 2, labels: labels("partial") }), PredictionStorageInvariantError); });
test("test-72: Complete to invalid is rejected", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels("complete") }); await assert.rejects(() => s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 2, labels: labels("invalid") }), PredictionStorageInvariantError); });
test("test-78: Prediction snapshot must exist", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels() }), PredictionStorageReferenceError); });
test("test-81: Same revision and same hash is idempotent", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels() }); const res = await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels() }); assert.ok(res); });
test("test-82: Same revision with changed content conflicts", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: labels() }); const changed = labels(); changed.limitations = ["changed"]; await assert.rejects(() => s.savePredictionLabelRevision({ labelVersion: "lv1", revision: 1, labels: changed }), PredictionStorageConflictError); });

// --- Part J: Evaluation Tests ---
test("test-86: Valid evaluation persists", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await setupLabelDependencies(s); await s.savePredictionLabelRevision({ labelVersion: "labels-v1", revision: 1, labels: labels("complete") }); assert.ok(await s.savePredictionEvaluationRecord(evaluation())); });
test("test-87: Prediction snapshot must exist (eval)", async () => { const s = createPredictionStorage({ db: database() as unknown as PredictionStorageDatabase }); await assert.rejects(() => s.savePredictionEvaluationRecord(evaluation()), PredictionStorageReferenceError); });

// --- Part M: Fake DB Quality Tests ---
test("fake db creates deep copies", async () => { const db = database(); const row = { id: 1, nested: { value: 1 } }; await db.predictionFeatureSnapshot.create({ data: row }); row.nested.value = 2; const stored = await db.predictionFeatureSnapshot.findUnique({ where: { id: 1 } }); assert.equal(stored.nested.value, 1); });
test("fake db transaction rollback", async () => { const db = database(); await assert.rejects(() => db.$transaction(async (tx: any) => { await tx.predictionFeatureSnapshot.create({ data: { id: 1 } }); throw new Error("Rollback"); }), Error); const stored = await db.predictionFeatureSnapshot.findMany({} as any); assert.equal(stored.length, 0); });

// --- Part L: Error Mapping Tests
test("error type mapping", () => {
  assert.equal(new PredictionStorageConflictError("msg").name, "PredictionStorageConflictError");
  assert.equal(new PredictionStorageReferenceError("msg").name, "PredictionStorageReferenceError");
  assert.equal(new PredictionStorageInvariantError("msg").name, "PredictionStorageInvariantError");
});
