export type PredictionContractVersion = "prediction-domain-v1";
export type PredictionTargetId =
  | "final_outcome_1x2"
  | "next_goal_side"
  | "goal_in_next_5m"
  | "goal_in_next_10m"
  | "goal_in_next_15m"
  | "final_score_distribution"
  | "current_result_survival"
  | "momentum_shift";
export type PredictionSnapshotTrigger =
  | "timer"
  | "initial_state"
  | "score_change"
  | "goal"
  | "red_card"
  | "penalty"
  | "phase_change"
  | "odds_movement"
  | "momentum_shift"
  | "event_batch"
  | "replay"
  | "manual";
export type PredictionDataCoverage = {
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_minute: boolean;
  has_odds: boolean;
  has_reliable_odds: boolean;
  has_events: boolean;
  has_event_impact: boolean;
  has_pre_match_features: boolean;
  feature_coverage_score: number;
};
export type PredictionSnapshotIdentity = {
  snapshot_id: string;
  fixture_id: string;
  as_of: string;
  generated_at: string;
  sequence: number | null;
  trigger: PredictionSnapshotTrigger;
  feature_version: string;
  prediction_contract_version: PredictionContractVersion;
};
export type PredictionMatchContext = {
  phase: string | null;
  normalized_phase:
    | "pre_match"
    | "first_half"
    | "halftime"
    | "second_half"
    | "extra_time"
    | "finished"
    | "unknown";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  score_diff: number | null;
};
export type PredictionFeatureReference = {
  feature_version: string;
  feature_hash: string;
  feature_count: number;
};
export type FinalOutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};
export type NextGoalProbabilities = {
  home: number;
  none: number;
  away: number;
};
export type GoalHorizonProbabilities = {
  next_5m: number;
  next_10m: number;
  next_15m: number;
};
export type FinalScoreProbability = {
  home_score: number;
  away_score: number;
  probability: number;
};
export type FinalScoreDistribution = {
  outcomes: FinalScoreProbability[];
  other_probability: number;
};
export type CurrentResultSurvival = {
  current_result_holds: number;
  current_result_changes: number;
};
export type MomentumShiftProbabilities = {
  home_strengthens: number;
  neutral: number;
  away_strengthens: number;
};
export type SpecialistModelContribution = {
  model_role:
    | "pre_match_prior"
    | "live_state"
    | "market"
    | "event_sequence"
    | "goal_hazard"
    | "score_distribution"
    | "fallback";
  model_version: string;
  available: boolean;
  assigned_weight: number;
  output_quality: number;
  limitations: string[];
};
export type FinalPredictionConfidence = {
  level: "very_low" | "low" | "medium" | "high" | "very_high";
  score: number;
  calibration_score: number;
  model_agreement_score: number;
  data_coverage_score: number;
  freshness_score: number;
  out_of_distribution_score: number;
  reasons: string[];
};
export type FinalPredictionRisk = {
  level: "low" | "medium" | "high" | "critical";
  reasons: Array<
    | "stale_data"
    | "missing_minute"
    | "missing_events"
    | "missing_odds"
    | "unreliable_odds"
    | "single_provider"
    | "provider_disagreement"
    | "market_anomaly"
    | "model_disagreement"
    | "out_of_distribution"
    | "low_historical_support"
    | "partial_feature_coverage"
    | "inference_fallback"
  >;
};
export type FinalPredictionModelOutput = {
  final_outcome: FinalOutcomeProbabilities;
  next_goal: NextGoalProbabilities;
  goal_horizon: GoalHorizonProbabilities;
  final_score: FinalScoreDistribution;
  current_result_survival: CurrentResultSurvival;
  momentum_shift: MomentumShiftProbabilities;
};
export type FinalPredictionSnapshot = {
  identity: PredictionSnapshotIdentity;
  match_context: PredictionMatchContext;
  feature_reference: PredictionFeatureReference;
  data_coverage: PredictionDataCoverage;
  model_output: FinalPredictionModelOutput;
  confidence: FinalPredictionConfidence;
  risk: FinalPredictionRisk;
  specialist_contributions: SpecialistModelContribution[];
  odds_intelligence_reference: {
    odds_intelligence_version: string;
    assessment_id: string | null;
    usable_for_model: boolean;
    reliability_score: number;
    assigned_market_weight: number;
  };
  explanation: {
    summary: string;
    main_factors: string[];
    limitations: string[];
  };
  safety_note: string;
};
export type PredictionLabelStatus =
  "pending" | "partial" | "complete" | "invalid";
