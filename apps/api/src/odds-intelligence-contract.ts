export type OddsIntelligenceVersion = "odds-intelligence-v1";
export type NormalizedOddsMarketType =
  | "match_result_1x2"
  | "double_chance"
  | "total_goals"
  | "both_teams_to_score"
  | "asian_handicap"
  | "next_goal"
  | "correct_score"
  | "unknown";
export type NormalizedOddsSelectionType =
  | "home"
  | "draw"
  | "away"
  | "none"
  | "yes"
  | "no"
  | "over"
  | "under"
  | "other"
  | "unknown";
export type OddsValidationIssue =
  | "fixture_mismatch"
  | "invalid_odds_value"
  | "invalid_timestamp"
  | "unknown_market"
  | "unknown_selection"
  | "duplicate_snapshot"
  | "out_of_order_snapshot"
  | "market_incomplete"
  | "selection_missing"
  | "stale_snapshot"
  | "single_provider"
  | "provider_disagreement"
  | "provider_outlier"
  | "abnormal_jump"
  | "event_inconsistency"
  | "insufficient_history";
export type OddsReliabilityLevel =
  | "unavailable"
  | "invalid"
  | "unreliable"
  | "limited"
  | "reliable"
  | "high_confidence";
export type OddsComponentScores = {
  structural_validity: number;
  freshness: number;
  market_completeness: number;
  provider_quality: number;
  provider_consensus: number;
  dispersion_quality: number;
  movement_integrity: number;
  event_consistency: number;
  historical_support: number;
  overall_reliability: number;
};
export type OddsFairProbabilitySelection = {
  selection: NormalizedOddsSelectionType;
  line: number | null;
  fair_probability: number;
  consensus_probability: number;
  probability_change_1m: number | null;
  probability_change_5m: number | null;
  movement_velocity: number | null;
  movement_acceleration: number | null;
};
export type OddsMarketIntelligence = {
  market_key: string;
  market_type: NormalizedOddsMarketType;
  line: number | null;
  complete: boolean;
  usable: boolean;
  selection_count: number;
  provider_count: number;
  snapshot_count: number;
  overround: number | null;
  provider_dispersion: number | null;
  volatility_score: number;
  selections: OddsFairProbabilitySelection[];
  component_scores: OddsComponentScores;
  reliability_level: OddsReliabilityLevel;
  reliability_score: number;
  recommended_model_weight: number;
  issues: OddsValidationIssue[];
  limitations: string[];
  latest_timestamp: string | null;
};
export type InternalOddsIntelligenceContext = {
  odds_intelligence_version: OddsIntelligenceVersion;
  assessment_id: string;
  fixture_id: string;
  generated_at: string;
  status: OddsReliabilityLevel;
  usable_for_model: boolean;
  overall_reliability_score: number;
  recommended_market_model_weight: number;
  market_count: number;
  usable_market_count: number;
  provider_count: number;
  snapshot_count: number;
  consensus_score: number;
  freshness_score: number;
  volatility_score: number;
  anomaly_score: number;
  primary_match_result_market: OddsMarketIntelligence | null;
  markets: OddsMarketIntelligence[];
  issues: OddsValidationIssue[];
  limitations: string[];
};
export type PublicMarketReliabilityLevel =
  "unavailable" | "low" | "limited" | "good" | "strong";
