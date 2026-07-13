import {
  FINAL_PREDICTION_SAFETY_NOTE,
  type FinalPredictionRisk,
  type FinalPredictionSnapshot,
} from "./final-prediction-domain.js";
import {
  assertPublicMarketIntelligenceSafe,
  type PublicMarketIntelligence,
} from "./odds-intelligence-contract.js";
import {
  type CompetitionPredictionRuntimeResult,
  type CompetitionPredictionRuntimeStatus,
} from "./competition-prediction-service.js";

export type PublicCompetitionPrediction = {
  prediction_version: "competition-public-prediction-v1";
  fixture_id: string;
  as_of: string;
  generated_at: string;
  model_profile: "competition_baseline_v1";
  match_state: {
    phase: string | null;
    normalized_phase: FinalPredictionSnapshot["match_context"]["normalized_phase"];
    minute: number | null;
    home_score: number | null;
    away_score: number | null;
  };
  final_outcome: FinalPredictionSnapshot["model_output"]["final_outcome"];
  next_goal: FinalPredictionSnapshot["model_output"]["next_goal"];
  goal_horizon: FinalPredictionSnapshot["model_output"]["goal_horizon"];
  final_score: FinalPredictionSnapshot["model_output"]["final_score"];
  current_result_survival: FinalPredictionSnapshot["model_output"]["current_result_survival"];
  momentum_shift: FinalPredictionSnapshot["model_output"]["momentum_shift"];
  confidence: {
    level: FinalPredictionSnapshot["confidence"]["level"];
    score: number;
    reasons: string[];
  };
  risk: {
    level: FinalPredictionSnapshot["risk"]["level"];
    reasons: string[];
  };
  explanation: {
    summary: string;
    main_factors: string[];
    limitations: string[];
  };
  data_quality: {
    level: "complete" | "partial" | "limited";
    coverage_score: number;
    freshness: "fresh" | "aging" | "stale" | "unknown";
    has_scoreboard: boolean;
    has_minute: boolean;
    has_odds: boolean;
    has_reliable_odds: boolean;
    has_events: boolean;
  };
  safety_note: typeof FINAL_PREDICTION_SAFETY_NOTE;
};

export type PublicCompetitionPredictionResponse = {
  data: PublicCompetitionPrediction | null;
  market_analysis: PublicMarketIntelligence;
  meta: {
    status: CompetitionPredictionRuntimeStatus;
    source: "competition-prediction";
    mode: "public" | "replay";
    message?: string;
  };
};

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "assigned_weight",
  "recommended_model_weight",
  "approved_model_weight_cap",
  "fair_probability",
  "consensus_probability",
  "provider_key",
  "provider_id",
  "provider_name",
  "bookmaker",
  "component_scores",
  "odds_intelligence_reference",
  "specialist_contributions",
  "feature_reference",
  "feature_hash",
  "assessment_id",
  "raw",
  "raw_payload",
  "provider_payload",
  "source_payload",
  "debug",
  "debug_lineage",
  "formula",
  "threshold",
  "model_weights",
  "model_coefficients",
  "private_provider_weights",
  "recommended_bet",
  "stake",
  "payout",
  "profit",
  "expected_value",
  "wallet",
  "secret",
  "api_key",
  "stack",
]);