export type FinalOutcomeLabel = "home" | "draw" | "away";
export type NextGoalSideLabel = "home" | "none" | "away";
export type CurrentResultSurvivalLabel = "held" | "changed" | "not_applicable";
export type MomentumShiftLabel =
  "home_strengthened" | "neutral" | "away_strengthened" | "unavailable";
export type PredictionSnapshotLabels = {
  snapshot_id: string;
  fixture_id: string;
  as_of: string;
  labeled_at: string;
  status: PredictionLabelStatus;
  final_outcome: FinalOutcomeLabel | null;
  next_goal_side: NextGoalSideLabel | null;
  goal_in_next_5m: boolean | null;
  goal_in_next_10m: boolean | null;
  goal_in_next_15m: boolean | null;
  final_home_score: number | null;
  final_away_score: number | null;
  current_result_survival: CurrentResultSurvivalLabel | null;
  momentum_shift: MomentumShiftLabel | null;
  source_finalized_at: string | null;
  limitations: string[];
};
export type PredictionEvaluationMetrics = {
  multiclass_log_loss: number | null;
  multiclass_brier_score: number | null;
  expected_calibration_error: number | null;
  binary_log_loss: number | null;
  binary_brier_score: number | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  roc_auc: number | null;
  pr_auc: number | null;
  negative_log_likelihood: number | null;
};
export type PredictionEvaluationRecord = {
  evaluation_id: string;
  snapshot_id: string;
  fixture_id: string;
  target: PredictionTargetId;
  model_version: string;
  feature_version: string;
  label_version: string;
  evaluated_at: string;
  segment_keys: string[];
  metrics: PredictionEvaluationMetrics;
  passed_quality_gate: boolean;
  limitations: string[];
};

export const FINAL_PREDICTION_SAFETY_NOTE =
  "MatchPulse predictions are informational sports analytics only. They are not betting recommendations, wagering instructions, or financial advice.";
const FORBIDDEN = new Set([
  "recommended_bet",
  "bet",
  "wager",
  "stake",
  "payout",
  "profit",
  "expected_value",
  "ev",
  "edge",
  "wallet",
  "deposit",
  "token",
  "secret",
  "api_key",
  "stack",
  "raw",
  "raw_payload",
  "provider_payload",
  "source_payload",
  "debug",
  "debug_lineage",
  "formula",
  "model_weights",
  "model_coefficients",
  "private_provider_weights",
  "anomaly_thresholds",
]);
const PUBLIC_FORBIDDEN = new Set([
  "recommended_model_weight",
  "assigned_weight",
  "fair_probability",
  "consensus_probability",
  "provider_quality",
  "component_scores",
  "odds_intelligence_reference",
  "specialist_contributions",
  "feature_reference",
]);
const TARGETS = new Set<PredictionTargetId>([
  "final_outcome_1x2",
  "next_goal_side",
  "goal_in_next_5m",
  "goal_in_next_10m",
  "goal_in_next_15m",
  "final_score_distribution",
  "current_result_survival",
  "momentum_shift",
]);
const ROLES = new Set([
  "pre_match_prior",
  "live_state",
  "market",
  "event_sequence",
  "goal_hazard",
  "score_distribution",
  "fallback",
]);
const RISK_REASONS = new Set([
  "stale_data",
  "missing_minute",
  "missing_events",
  "missing_odds",
  "unreliable_odds",
  "single_provider",
  "provider_disagreement",
  "market_anomaly",
  "model_disagreement",
  "out_of_distribution",
  "low_historical_support",
  "partial_feature_coverage",
  "inference_fallback",
]);
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const bounded = (x: unknown): x is number => finite(x) && x >= 0 && x <= 1;
const integer = (x: unknown): x is number =>
  typeof x === "number" && Number.isInteger(x);
