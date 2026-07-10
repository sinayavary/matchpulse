import assert from "node:assert/strict";
import test from "node:test";
import {
  FINAL_PREDICTION_SAFETY_NOTE,
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

const snapshot = (): FinalPredictionSnapshot => ({
  identity: {
    snapshot_id: "s1",
    fixture_id: "f1",
    as_of: "2026-07-10T10:00:00Z",
    generated_at: "2026-07-10T10:00:01Z",
    sequence: null,
    trigger: "initial_state",
    feature_version: "prediction-features-v1",
    prediction_contract_version: "prediction-domain-v1",
  },
  match_context: {
    phase: "live",
    normalized_phase: "first_half",
    minute: 20,
    home_score: 0,
    away_score: 0,
    score_diff: 0,
  },
  feature_reference: {
    feature_version: "prediction-features-v1",
    feature_hash: "opaque-hash",
    feature_count: 12,
  },
  data_coverage: {
    has_fixture: true,
    has_scoreboard: true,
    has_minute: true,
    has_odds: true,
    has_reliable_odds: true,
    has_events: true,
    has_event_impact: true,
    has_pre_match_features: true,
    feature_coverage_score: 1,
  },
  model_output: {
    final_outcome: { home: 0.4, draw: 0.3, away: 0.3 },
    next_goal: { home: 0.4, none: 0.2, away: 0.4 },
    goal_horizon: { next_5m: 0.1, next_10m: 0.2, next_15m: 0.3 },
    final_score: {
      outcomes: [
        { home_score: 1, away_score: 0, probability: 0.4 },
        { home_score: 0, away_score: 0, probability: 0.3 },
      ],
      other_probability: 0.3,
    },
    current_result_survival: {
      current_result_holds: 0.8,
      current_result_changes: 0.2,
    },
    momentum_shift: {
      home_strengthens: 0.3,
      neutral: 0.4,
      away_strengthens: 0.3,
    },
  },
  confidence: {
    level: "medium",
    score: 0.6,
    calibration_score: 0.5,
    model_agreement_score: 0.7,
    data_coverage_score: 0.9,
    freshness_score: 1,
    out_of_distribution_score: 0.8,
    reasons: ["adequate coverage"],
  },
  risk: { level: "low", reasons: [] },
  specialist_contributions: [
    {
      model_role: "live_state",
      model_version: "m1",
      available: true,
      assigned_weight: 1,
      output_quality: 0.8,
      limitations: ["limited event history"],
    },
  ],
  odds_intelligence_reference: {
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: "a1",
    usable_for_model: true,
    reliability_score: 0.8,
    assigned_market_weight: 0.2,
  },
  explanation: {
    summary: "Informational snapshot.",
    main_factors: ["scoreboard"],
    limitations: ["No formula exposed."],
  },
  safety_note: FINAL_PREDICTION_SAFETY_NOTE,
});
const labels = (): PredictionSnapshotLabels => ({
  snapshot_id: "s1",
  fixture_id: "f1",
  as_of: "2026-07-10T10:00:00Z",
  labeled_at: "2026-07-10T12:00:00Z",
  status: "pending",
  final_outcome: null,
  next_goal_side: null,
  goal_in_next_5m: null,
  goal_in_next_10m: null,
  goal_in_next_15m: null,
  final_home_score: null,
  final_away_score: null,
  current_result_survival: null,
  momentum_shift: null,
  source_finalized_at: null,
  limitations: ["pending", "pending"],
});
test("valid snapshot passes and builder clones/deduplicates", () => {
  const input = snapshot();
  const copy = buildFinalPredictionSnapshot(input);
  assert.notStrictEqual(copy, input);
  assert.deepEqual(copy.explanation.main_factors, ["scoreboard"]);
  input.explanation.main_factors.push("changed");
  assert.deepEqual(copy.explanation.main_factors, ["scoreboard"]);
});
test("snapshot validation rejects versions, timestamps, scores, distributions and forbidden keys", () => {
  const cases = [
    () => {
      const x = snapshot();
      x.identity.prediction_contract_version = "bad" as never;
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      x.identity.generated_at = "2026-07-09T00:00:00Z";
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      x.match_context.minute = 121;
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      x.match_context.home_score = -1;
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      x.model_output.goal_horizon.next_5m = 0.3;
      x.model_output.goal_horizon.next_10m = 0.2;
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      x.model_output.final_score.outcomes.push({
        home_score: 1,
        away_score: 0,
        probability: 0,
      });
      assertFinalPredictionSnapshotValid(x);
    },
    () => {
      const x = snapshot();
      (x as unknown as Record<string, unknown>).raw_payload = {};
      assertFinalPredictionSnapshotValid(x);
    },
  ];
  for (const fn of cases) assert.throws(fn);
});
test("labels accept pending values and clone without mutation", () => {
  const input = labels();
  const copy = buildPredictionSnapshotLabels(input);
  assert.deepEqual(copy.limitations, ["pending"]);
  input.limitations.push("changed");
  assert.deepEqual(copy.limitations, ["pending"]);
  assert.doesNotThrow(() => assertPredictionSnapshotLabelsValid(copy));
});
test("labels reject invalid score, timestamp and enum", () => {
  for (const mutate of [
    (x: PredictionSnapshotLabels) => (x.final_home_score = -1),
    (x: PredictionSnapshotLabels) => (x.labeled_at = "bad"),
    (x: PredictionSnapshotLabels) => (x.status = "unknown" as never),
  ]) {
    const x = labels();
    mutate(x);
    assert.throws(() => assertPredictionSnapshotLabelsValid(x));
  }
});

test("snapshot feature versions must match", () => {
  const x = snapshot();
  x.feature_reference.feature_version = "other";
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
});
test("snapshot score difference must match available scores", () => {
  const x = snapshot();
  x.match_context.score_diff = 1;
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
});
test("missing score requires null score difference", () => {
  const x = snapshot();
  x.match_context.away_score = null;
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
});
test("minute and reliable odds coverage are consistent", () => {
  const x = snapshot();
  x.data_coverage.has_minute = false;
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
  const y = snapshot();
  y.data_coverage.has_odds = false;
  assert.throws(() => assertFinalPredictionSnapshotValid(y));
});
test("unusable and usable odds have their required weights and identity", () => {
  const x = snapshot();
  x.odds_intelligence_reference.usable_for_model = false;
  x.odds_intelligence_reference.assigned_market_weight = 0.1;
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
  const y = snapshot();
  y.odds_intelligence_reference.assessment_id = " ";
  assert.throws(() => assertFinalPredictionSnapshotValid(y));
});
test("specialist roles and normalized weights are enforced", () => {
  const x = snapshot();
  x.specialist_contributions[0].model_role = "bad" as never;
  assert.throws(() => assertFinalPredictionSnapshotValid(x));
  const y = snapshot();
  y.specialist_contributions[0].assigned_weight = 0.5;
  assert.throws(() => assertFinalPredictionSnapshotValid(y));
});
test("label status and horizon invariants are explicit", () => {
  const pending = labels();
  pending.final_outcome = "home";
  assert.throws(() => assertPredictionSnapshotLabelsValid(pending));
  const partial = labels();
  partial.status = "partial";
  partial.final_outcome = "home";
  assert.doesNotThrow(() => assertPredictionSnapshotLabelsValid(partial));
  partial.goal_in_next_5m = true;
  assert.throws(() => assertPredictionSnapshotLabelsValid(partial));
});
test("complete labels require finalized source and all targets", () => {
  const x = labels();
  x.status = "complete";
  assert.throws(() => assertPredictionSnapshotLabelsValid(x));
  const y = labels();
  y.status = "invalid";
  y.limitations = [];
  assert.throws(() => assertPredictionSnapshotLabelsValid(y));
});

const evaluation = (): PredictionEvaluationRecord => ({
  evaluation_id: "e1",
  snapshot_id: "s1",
  fixture_id: "f1",
  target: "final_outcome_1x2",
  model_version: "m1",
  feature_version: "fv1",
  label_version: "lv1",
  evaluated_at: "2026-07-10T12:00:00Z",
  segment_keys: ["live", "live"],
  metrics: {
    multiclass_log_loss: 0.4,
    multiclass_brier_score: 0.2,
    expected_calibration_error: 0.1,
    binary_log_loss: null,
    binary_brier_score: null,
    accuracy: 0.8,
    precision: 0.8,
    recall: 0.7,
    roc_auc: 0.9,
    pr_auc: 0.8,
    negative_log_likelihood: 0.4,
  },
  passed_quality_gate: true,
  limitations: ["none", "none"],
});
test("evaluation validator accepts valid records and builder clones/deduplicates", () => {
  const input = evaluation();
  const copy = buildPredictionEvaluationRecord(input);
  assert.notStrictEqual(copy, input);
  assert.deepEqual(copy.segment_keys, ["live"]);
  assert.deepEqual(copy.limitations, ["none"]);
  input.segment_keys.push("changed");
  assert.deepEqual(copy.segment_keys, ["live"]);
});
test("evaluation rejects invalid target and metric bounds", () => {
  const target = evaluation();
  target.target = "bad" as never;
  assert.throws(() => assertPredictionEvaluationRecordValid(target));
  const metric = evaluation();
  metric.metrics.accuracy = 2;
  assert.throws(() => assertPredictionEvaluationRecordValid(metric));
  const loss = evaluation();
  loss.metrics.negative_log_likelihood = -1;
  assert.throws(() => assertPredictionEvaluationRecordValid(loss));
});

// Phase 10C-H2 traceability: one named test per permanent snapshot invariant.
test("valid snapshot passes", () => assert.doesNotThrow(() => assertFinalPredictionSnapshotValid(snapshot())));
test("snapshot builder returns a deep clone", () => {
  const copy = buildFinalPredictionSnapshot(snapshot());
  assert.notStrictEqual(copy.model_output, snapshot().model_output);
  assert.notStrictEqual(copy.model_output.final_score, snapshot().model_output.final_score);
});
test("snapshot builder does not mutate input", () => {
  const input = snapshot();
  const before = structuredClone(input);
  buildFinalPredictionSnapshot(input);
  assert.deepEqual(input, before);
});
test("snapshot builder deduplicates confidence reasons", () => {
  const x = snapshot(); x.confidence.reasons = ["a", "a"];
  assert.deepEqual(buildFinalPredictionSnapshot(x).confidence.reasons, ["a"]);
});
test("snapshot builder deduplicates risk reasons", () => {
  const x = snapshot(); x.risk.reasons = ["missing_events", "missing_events"];
  assert.deepEqual(buildFinalPredictionSnapshot(x).risk.reasons, ["missing_events"]);
});
test("snapshot builder deduplicates explanation factors", () => {
  const x = snapshot(); x.explanation.main_factors = ["a", "a"];
  assert.deepEqual(buildFinalPredictionSnapshot(x).explanation.main_factors, ["a"]);
});
test("snapshot builder preserves all probability values exactly", () => {
  const x = snapshot();
  x.model_output.final_outcome = { home: 0.400001, draw: 0.299999, away: 0.3 };
  x.model_output.next_goal = { home: 0.400001, none: 0.199999, away: 0.4 };
  x.model_output.goal_horizon = { next_5m: 0.100001, next_10m: 0.200001, next_15m: 0.3 };
  x.odds_intelligence_reference.reliability_score = 0.800001;
  x.odds_intelligence_reference.assigned_market_weight = 0.200001;
  x.confidence.score = 0.600001;
  const copy = buildFinalPredictionSnapshot(x);
  assert.deepEqual(copy.model_output, x.model_output);
  assert.deepEqual(copy.odds_intelligence_reference, x.odds_intelligence_reference);
  assert.equal(copy.confidence.score, x.confidence.score);
});
test("invalid prediction contract version fails", () => { const x = snapshot(); x.identity.prediction_contract_version = "bad" as never; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("empty snapshot ID fails", () => { const x = snapshot(); x.identity.snapshot_id = " "; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("empty fixture ID fails", () => { const x = snapshot(); x.identity.fixture_id = ""; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid as_of fails", () => { const x = snapshot(); x.identity.as_of = "bad"; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid generated_at fails", () => { const x = snapshot(); x.identity.generated_at = "bad"; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("generated_at less than as_of fails", () => { const x = snapshot(); x.identity.generated_at = "2026-07-10T09:00:00Z"; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("negative sequence fails", () => { const x = snapshot(); x.identity.sequence = -1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("non-integer sequence fails", () => { const x = snapshot(); x.identity.sequence = 1.5; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid trigger fails", () => { const x = snapshot(); x.identity.trigger = "unknown" as never; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("identity and feature-reference versions must match", () => { const x = snapshot(); x.feature_reference.feature_version = "other"; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("empty feature hash fails", () => { const x = snapshot(); x.feature_reference.feature_hash = " "; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("negative feature count fails", () => { const x = snapshot(); x.feature_reference.feature_count = -1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid minute fails", () => { const x = snapshot(); x.match_context.minute = 121; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("negative score fails", () => { const x = snapshot(); x.match_context.home_score = -1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("score difference must equal actual score difference", () => { const x = snapshot(); x.match_context.score_diff = 1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("missing score requires null score difference", () => { const x = snapshot(); x.match_context.away_score = null; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("coverage has_minute must match minute presence", () => { const x = snapshot(); x.data_coverage.has_minute = false; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("reliable Odds require Odds availability", () => { const x = snapshot(); x.data_coverage.has_odds = false; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("unusable Odds require zero market weight", () => { const x = snapshot(); x.odds_intelligence_reference.usable_for_model = false; x.odds_intelligence_reference.assigned_market_weight = 0.1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("usable Odds require non-empty assessment ID", () => { const x = snapshot(); x.odds_intelligence_reference.assessment_id = ""; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("usable Odds require positive reliability", () => { const x = snapshot(); x.odds_intelligence_reference.reliability_score = 0; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("usable Odds require positive assigned market weight", () => { const x = snapshot(); x.odds_intelligence_reference.assigned_market_weight = 0; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid specialist role fails", () => { const x = snapshot(); x.specialist_contributions[0].model_role = "bad" as never; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("unavailable specialist requires zero weight", () => { const x = snapshot(); x.specialist_contributions[0].available = false; x.specialist_contributions[0].assigned_weight = 0.1; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("available specialist requires model version", () => { const x = snapshot(); x.specialist_contributions[0].model_version = " "; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("specialist weight must be bounded", () => { const x = snapshot(); x.specialist_contributions[0].assigned_weight = 2; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("available specialist weights must sum to one", () => { const x = snapshot(); x.specialist_contributions[0].assigned_weight = 0.5; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("final-outcome distribution must sum to one", () => { const x = snapshot(); x.model_output.final_outcome.home = 0.5; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("next-goal distribution must sum to one", () => { const x = snapshot(); x.model_output.next_goal.home = 0.5; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("goal horizons must be bounded", () => { const x = snapshot(); x.model_output.goal_horizon.next_15m = 2; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("goal horizons must be monotonic", () => { const x = snapshot(); x.model_output.goal_horizon.next_5m = 0.3; x.model_output.goal_horizon.next_10m = 0.2; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("current-result distribution must sum to one", () => { const x = snapshot(); x.model_output.current_result_survival.current_result_holds = 0.9; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("momentum distribution must sum to one", () => { const x = snapshot(); x.model_output.momentum_shift.neutral = 0.5; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("final-score distribution must sum to one", () => { const x = snapshot(); x.model_output.final_score.other_probability = 0.4; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("duplicate scoreline fails", () => { const x = snapshot(); x.model_output.final_score.outcomes.push({ home_score: 1, away_score: 0, probability: 0 }); assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid confidence level fails", () => { const x = snapshot(); x.confidence.level = "bad" as never; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("every confidence score must be bounded", () => { const x = snapshot(); x.confidence.score = 2; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("invalid risk reason fails", () => { const x = snapshot(); x.risk.reasons = ["bad"] as never; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("recursive forbidden model field fails", () => { const x = snapshot() as unknown as Record<string, unknown>; x.explanation = { nested: [{ model_weights: 1 }] }; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });
test("safety note must match the fixed value", () => { const x = snapshot(); x.safety_note = "other"; assert.throws(() => assertFinalPredictionSnapshotValid(x)); });

const completeLabels = (): PredictionSnapshotLabels => ({
  ...labels(), status: "complete", final_outcome: "home", next_goal_side: "none",
  goal_in_next_5m: false, goal_in_next_10m: false, goal_in_next_15m: false,
  final_home_score: 1, final_away_score: 0, current_result_survival: "held",
  momentum_shift: "home_strengthened", source_finalized_at: "2026-07-10T11:00:00Z",
});
test("valid pending label passes", () => assert.doesNotThrow(() => assertPredictionSnapshotLabelsValid(labels())));
test("pending label requires all targets null", () => { const x = labels(); x.final_outcome = "home"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("valid partial label passes", () => { const x = labels(); x.status = "partial"; x.final_outcome = "home"; assert.doesNotThrow(() => assertPredictionSnapshotLabelsValid(x)); });
test("partial label requires at least one target", () => { const x = labels(); x.status = "partial"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("partial label must not satisfy complete requirements", () => { const x = completeLabels(); x.status = "partial"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("valid complete label passes", () => assert.doesNotThrow(() => assertPredictionSnapshotLabelsValid(completeLabels())));
test("complete label requires every required target", () => { const x = completeLabels(); x.final_outcome = null; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("invalid status requires a limitation", () => { const x = labels(); x.status = "invalid"; x.limitations = []; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("goal-horizon values must be boolean or null", () => { const x = labels(); x.goal_in_next_5m = 1 as never; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("five-minute true implies ten-minute true", () => { const x = labels(); x.status = "partial"; x.goal_in_next_5m = true; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("ten-minute true implies fifteen-minute true", () => { const x = labels(); x.status = "partial"; x.goal_in_next_10m = true; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("invalid labeled timestamp fails", () => { const x = labels(); x.labeled_at = "bad"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("labeled_at less than as_of fails", () => { const x = labels(); x.labeled_at = "2026-07-09T00:00:00Z"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("source_finalized_at less than as_of fails", () => { const x = completeLabels(); x.source_finalized_at = "2026-07-09T00:00:00Z"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("source_finalized_at greater than labeled_at fails", () => { const x = completeLabels(); x.source_finalized_at = "2026-07-10T13:00:00Z"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("next_goal_side none requires finalized source", () => { const x = labels(); x.status = "partial"; x.next_goal_side = "none"; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("negative final score fails", () => { const x = completeLabels(); x.final_home_score = -1; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("invalid label enum fails", () => { const x = completeLabels(); x.momentum_shift = "bad" as never; assert.throws(() => assertPredictionSnapshotLabelsValid(x)); });
test("label builder returns a deep clone", () => { const input = completeLabels(); const copy = buildPredictionSnapshotLabels(input); assert.notStrictEqual(copy, input); assert.notStrictEqual(copy.limitations, input.limitations); });
test("label builder preserves target labels exactly", () => { const input = completeLabels(); assert.deepEqual(buildPredictionSnapshotLabels(input), { ...input, limitations: ["pending"] }); });
test("label builder deduplicates limitations", () => { const x = completeLabels(); x.limitations = ["a", "a"]; assert.deepEqual(buildPredictionSnapshotLabels(x).limitations, ["a"]); });

test("valid evaluation passes", () => assert.doesNotThrow(() => assertPredictionEvaluationRecordValid(evaluation())));
test("evaluation builder does not mutate input", () => { const input = evaluation(); const before = structuredClone(input); buildPredictionEvaluationRecord(input); assert.deepEqual(input, before); });
test("evaluation builder deduplicates segment keys", () => assert.deepEqual(buildPredictionEvaluationRecord(evaluation()).segment_keys, ["live"]));
test("evaluation builder deduplicates limitations", () => assert.deepEqual(buildPredictionEvaluationRecord(evaluation()).limitations, ["none"]));
test("invalid evaluation target fails", () => { const x = evaluation(); x.target = "bad" as never; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("empty model version fails", () => { const x = evaluation(); x.model_version = " "; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("invalid evaluation timestamp fails", () => { const x = evaluation(); x.evaluated_at = "bad"; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("non-boolean quality gate fails", () => { const x = evaluation(); x.passed_quality_gate = "yes" as never; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("null non-applicable metrics pass", () => { const x = evaluation(); x.metrics = Object.fromEntries(Object.keys(x.metrics).map((key) => [key, null])) as typeof x.metrics; assert.doesNotThrow(() => assertPredictionEvaluationRecordValid(x)); });
test("non-finite metric fails", () => { const x = evaluation(); x.metrics.accuracy = Infinity; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("negative log loss fails", () => { const x = evaluation(); x.metrics.multiclass_log_loss = -1; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("negative Brier score fails", () => { const x = evaluation(); x.metrics.binary_brier_score = -1; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("calibration error outside 0..1 fails", () => { const x = evaluation(); x.metrics.expected_calibration_error = 2; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("accuracy outside 0..1 fails", () => { const x = evaluation(); x.metrics.accuracy = 2; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("precision outside 0..1 fails", () => { const x = evaluation(); x.metrics.precision = -1; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("recall outside 0..1 fails", () => { const x = evaluation(); x.metrics.recall = 2; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("ROC-AUC outside 0..1 fails", () => { const x = evaluation(); x.metrics.roc_auc = 2; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
test("PR-AUC outside 0..1 fails", () => { const x = evaluation(); x.metrics.pr_auc = -1; assert.throws(() => assertPredictionEvaluationRecordValid(x)); });
