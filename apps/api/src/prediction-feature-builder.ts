import type { InternalIntelligenceContext } from "./internal-intelligence-context.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import type { LivePredictionInputSummary } from "./live-prediction-agent.js";

export type PredictionFeatureVersion = "prediction-features-v1";
export type PredictionPhase =
  | "pre_match" | "first_half" | "halftime" | "second_half"
  | "extra_time" | "finished" | "unknown";

export type PredictionFeatureVectorV1 = {
  phase_progress: number; phase_known: 0 | 1;
  minute_progress: number; minute_known: 0 | 1;
  score_known: 0 | 1; home_score_norm: number; away_score_norm: number;
  score_diff_norm: number; total_goals_norm: number; scoreboard_available: 0 | 1;
  odds_available: 0 | 1; odds_count_norm: number; market_count_norm: number;
  provider_count_norm: number; odds_up_share: number; odds_down_share: number;
  odds_stable_share: number; odds_unknown_direction_share: number;
  odds_movement_share: number; market_reliability_score: number;
  event_pressure_score: number; event_impact_score: number; event_count_norm: number;
  key_event_count_norm: number; freshness_known: 0 | 1; freshness_score: number;
  data_age_norm: number; data_quality_score: number; coverage_score: number;
};

export type PredictionFeatureDiagnostics = { missing_inputs: string[]; limitations: string[] };
export type PredictionFeatureBundleV1 = {
  feature_version: PredictionFeatureVersion;
  fixture_id: string;
  generated_at: string;
  normalized_phase: PredictionPhase;
  input_summary: LivePredictionInputSummary;
  features: PredictionFeatureVectorV1;
  diagnostics: PredictionFeatureDiagnostics;
};

export type BuildPredictionFeatureBundleInput = {
  state: CanonicalMatchState;
  context?: InternalIntelligenceContext;
  minute?: number | null;
  generated_at: string;
  stale_after_minutes?: number;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const scoreValue = (value: unknown): number | null => finite(value) && value >= 0 ? value : null;
const normalizedLevel = (value: unknown, levels: string[]): string => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return levels.includes(normalized) ? normalized : levels[0];
};
const isoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));