export type PublicMarketMovement = {
  market_label: string;
  selection_label: string;
  direction: "up" | "down" | "stable" | "volatile" | "unknown";
  strength: "low" | "medium" | "high";
  summary: string;
};
export type PublicMarketIntelligence = {
  market_intelligence_version: "public-market-intelligence-v1";
  fixture_id: string;
  generated_at: string;
  availability: "available" | "limited" | "unavailable";
  reliability: PublicMarketReliabilityLevel;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  provider_coverage: "none" | "single" | "limited" | "broad";
  provider_agreement: "unknown" | "weak" | "mixed" | "strong";
  volatility: "none" | "low" | "medium" | "high";
  market_count: number;
  usable_market_count: number;
  provider_count: number;
  notable_movements: PublicMarketMovement[];
  summary: string;
  limitations: string[];
  last_update: string | null;
  safety_note: string;
};
export const PUBLIC_MARKET_SAFETY_NOTE =
  "Market intelligence describes the quality and movement of available odds data. It is not a betting recommendation or wagering instruction.";
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
  "raw_odds_rows",
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
const COMPONENT_KEYS = [
  "structural_validity",
  "freshness",
  "market_completeness",
  "provider_quality",
  "provider_consensus",
  "dispersion_quality",
  "movement_integrity",
  "event_consistency",
  "historical_support",
  "overall_reliability",
] as const;
const MARKET_TYPES = new Set([
  "match_result_1x2",
  "double_chance",
  "total_goals",
  "both_teams_to_score",
  "asian_handicap",
  "next_goal",
  "correct_score",
  "unknown",
]);
const SELECTIONS = new Set([
  "home",
  "draw",
  "away",
  "none",
  "yes",
  "no",
  "over",
  "under",
  "other",
  "unknown",
]);
const LEVELS = new Set([
  "unavailable",
  "invalid",
  "unreliable",
  "limited",
  "reliable",
  "high_confidence",
]);
const ISSUES = new Set([
  "fixture_mismatch",
  "invalid_odds_value",
  "invalid_timestamp",
  "unknown_market",
  "unknown_selection",
  "duplicate_snapshot",
  "out_of_order_snapshot",
  "market_incomplete",
  "selection_missing",
  "stale_snapshot",
  "single_provider",
  "provider_disagreement",
  "provider_outlier",
  "abnormal_jump",
  "event_inconsistency",
  "insufficient_history",
]);
const iso = (x: unknown): x is string =>
  typeof x === "string" && x.trim() !== "" && Number.isFinite(Date.parse(x));
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const bounded = (x: unknown): x is number => finite(x) && x >= 0 && x <= 1;
function object(x: unknown, n: string): Record<string, unknown> {
  if (x === null || typeof x !== "object" || Array.isArray(x))
    throw new TypeError(`${n} must be an object.`);
  return x as Record<string, unknown>;
}
function text(x: unknown, n: string): asserts x is string {
  if (typeof x !== "string" || x.trim() === "")
    throw new TypeError(`${n} must be non-empty.`);
}
function strings(x: unknown, n: string): asserts x is string[] {
  if (!Array.isArray(x) || !x.every((v) => typeof v === "string"))
    throw new TypeError(`${n} must contain strings.`);
}
function scan(
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
    scan(child, publicOnly, seen);
  }
}
function validateMarket(m: OddsMarketIntelligence, generatedAt: string): void {
  text(m.market_key, "market_key");
  if (
    !MARKET_TYPES.has(m.market_type) ||
    !LEVELS.has(m.reliability_level) ||
    typeof m.complete !== "boolean" ||
    typeof m.usable !== "boolean"
  )
    throw new Error("Invalid market enum/status.");
  if (m.line !== null && !finite(m.line))
    throw new Error("Invalid market line.");
  for (const key of [
    "selection_count",
    "provider_count",
    "snapshot_count",
  ] as const)
    if (!Number.isInteger(m[key]) || m[key] < 0)
      throw new RangeError(`Invalid ${key}.`);
  if (
    m.selection_count !== m.selections.length ||
    !bounded(m.volatility_score) ||
    !bounded(m.reliability_score) ||
    !bounded(m.recommended_model_weight)
  )
    throw new Error("Inconsistent market counts or scores.");
  if (
    (m.overround !== null && !finite(m.overround)) ||
    (m.provider_dispersion !== null &&
      (!finite(m.provider_dispersion) || m.provider_dispersion < 0))
  )
    throw new Error("Invalid market dispersion.");
  if (
    m.latest_timestamp !== null &&
    (!iso(m.latest_timestamp) ||
      Date.parse(m.latest_timestamp) > Date.parse(generatedAt))
  )
    throw new Error("Future market timestamp.");
  const component = object(m.component_scores, "component_scores");
  const actual = Object.keys(component).sort();
  if (
    actual.length !== COMPONENT_KEYS.length ||
    actual.some((key, index) => key !== [...COMPONENT_KEYS].sort()[index])
  )
    throw new Error("Component scores must contain exactly the declared keys.");
  for (const key of COMPONENT_KEYS)
    if (!bounded(component[key]))
      throw new Error(`Invalid component score: ${key}.`);
  if (
    Math.abs((component.overall_reliability as number) - m.reliability_score) >
    1e-6
  )
    throw new Error("Reliability score mismatch.");
  const seen = new Set<string>();
  for (const selection of m.selections) {
    if (
      !SELECTIONS.has(selection.selection) ||
      (selection.line !== null && !finite(selection.line)) ||
      !bounded(selection.fair_probability) ||
      !bounded(selection.consensus_probability)
    )
      throw new Error("Invalid market selection.");
    for (const key of [
      "probability_change_1m",
      "probability_change_5m",
      "movement_velocity",
      "movement_acceleration",
    ] as const)
      if (selection[key] !== null && !finite(selection[key]))
        throw new Error(`Invalid ${key}.`);
    const key = `${selection.selection}:${selection.line}`;
    if (seen.has(key)) throw new Error("Duplicate selection and line.");
    seen.add(key);
  }
  if (m.complete) {
    const fair = m.selections.reduce((sum, s) => sum + s.fair_probability, 0);
    const consensus = m.selections.reduce(
      (sum, s) => sum + s.consensus_probability,
      0,
    );
    if (Math.abs(fair - 1) > 1e-6 || Math.abs(consensus - 1) > 1e-6)
      throw new Error("Complete market probabilities must sum to one.");
  }
  if (
    m.usable &&
    (!m.complete ||
      m.recommended_model_weight <= 0 ||
      !["limited", "reliable", "high_confidence"].includes(m.reliability_level))
  )
    throw new Error("Usable market is inconsistent.");
  if (!m.usable && m.recommended_model_weight !== 0)
    throw new Error("Unusable market must have zero weight.");
  if (!m.issues.every((issue) => ISSUES.has(issue)))
    throw new Error("Invalid odds issue.");
  strings(m.issues, "market issues");
  strings(m.limitations, "market limitations");
}
export function assertInternalOddsIntelligenceValid(payload: unknown): void {
  const p = object(
    payload,
    "Internal odds intelligence",
  ) as unknown as InternalOddsIntelligenceContext;
  if (p.odds_intelligence_version !== "odds-intelligence-v1")
    throw new Error("Invalid odds intelligence version.");
  text(p.assessment_id, "assessment_id");
  text(p.fixture_id, "fixture_id");
  if (
    !iso(p.generated_at) ||
    !LEVELS.has(p.status) ||
    typeof p.usable_for_model !== "boolean"
  )
    throw new Error("Invalid internal identity/status.");
  for (const key of [
    "overall_reliability_score",
    "recommended_market_model_weight",
    "consensus_score",
    "freshness_score",
    "volatility_score",
    "anomaly_score",
  ] as const)
    if (!bounded(p[key])) throw new RangeError(`Invalid ${key}.`);
  for (const key of [
    "market_count",
    "usable_market_count",
    "provider_count",
    "snapshot_count",
  ] as const)
    if (!Number.isInteger(p[key]) || p[key] < 0)
      throw new RangeError(`Invalid ${key}.`);
  if (
    p.market_count !== p.markets.length ||
    p.usable_market_count !== p.markets.filter((m) => m.usable).length ||
    p.usable_market_count > p.market_count ||
    p.markets.some(
      (m) =>
        m.provider_count > p.provider_count ||
        m.snapshot_count > p.snapshot_count,
    )
  )
    throw new Error("Inconsistent market/context counts.");
  if (p.markets.length === 0 && !["unavailable", "invalid"].includes(p.status))
    throw new Error("Empty markets require unavailable or invalid status.");
  if (
    p.usable_for_model &&
    (!["limited", "reliable", "high_confidence"].includes(p.status) ||
      p.usable_market_count === 0 ||
      p.recommended_market_model_weight <= 0 ||
      p.overall_reliability_score <= 0)
  )
    throw new Error("Usable root context is inconsistent.");
  if (!p.usable_for_model && p.recommended_market_model_weight !== 0)
    throw new Error("Unusable root context must have zero weight.");
  strings(p.issues, "issues");
  if (!p.issues.every((issue) => ISSUES.has(issue)))
    throw new Error("Invalid odds issue.");
  strings(p.limitations, "limitations");
  const keys = new Set<string>();
  for (const market of p.markets) {
    validateMarket(market, p.generated_at);
    if (keys.has(market.market_key)) throw new Error("Duplicate market key.");
    keys.add(market.market_key);
  }
  if (p.primary_match_result_market !== null) {
    validateMarket(p.primary_match_result_market, p.generated_at);
    if (
      p.primary_match_result_market.market_type !== "match_result_1x2" ||
      !keys.has(p.primary_match_result_market.market_key) ||
      p.markets.find(
        (m) => m.market_key === p.primary_match_result_market!.market_key,
      )!.market_type !== "match_result_1x2"
    )
      throw new Error("Invalid primary match-result market.");
  }
  scan(p);
}
export function buildInternalOddsIntelligenceContext(
  input: InternalOddsIntelligenceContext,
): InternalOddsIntelligenceContext {
  const copy = structuredClone(input);
  copy.issues = [...new Set(copy.issues)];
  copy.limitations = [...new Set(copy.limitations)];
  copy.markets = copy.markets.map((m) => ({
    ...m,
    issues: [...new Set(m.issues)],
    limitations: [...new Set(m.limitations)],
    selections: m.selections.map((s) => ({ ...s })),
  }));
  if (copy.primary_match_result_market)
    copy.primary_match_result_market = {
      ...copy.primary_match_result_market,
      issues: [...new Set(copy.primary_match_result_market.issues)],
      limitations: [...new Set(copy.primary_match_result_market.limitations)],
      selections: copy.primary_match_result_market.selections.map((s) => ({
        ...s,
      })),
    };
  assertInternalOddsIntelligenceValid(copy);
  return copy;
}
export function assertPublicMarketIntelligenceSafe(payload: unknown): void {
  const p = object(
    payload,
    "Public market intelligence",
  ) as unknown as PublicMarketIntelligence;
  if (p.market_intelligence_version !== "public-market-intelligence-v1")
    throw new Error("Invalid public version.");
  text(p.fixture_id, "fixture_id");
  if (
    !iso(p.generated_at) ||
    (p.last_update !== null &&
      (!iso(p.last_update) ||
        Date.parse(p.last_update) > Date.parse(p.generated_at)))
  )
    throw new Error("Invalid public timestamp.");
  if (
    !["available", "limited", "unavailable"].includes(p.availability) ||
    !["unavailable", "low", "limited", "good", "strong"].includes(
      p.reliability,
    ) ||
    !["fresh", "aging", "stale", "unknown"].includes(p.freshness) ||
    !["none", "single", "limited", "broad"].includes(p.provider_coverage) ||
    !["unknown", "weak", "mixed", "strong"].includes(p.provider_agreement) ||
    !["none", "low", "medium", "high"].includes(p.volatility) ||
    !Number.isInteger(p.market_count) ||
    !Number.isInteger(p.usable_market_count) ||
    !Number.isInteger(p.provider_count) ||
    p.market_count < 0 ||
    p.usable_market_count < 0 ||
    p.provider_count < 0 ||
    p.usable_market_count > p.market_count
  )
    throw new Error("Invalid public enums or counts.");
  if (
    (p.availability === "unavailable" && p.usable_market_count !== 0) ||
    (p.provider_count === 0 && p.provider_coverage !== "none") ||
    (p.provider_count === 1 && p.provider_coverage !== "single")
  )
    throw new Error("Inconsistent public availability/provider coverage.");
  if (!Array.isArray(p.notable_movements))
    throw new TypeError("notable_movements must be an array.");
  for (const movement of p.notable_movements) {
    text(movement.market_label, "market_label");
    text(movement.selection_label, "selection_label");
    if (
      !["up", "down", "stable", "volatile", "unknown"].includes(
        movement.direction,
      ) ||
      !["low", "medium", "high"].includes(movement.strength)
    )
      throw new Error("Invalid movement enum.");
    text(movement.summary, "movement summary");
  }
  text(p.summary, "summary");
  strings(p.limitations, "limitations");
  if (p.safety_note !== PUBLIC_MARKET_SAFETY_NOTE)
    throw new Error("Invalid public safety note.");
  scan(p, true);
}
export function buildPublicMarketIntelligence(
  input: PublicMarketIntelligence,
): PublicMarketIntelligence {
  const copy = structuredClone(input);
  copy.limitations = [...new Set(copy.limitations)];
  const seen = new Set<string>();
  copy.notable_movements = copy.notable_movements.filter((m) => {
    const key = `${m.market_label}\u0000${m.selection_label}\u0000${m.direction}\u0000${m.strength}\u0000${m.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  assertPublicMarketIntelligenceSafe(copy);
  return copy;
}