const iso = (x: unknown): x is string =>
  typeof x === "string" && x.trim() !== "" && Number.isFinite(Date.parse(x));
function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError(`${name} must be non-empty.`);
}
function strings(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
    throw new TypeError(`${name} must contain strings.`);
}
function scanForbidden(
  value: unknown,
  publicOnly = false,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN.has(lower) || (publicOnly && PUBLIC_FORBIDDEN.has(lower)))
      throw new Error(`Forbidden structured field: ${key}`);
    scanForbidden(child, publicOnly, seen);
  }
}
function assertDistribution(
  value: unknown,
  keys: string[],
  name: string,
): void {
  const record = object(value, name);
  let total = 0;
  for (const key of keys) {
    if (!bounded(record[key]))
      throw new RangeError(`${name}.${key} must be in 0..1.`);
    total += record[key] as number;
  }
  if (Math.abs(total - 1) > 1e-6)
    throw new RangeError(`${name} must sum to 1.`);
}
function assertSnapshotIdentity(p: FinalPredictionSnapshot): void {
  const i = p.identity;
  if (
    i.prediction_contract_version !== "prediction-domain-v1" ||
    !iso(i.as_of) ||
    !iso(i.generated_at) ||
    Date.parse(i.generated_at) < Date.parse(i.as_of)
  )
    throw new Error("Invalid snapshot identity or timestamps.");
  requiredText(i.snapshot_id, "identity.snapshot_id");
  requiredText(i.fixture_id, "identity.fixture_id");
  requiredText(i.feature_version, "identity.feature_version");
  if (
    (!integer(i.sequence) && i.sequence !== null) ||
    (integer(i.sequence) && (i.sequence as number) < 0)
  )
    throw new Error("Invalid sequence.");
  if (
    ![
      "timer",
      "initial_state",
      "score_change",
      "goal",
      "red_card",
      "penalty",
      "phase_change",
      "odds_movement",
      "momentum_shift",
      "event_batch",
      "replay",
      "manual",
    ].includes(i.trigger)
  )
    throw new Error("Invalid trigger.");
}
function assertSnapshotCoverage(p: FinalPredictionSnapshot): void {
  const c = p.match_context;
  if (
    (c.phase !== null && typeof c.phase !== "string") ||
    ![
      "pre_match",
      "first_half",
      "halftime",
      "second_half",
      "extra_time",
      "finished",
      "unknown",
    ].includes(c.normalized_phase)
  )
    throw new Error("Invalid match phase.");
  if (
    c.minute !== null &&
    (!integer(c.minute) || c.minute < 0 || c.minute > 120)
  )
    throw new Error("Invalid minute.");
  for (const key of ["home_score", "away_score"] as const)
    if (c[key] !== null && (!integer(c[key]) || c[key] < 0))
      throw new Error(`Invalid ${key}.`);
  if (
    c.home_score !== null && c.away_score !== null
      ? c.score_diff !== c.home_score - c.away_score
      : c.score_diff !== null
  )
    throw new Error("Inconsistent score difference.");
  const f = p.feature_reference;
  requiredText(f.feature_version, "feature_reference.feature_version");
  requiredText(f.feature_hash, "feature_reference.feature_hash");
  if (
    f.feature_version !== p.identity.feature_version ||
    !integer(f.feature_count) ||
    f.feature_count < 0
  )
    throw new Error("Inconsistent feature reference.");
  const d = p.data_coverage;
  for (const key of [
    "has_fixture",
    "has_scoreboard",
    "has_minute",
    "has_odds",
    "has_reliable_odds",
    "has_events",
    "has_event_impact",
    "has_pre_match_features",
  ] as const)
    if (typeof d[key] !== "boolean") throw new Error(`Invalid ${key}.`);
  if (
    d.has_minute !== (c.minute !== null) ||
    (d.has_reliable_odds && !d.has_odds) ||
    !bounded(d.feature_coverage_score)
  )
    throw new Error("Inconsistent data coverage.");
  const o = p.odds_intelligence_reference;
  requiredText(o.odds_intelligence_version, "odds_intelligence_version");
  if (
    typeof o.usable_for_model !== "boolean" ||
    !bounded(o.reliability_score) ||
    !bounded(o.assigned_market_weight)
  )
    throw new Error("Invalid odds reference.");
  if (
    o.assessment_id !== null &&
    (typeof o.assessment_id !== "string" || o.assessment_id.trim() === "")
  )
    throw new Error("Invalid assessment_id.");
  if (
    (!o.usable_for_model && o.assigned_market_weight !== 0) ||
    (o.usable_for_model &&
      (o.assessment_id === null ||
        o.reliability_score <= 0 ||
        o.assigned_market_weight <= 0 ||
        !d.has_odds ||
        !d.has_reliable_odds))
  )
    throw new Error("Inconsistent odds coverage.");
}
function assertSnapshotModels(p: FinalPredictionSnapshot): void {
  if (!Array.isArray(p.specialist_contributions))
    throw new TypeError("specialist_contributions must be an array.");
  let weight = 0;
  let available = 0;
  for (const specialist of p.specialist_contributions) {
    const s = object(specialist, "specialist contribution");
    if (
      !ROLES.has(s.model_role as string) ||
      typeof s.available !== "boolean" ||
      !bounded(s.assigned_weight) ||
      !bounded(s.output_quality)
    )
      throw new Error("Invalid specialist contribution.");
    strings(s.limitations, "specialist limitations");
    const isAvailable = s.available as boolean;
    if (!isAvailable && s.assigned_weight !== 0)
      throw new Error("Unavailable specialists must have zero weight.");
    if (isAvailable) {
      requiredText(s.model_version, "model_version");
      weight += s.assigned_weight as number;
      available++;
    }
  }
  if (available > 0 && Math.abs(weight - 1) > 1e-6)
    throw new Error("Available specialist weights must sum to one.");
}
function assertSnapshotOutput(p: FinalPredictionSnapshot): void {
  const m = p.model_output;
  assertDistribution(
    m.final_outcome,
    ["home", "draw", "away"],
    "final_outcome",
  );
  assertDistribution(m.next_goal, ["home", "none", "away"], "next_goal");
  const h = object(m.goal_horizon, "goal_horizon");
  if (
    !bounded(h.next_5m) ||
    !bounded(h.next_10m) ||
    !bounded(h.next_15m) ||
    (h.next_5m as number) > (h.next_10m as number) ||
    (h.next_10m as number) > (h.next_15m as number)
  )
    throw new RangeError("Goal horizons must be monotonic and bounded.");
  assertDistribution(
    m.current_result_survival,
    ["current_result_holds", "current_result_changes"],
    "current_result_survival",
  );
  assertDistribution(
    m.momentum_shift,
    ["home_strengthens", "neutral", "away_strengthens"],
    "momentum_shift",
  );
  const score = object(m.final_score, "final_score");
  if (!bounded(score.other_probability))
    throw new RangeError("Invalid other_probability.");
  const seen = new Set<string>();
  let total = score.other_probability as number;
  for (const outcome of score.outcomes as unknown[]) {
    const o = object(outcome, "score outcome");
    if (
      !integer(o.home_score) ||
      !integer(o.away_score) ||
      (o.home_score as number) < 0 ||
      (o.away_score as number) < 0 ||
      !bounded(o.probability)
    )
      throw new RangeError("Invalid score outcome.");
    const key = `${o.home_score}:${o.away_score}`;
    if (seen.has(key)) throw new Error("Duplicate scoreline.");
    seen.add(key);
    total += o.probability as number;
  }
  if (Math.abs(total - 1) > 1e-6)
    throw new RangeError("Score distribution must sum to 1.");
  const confidence = p.confidence;
  if (
    !["very_low", "low", "medium", "high", "very_high"].includes(
      confidence.level,
    ) ||
    ![
      confidence.score,
      confidence.calibration_score,
      confidence.model_agreement_score,
      confidence.data_coverage_score,
      confidence.freshness_score,
      confidence.out_of_distribution_score,
    ].every(bounded)
  )
    throw new Error("Invalid confidence.");
  strings(confidence.reasons, "confidence.reasons");
  if (!["low", "medium", "high", "critical"].includes(p.risk.level))
    throw new Error("Invalid risk level.");
  strings(p.risk.reasons, "risk.reasons");
  if (!p.risk.reasons.every((reason) => RISK_REASONS.has(reason)))
    throw new Error("Invalid risk reason.");
  requiredText(p.explanation.summary, "explanation.summary");
  strings(p.explanation.main_factors, "main_factors");
  strings(p.explanation.limitations, "explanation.limitations");
  if (p.safety_note !== FINAL_PREDICTION_SAFETY_NOTE)
    throw new Error("Invalid safety note.");
}
export function assertFinalPredictionSnapshotValid(payload: unknown): void {
  const p = object(
    payload,
    "Final prediction snapshot",
  ) as unknown as FinalPredictionSnapshot;
  scanForbidden(p);
  assertSnapshotIdentity(p);
  assertSnapshotCoverage(p);
  assertSnapshotOutput(p);
  assertSnapshotModels(p);
}
export function buildFinalPredictionSnapshot(
  input: FinalPredictionSnapshot,
): FinalPredictionSnapshot {
  const copy = structuredClone(input);
  copy.confidence.reasons = [...new Set(copy.confidence.reasons)];
  copy.risk.reasons = [...new Set(copy.risk.reasons)];
  copy.explanation.main_factors = [...new Set(copy.explanation.main_factors)];
  copy.explanation.limitations = [...new Set(copy.explanation.limitations)];
  copy.specialist_contributions = copy.specialist_contributions.map((s) => ({
    ...s,
    limitations: [...new Set(s.limitations)],
  }));
  assertFinalPredictionSnapshotValid(copy);
  return copy;
}
function allComplete(p: PredictionSnapshotLabels): boolean {
  return (
    p.final_outcome !== null &&
    p.next_goal_side !== null &&
    p.goal_in_next_5m !== null &&
    p.goal_in_next_10m !== null &&
    p.goal_in_next_15m !== null &&
    p.final_home_score !== null &&
    p.final_away_score !== null &&
    p.current_result_survival !== null &&
    p.momentum_shift !== null &&
    p.source_finalized_at !== null
  );
}
export function assertPredictionSnapshotLabelsValid(payload: unknown): void {
  const p = object(
    payload,
    "Prediction labels",
  ) as unknown as PredictionSnapshotLabels;
  requiredText(p.snapshot_id, "snapshot_id");
  requiredText(p.fixture_id, "fixture_id");
  if (
    !iso(p.as_of) ||
    !iso(p.labeled_at) ||
    Date.parse(p.labeled_at) < Date.parse(p.as_of)
  )
    throw new Error("Invalid label timestamps.");
  if (!["pending", "partial", "complete", "invalid"].includes(p.status))
    throw new Error("Invalid label status.");
  for (const key of [
    "goal_in_next_5m",
    "goal_in_next_10m",
    "goal_in_next_15m",
  ] as const)
    if (p[key] !== null && typeof p[key] !== "boolean")
      throw new Error(`Invalid ${key}.`);
  if (
    (p.goal_in_next_5m === true &&
      (p.goal_in_next_10m !== true || p.goal_in_next_15m !== true)) ||
    (p.goal_in_next_10m === true && p.goal_in_next_15m !== true)
  )
    throw new Error("Goal horizon labels must be monotonic.");
  for (const key of ["final_home_score", "final_away_score"] as const)
    if (p[key] !== null && (!integer(p[key]) || p[key] < 0))
      throw new Error(`Invalid ${key}.`);
  if (
    p.source_finalized_at !== null &&
    (!iso(p.source_finalized_at) ||
      Date.parse(p.source_finalized_at) < Date.parse(p.as_of) ||
      Date.parse(p.source_finalized_at) > Date.parse(p.labeled_at))
  )
    throw new Error("Invalid source_finalized_at ordering.");
  if (
    p.next_goal_side !== null &&
    !["home", "none", "away"].includes(p.next_goal_side)
  )
    throw new Error("Invalid next goal label.");
  if (
    p.final_outcome !== null &&
    !["home", "draw", "away"].includes(p.final_outcome)
  )
    throw new Error("Invalid final outcome label.");
  if (
    p.current_result_survival !== null &&
    !["held", "changed", "not_applicable"].includes(p.current_result_survival)
  )
    throw new Error("Invalid survival label.");
  if (
    p.momentum_shift !== null &&
    ![
      "home_strengthened",
      "neutral",
      "away_strengthened",
      "unavailable",
    ].includes(p.momentum_shift)
  )
    throw new Error("Invalid momentum label.");
  strings(p.limitations, "limitations");
  if (
    p.status === "pending" &&
    (p.final_outcome !== null ||
      p.next_goal_side !== null ||
      p.goal_in_next_5m !== null ||
      p.goal_in_next_10m !== null ||
      p.goal_in_next_15m !== null ||
      p.final_home_score !== null ||
      p.final_away_score !== null ||
      p.current_result_survival !== null ||
      p.momentum_shift !== null ||
      p.source_finalized_at !== null)
  )
    throw new Error("Pending labels must be unresolved.");
  if (
    p.status === "partial" &&
    (allComplete(p) ||
      [
        p.final_outcome,
        p.next_goal_side,
        p.goal_in_next_5m,
        p.goal_in_next_10m,
        p.goal_in_next_15m,
        p.final_home_score,
        p.final_away_score,
        p.current_result_survival,
        p.momentum_shift,
      ].every((v) => v === null))
  )
    throw new Error("Partial labels must be partially resolved.");
  if (p.status === "complete" && !allComplete(p))
    throw new Error("Complete labels require all targets.");
  if (
    p.status === "invalid" &&
    !p.limitations.some((value) => value.trim() !== "")
  )
    throw new Error("Invalid labels require a limitation.");
  if (p.next_goal_side === "none" && p.source_finalized_at === null)
    throw new Error("Resolved no-goal label requires finalization.");
  scanForbidden(p);
}
export function buildPredictionSnapshotLabels(
  input: PredictionSnapshotLabels,
): PredictionSnapshotLabels {
  const copy = structuredClone(input);
  copy.limitations = [...new Set(copy.limitations)];
  assertPredictionSnapshotLabelsValid(copy);
  return copy;
}
const NON_NEGATIVE_METRICS = new Set([
  "multiclass_log_loss",
  "multiclass_brier_score",
  "binary_log_loss",
  "binary_brier_score",
  "negative_log_likelihood",
]);
const UNIT_METRICS = new Set([
  "expected_calibration_error",
  "accuracy",
  "precision",
  "recall",
  "roc_auc",
  "pr_auc",
]);
export function assertPredictionEvaluationRecordValid(payload: unknown): void {
  const p = object(
    payload,
    "Prediction evaluation record",
  ) as unknown as PredictionEvaluationRecord;
  for (const key of [
    "evaluation_id",
    "snapshot_id",
    "fixture_id",
    "model_version",
    "feature_version",
    "label_version",
  ] as const)
    requiredText(p[key], key);
  if (
    !TARGETS.has(p.target) ||
    !iso(p.evaluated_at) ||
    typeof p.passed_quality_gate !== "boolean"
  )
    throw new Error("Invalid evaluation identity.");
  strings(p.segment_keys, "segment_keys");
  strings(p.limitations, "limitations");
  object(p.metrics, "metrics");
  for (const [key, value] of Object.entries(p.metrics)) {
    if (value !== null && !finite(value))
      throw new TypeError(`Metric ${key} must be finite or null.`);
    if (
      (value !== null && NON_NEGATIVE_METRICS.has(key) && value < 0) ||
      (value !== null && UNIT_METRICS.has(key) && (value < 0 || value > 1))
    )
      throw new RangeError(`Metric ${key} is out of bounds.`);
  }
}
export function buildPredictionEvaluationRecord(
  input: PredictionEvaluationRecord,
): PredictionEvaluationRecord {
  const copy = structuredClone(input);
  copy.segment_keys = [...new Set(copy.segment_keys)];
  copy.limitations = [...new Set(copy.limitations)];
  assertPredictionEvaluationRecordValid(copy);
  return copy;
}