const RISK_REASON_TEXT: Readonly<Record<FinalPredictionRisk["reasons"][number], string>> = {
  stale_data: "Some supporting match data is stale.",
  missing_minute: "The current match minute is unavailable.",
  missing_events: "Recent event evidence is unavailable.",
  missing_odds: "Market evidence is unavailable.",
  unreliable_odds: "Available market evidence did not pass reliability checks.",
  single_provider: "Market source coverage is limited.",
  provider_disagreement: "Available market sources show material disagreement.",
  market_anomaly: "Recent market data contains an anomaly warning.",
  model_disagreement: "Available prediction signals are not closely aligned.",
  out_of_distribution: "The current match state has limited model support.",
  low_historical_support: "Historical support for the current state is limited.",
  partial_feature_coverage: "Only part of the expected match context is available.",
  inference_fallback: "A conservative fallback contributes because evidence is incomplete.",
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function publicConfidenceReasons(snapshot: FinalPredictionSnapshot): string[] {
  const reasons = [
    snapshot.data_coverage.has_scoreboard
      ? "Current score data is available."
      : "Current score data is unavailable.",
    snapshot.data_coverage.has_reliable_odds
      ? "Reliable market context supports the model."
      : "Reliable market context is unavailable.",
    snapshot.data_coverage.has_events
      ? "Recent match-event context is available."
      : "Recent match-event context is unavailable.",
    "The competition model is deterministic but not production calibrated.",
  ];
  return unique(reasons);
}

function publicRiskReasons(snapshot: FinalPredictionSnapshot): string[] {
  return unique(snapshot.risk.reasons.map((reason) => RISK_REASON_TEXT[reason]));
}

function publicExplanation(snapshot: FinalPredictionSnapshot): PublicCompetitionPrediction["explanation"] {
  const scoreboard = snapshot.data_coverage.has_scoreboard;
  const minute = snapshot.match_context.minute;
  const home = snapshot.match_context.home_score;
  const away = snapshot.match_context.away_score;
  const finished = snapshot.match_context.normalized_phase === "finished";
  const summary = finished && scoreboard
    ? "The match is finished, so terminal prediction values reflect the recorded final score."
    : scoreboard
      ? "MatchPulse combines the current match state with bounded event and market support."
      : "MatchPulse has limited match-state evidence and cannot provide a full live prediction.";
  const mainFactors: string[] = [];
  if (scoreboard && home !== null && away !== null) {
    mainFactors.push(
      minute === null
        ? `The recorded score is ${home}-${away}.`
        : `The recorded score is ${home}-${away} at minute ${minute}.`,
    );
  }
  if (snapshot.data_coverage.has_reliable_odds) {
    mainFactors.push("Reliable market context contributes within a bounded model limit.");
  }
  if (snapshot.data_coverage.has_events) {
    mainFactors.push("Recent match-event context contributes to the prediction.");
  }
  if (mainFactors.length === 0) {
    mainFactors.push("Only conservative fallback support is available.");
  }
  const limitations = [
    "competition_baseline_v1 is intentionally limited and not production calibrated.",
    ...(!snapshot.data_coverage.has_scoreboard ? ["Current score data is unavailable."] : []),
    ...(!snapshot.data_coverage.has_minute ? ["Current match minute is unavailable."] : []),
    ...(!snapshot.data_coverage.has_odds ? ["Market evidence is unavailable."] : []),
    ...(snapshot.data_coverage.has_odds && !snapshot.data_coverage.has_reliable_odds
      ? ["Available market evidence did not pass reliability checks."]
      : []),
    ...(!snapshot.data_coverage.has_events ? ["Recent event evidence is unavailable."] : []),
    ...(snapshot.risk.reasons.includes("inference_fallback")
      ? ["A conservative fallback contributes because evidence is incomplete."]
      : []),
  ];
  return {
    summary,
    main_factors: unique(mainFactors),
    limitations: unique(limitations),
  };
}

function freshnessLabel(score: number): PublicCompetitionPrediction["data_quality"]["freshness"] {
  if (!Number.isFinite(score)) return "unknown";
  if (score >= 0.85) return "fresh";
  if (score >= 0.4) return "aging";
  return "stale";
}

function dataQualityLevel(snapshot: FinalPredictionSnapshot): PublicCompetitionPrediction["data_quality"]["level"] {
  const coverage = snapshot.data_coverage.feature_coverage_score;
  if (coverage >= 0.8 && snapshot.confidence.freshness_score >= 0.4) return "complete";
  if (coverage >= 0.5) return "partial";
  return "limited";
}

function inspectPublicKeys(value: unknown, path = "", seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPublicKeys(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase())) {
      throw new TypeError(`Forbidden public competition prediction field: ${path ? `${path}.` : ""}${key}`);
    }
    inspectPublicKeys(nested, path ? `${path}.${key}` : key, seen);
  }
}

export function assertPublicCompetitionPredictionSafe(payload: unknown): void {
  inspectPublicKeys(payload);
}

export function mapCompetitionPredictionSnapshotToPublic(
  snapshot: FinalPredictionSnapshot,
): PublicCompetitionPrediction {
  const output: PublicCompetitionPrediction = {
    prediction_version: "competition-public-prediction-v1",
    fixture_id: snapshot.identity.fixture_id,
    as_of: snapshot.identity.as_of,
    generated_at: snapshot.identity.generated_at,
    model_profile: "competition_baseline_v1",
    match_state: {
      phase: snapshot.match_context.phase,
      normalized_phase: snapshot.match_context.normalized_phase,
      minute: snapshot.match_context.minute,
      home_score: snapshot.match_context.home_score,
      away_score: snapshot.match_context.away_score,
    },
    final_outcome: structuredClone(snapshot.model_output.final_outcome),
    next_goal: structuredClone(snapshot.model_output.next_goal),
    goal_horizon: structuredClone(snapshot.model_output.goal_horizon),
    final_score: structuredClone(snapshot.model_output.final_score),
    current_result_survival: structuredClone(snapshot.model_output.current_result_survival),
    momentum_shift: structuredClone(snapshot.model_output.momentum_shift),
    confidence: {
      level: snapshot.confidence.level,
      score: snapshot.confidence.score,
      reasons: publicConfidenceReasons(snapshot),
    },
    risk: {
      level: snapshot.risk.level,
      reasons: publicRiskReasons(snapshot),
    },
    explanation: publicExplanation(snapshot),
    data_quality: {
      level: dataQualityLevel(snapshot),
      coverage_score: snapshot.data_coverage.feature_coverage_score,
      freshness: freshnessLabel(snapshot.confidence.freshness_score),
      has_scoreboard: snapshot.data_coverage.has_scoreboard,
      has_minute: snapshot.data_coverage.has_minute,
      has_odds: snapshot.data_coverage.has_odds,
      has_reliable_odds: snapshot.data_coverage.has_reliable_odds,
      has_events: snapshot.data_coverage.has_events,
    },
    safety_note: FINAL_PREDICTION_SAFETY_NOTE,
  };
  assertPublicCompetitionPredictionSafe(output);
  return output;
}

export function mapCompetitionPredictionRuntimeResultToPublic(
  result: CompetitionPredictionRuntimeResult,
): PublicCompetitionPredictionResponse {
  assertPublicMarketIntelligenceSafe(result.market_analysis);
  const response: PublicCompetitionPredictionResponse = {
    data: result.snapshot === null
      ? null
      : mapCompetitionPredictionSnapshotToPublic(result.snapshot),
    market_analysis: structuredClone(result.market_analysis),
    meta: {
      status: result.status,
      source: "competition-prediction",
      mode: result.mode === "replay" ? "replay" : "public",
      ...(result.snapshot === null
        ? { message: "Competition prediction data is currently unavailable." }
        : {}),
    },
  };
  assertPublicCompetitionPredictionSafe(response);
  return response;
}