export function normalizePredictionPhase(
  phase: string | null,
  fixtureStatus: string | null,
  minute: number | null
): PredictionPhase {
  const key = (value: string | null): string => (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const direct = (value: string): PredictionPhase | null => {
    if (["scheduled", "not_started", "prematch", "pre_match", "ns"].includes(value)) return "pre_match";
    if (["1h", "h1", "first_half", "firsthalf"].includes(value)) return "first_half";
    if (["ht", "halftime", "half_time"].includes(value)) return "halftime";
    if (["2h", "h2", "second_half", "secondhalf"].includes(value)) return "second_half";
    if (["et", "extra_time", "extratime"].includes(value)) return "extra_time";
    if (["ft", "fulltime", "full_time", "finished", "final", "complete", "completed", "ended"].includes(value)) return "finished";
    return null;
  };
  const explicit = direct(key(phase));
  if (explicit) return explicit;
  const statusPhase = direct(key(fixtureStatus));
  if (statusPhase) return statusPhase;
  const generic = ["live", "running", "inplay", "in_play", "in_running"].includes(key(phase)) ||
    ["live", "running", "inplay", "in_play", "in_running"].includes(key(fixtureStatus));
  if (generic && minute !== null) return minute <= 45 ? "first_half" : "second_half";
  return "unknown";
}

function normalizeMinute(value: unknown): number | null {
  return finite(value) ? clamp(Math.trunc(value), 0, 120) : null;
}
function directionShares(rows: CanonicalMatchState["odds"]["markets"]): [number, number, number, number] {
  if (rows.length === 0) return [0, 0, 0, 0];
  const counts = rows.reduce((result, row) => {
    const direction = row.direction.trim().toLowerCase();
    if (["up", "increase", "increased", "increasing", "rising", "rise"].includes(direction)) result[0]++;
    else if (["down", "decrease", "decreased", "decreasing", "falling", "fall"].includes(direction)) result[1]++;
    else if (["stable", "unchanged", "flat", "same"].includes(direction)) result[2]++;
    else result[3]++;
    return result;
  }, [0, 0, 0, 0]);
  return counts.map((count) => count / rows.length) as [number, number, number, number];
}
function addUnique(target: string[], value: string): void { if (!target.includes(value)) target.push(value); }

export function buildPredictionFeatureBundle(input: BuildPredictionFeatureBundleInput): PredictionFeatureBundleV1 {
  if (!isoTimestamp(input.generated_at)) throw new TypeError("generated_at must be a valid ISO timestamp.");
  if (input.context && input.context.fixture_id !== input.state.fixture_id) throw new TypeError("State and context fixture IDs must match.");
  const minute = normalizeMinute(input.minute);
  const staleAfter = Math.min(10080, Math.max(1,
    finite(input.stale_after_minutes) ? Math.trunc(input.stale_after_minutes) : 180));
  const state = input.state;
  const context = input.context;
  const home = scoreValue(state.scoreboard.home_score);
  const away = scoreValue(state.scoreboard.away_score);
  const scoresKnown = home !== null && away !== null;
  const phase = normalizePredictionPhase(state.scoreboard.phase, state.identity.status, minute);
  const freshnessTimestamp = state.freshness.latest_data_timestamp;
  const freshnessKnown = isoTimestamp(freshnessTimestamp);
  const ageMinutes = freshnessKnown ? Math.max(0, (Date.parse(input.generated_at) - Date.parse(freshnessTimestamp)) / 60000) : 0;
  const [up, down, stable, unknown] = directionShares(state.odds.markets);
  const marketCount = context?.odds_reliability.market_count ?? new Set(state.odds.markets.map((row) => row.market_id.trim()).filter(Boolean)).size;
  const providerCount = context?.odds_reliability.provider_count ?? 0;
  const reliability = context?.odds_reliability.status ?? (state.quality.has_odds ? "limited" : "unavailable");
  const pressure = context?.event_context.pressure_level ?? "none";
  const impact = context?.event_impact.impact_level ?? "none";
  const quality = state.quality.status === "complete" ? 1 : state.quality.status === "partial" ? 0.5 : 0;
  const hasOdds = context?.data_readiness.has_odds ?? state.quality.has_odds;
  const coverage = [state.quality.has_fixture, state.quality.has_scoreboard, hasOdds,
    context?.data_readiness.has_events ?? false, context?.data_readiness.has_event_impact ?? false]
    .filter(Boolean).length / 5;
  const diagnostics: PredictionFeatureDiagnostics = { missing_inputs: [], limitations: [] };
  if (minute === null) addUnique(diagnostics.missing_inputs, "minute_missing");
  if (!state.quality.has_scoreboard) addUnique(diagnostics.missing_inputs, "scoreboard_missing");
  if (!scoresKnown) addUnique(diagnostics.missing_inputs, "score_missing");
  if (!hasOdds) addUnique(diagnostics.missing_inputs, "odds_missing");
  if (!context) { addUnique(diagnostics.missing_inputs, "internal_context_missing"); addUnique(diagnostics.missing_inputs, "odds_reliability_missing"); }
  if (!context || !context.data_readiness.has_events) addUnique(diagnostics.missing_inputs, "events_missing");
  if (!context || !context.data_readiness.has_event_impact) addUnique(diagnostics.missing_inputs, "event_impact_missing");
  if (!freshnessKnown) addUnique(diagnostics.missing_inputs, "freshness_timestamp_missing");
  if (phase === "unknown") addUnique(diagnostics.missing_inputs, "phase_unknown");
  if (minute === null) addUnique(diagnostics.limitations, "Match minute was not provided; minute-based features are neutral.");
  if (!context) addUnique(diagnostics.limitations, "Internal intelligence context was not provided.");
  addUnique(diagnostics.limitations, "Market movement features describe generic odds-row direction only.");
  addUnique(diagnostics.limitations, "No side-specific implied probabilities are extracted in this phase.");
  if (!context || !context.data_readiness.has_events) addUnique(diagnostics.limitations, "Event features are unavailable.");
  if (!freshnessKnown) addUnique(diagnostics.limitations, "Freshness could not be calculated.");
  const inputSummary: LivePredictionInputSummary = {
    fixture_id: state.fixture_id, phase: state.scoreboard.phase, minute,
    home_score: home, away_score: away, score_diff: scoresKnown ? home - away : null,
    has_scoreboard: state.quality.has_scoreboard, has_odds: state.quality.has_odds,
    odds_count: state.odds.count, data_quality: state.quality.status,
    freshness_label: !freshnessKnown ? "unknown" : ageMinutes <= staleAfter ? "fresh" : "stale",
    market_reliability: reliability, event_pressure: pressure
  };
  const progress = phase === "pre_match" ? 0 : phase === "first_half" ? minute === null ? 0.25 : Math.min(minute / 90, 0.5)
    : phase === "halftime" ? 0.5 : phase === "second_half" ? minute === null ? 0.75 : clamp(minute / 90, 0.5, 1)
      : phase === "extra_time" ? minute === null ? 0.95 : clamp(minute / 120, 0.75, 1) : phase === "finished" ? 1 : minute === null ? 0 : clamp(minute / 120);
  const features: PredictionFeatureVectorV1 = {
    phase_progress: progress, phase_known: phase === "unknown" ? 0 : 1,
    minute_progress: minute === null ? 0 : clamp(minute / 120), minute_known: minute === null ? 0 : 1,
    score_known: scoresKnown ? 1 : 0, home_score_norm: home === null ? 0 : clamp(home / 10),
    away_score_norm: away === null ? 0 : clamp(away / 10), score_diff_norm: scoresKnown ? clamp((home - away) / 5, -1, 1) : 0,
    total_goals_norm: scoresKnown ? clamp((home + away) / 10) : 0, scoreboard_available: state.quality.has_scoreboard ? 1 : 0,
    odds_available: state.odds.available ? 1 : 0, odds_count_norm: clamp(state.odds.count / 50),
    market_count_norm: clamp(marketCount / 50), provider_count_norm: clamp(providerCount / 20),
    odds_up_share: up, odds_down_share: down, odds_stable_share: stable, odds_unknown_direction_share: unknown,
    odds_movement_share: up + down, market_reliability_score: reliability === "available" ? 1 : reliability === "limited" ? 0.5 : 0,
    event_pressure_score: pressure === "high" ? 1 : pressure === "medium" ? 0.67 : pressure === "low" ? 0.33 : 0,
    event_impact_score: impact === "high" ? 1 : impact === "medium" ? 0.67 : impact === "low" ? 0.33 : 0,
    event_count_norm: clamp((context?.event_context.event_count ?? 0) / 100), key_event_count_norm: clamp((context?.event_impact.key_event_count ?? 0) / 20),
    freshness_known: freshnessKnown ? 1 : 0, freshness_score: freshnessKnown ? clamp(1 - ageMinutes / staleAfter) : 0,
    data_age_norm: freshnessKnown ? clamp(ageMinutes / (staleAfter * 2)) : 1, data_quality_score: quality, coverage_score: coverage
  };
  const bundle: PredictionFeatureBundleV1 = { feature_version: "prediction-features-v1", fixture_id: state.fixture_id,
    generated_at: input.generated_at, normalized_phase: phase, input_summary: inputSummary, features, diagnostics };
  assertPredictionFeatureBundleValid(bundle);
  return bundle;
}

const FORBIDDEN_KEYS = new Set(["raw", "raw_payload", "provider_payload", "source_payload", "state", "context", "internal_context", "odds_rows", "event_rows", "signals", "debug", "debug_lineage", "formula", "model_weights", "token", "secret", "api_key", "stack", "recommended_bet", "bet", "wager", "stake", "payout", "profit", "expected_value", "ev", "edge", "wallet", "deposit"]);
const BINARY_KEYS = new Set(["phase_known", "minute_known", "score_known", "scoreboard_available", "odds_available", "freshness_known"]);
export function assertPredictionFeatureBundleValid(payload: unknown): void {
  if (payload === null || typeof payload !== "object") throw new TypeError("Prediction feature bundle must be an object.");
  const value = payload as Record<string, unknown>;
  if (value.feature_version !== "prediction-features-v1") throw new Error("Invalid prediction feature version.");
  if (typeof value.fixture_id !== "string" || value.fixture_id.trim() === "") throw new Error("Invalid fixture ID.");
  if (!isoTimestamp(value.generated_at)) throw new Error("Invalid generated_at.");
  const summary = value.input_summary as Record<string, unknown>;
  if (!summary || summary.fixture_id !== value.fixture_id) throw new Error("Input summary fixture ID mismatch.");
  const features = value.features as Record<string, unknown>;
  if (!features || typeof features !== "object") throw new Error("Features are required.");
  for (const [key, feature] of Object.entries(features)) {
    if (!finite(feature)) throw new Error(`Feature ${key} must be finite.`);
    if (BINARY_KEYS.has(key) && feature !== 0 && feature !== 1) throw new Error(`Feature ${key} must be binary.`);
    if (key === "score_diff_norm" ? feature < -1 || feature > 1 : feature < 0 || feature > 1) throw new Error(`Feature ${key} is out of range.`);
  }
  const directionKeys = ["odds_up_share", "odds_down_share", "odds_stable_share", "odds_unknown_direction_share"];
  const directionTotal = directionKeys.reduce((sum, key) => sum + Number(features[key] ?? 0), 0);
  if (directionTotal > 0 && Math.abs(directionTotal - 1) > 1e-9) throw new Error("Odds direction shares must sum to 1.");
  const visited = new Set<object>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);
    for (const [key, child] of Object.entries(node)) { if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error(`Forbidden prediction feature field: ${key}`); visit(child); }
  };
  visit(payload);
}
