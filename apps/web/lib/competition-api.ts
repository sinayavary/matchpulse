const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export const DEFAULT_COMPETITION_REPLAY_CHECKPOINT = "opening-balance" as const;

export type CompetitionMarketAnalysis = {
  market_intelligence_version: "public-market-intelligence-v1";
  fixture_id: string;
  generated_at: string;
  availability: "available" | "limited" | "unavailable";
  reliability: "unavailable" | "low" | "limited" | "good" | "strong";
  freshness: "fresh" | "aging" | "stale" | "unknown";
  provider_coverage: "none" | "single" | "limited" | "broad";
  provider_agreement: "unknown" | "weak" | "mixed" | "strong";
  volatility: "none" | "low" | "medium" | "high";
  market_count: number;
  usable_market_count: number;
  provider_count: number;
  notable_movements: Array<{
    market_label: string;
    selection_label: string;
    direction: "up" | "down" | "stable" | "volatile" | "unknown";
    strength: "low" | "medium" | "high";
    summary: string;
  }>;
  summary: string;
  limitations: string[];
  last_update: string | null;
  safety_note: string;
};

export type CompetitionPrediction = {
  prediction_version: "competition-public-prediction-v1";
  fixture_id: string;
  as_of: string;
  generated_at: string;
  model_profile: "competition_baseline_v1";
  match_state: {
    phase: string | null;
    normalized_phase: string;
    minute: number | null;
    home_score: number | null;
    away_score: number | null;
  };
  final_outcome: { home: number; draw: number; away: number };
  next_goal: { home: number; none: number; away: number };
  goal_horizon: { next_5m: number; next_10m: number; next_15m: number };
  final_score: {
    outcomes: Array<{ home_score: number; away_score: number; probability: number }>;
    other_probability: number;
  };
  current_result_survival: {
    current_result_holds: number;
    current_result_changes: number;
  };
  momentum_shift: {
    home_strengthens: number;
    neutral: number;
    away_strengthens: number;
  };
  confidence: { level: string; score: number; reasons: string[] };
  risk: { level: string; reasons: string[] };
  explanation: { summary: string; main_factors: string[]; limitations: string[] };
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
  safety_note: string;
};

export type CompetitionPredictionResponse = {
  data: CompetitionPrediction | null;
  market_analysis: CompetitionMarketAnalysis;
  meta: {
    status: string;
    source: "competition-prediction";
    mode: "public" | "replay";
    message?: string;
  };
};

export type CompetitionReplayCheckpointSummary = {
  checkpoint_id: "opening-balance" | "pressure-shift" | "terminal-home";
  label: string;
  description: string;
  minute: number;
  phase: "H1" | "H2" | "FT";
  home_score: number;
  away_score: number;
  market_reliability: CompetitionMarketAnalysis["reliability"];
  market_freshness: CompetitionMarketAnalysis["freshness"];
  market_agreement: CompetitionMarketAnalysis["provider_agreement"];
  market_volatility: CompetitionMarketAnalysis["volatility"];
};

export type CompetitionReplayIndexResponse = {
  data: CompetitionReplayCheckpointSummary[];
  meta: {
    status: string;
    source: "competition-replay";
    mode: "replay";
    message?: string;
  };
};

export type CompetitionFetchResult<T> = {
  ok: boolean;
  status: number;
  value: T | null;
  error_message: string | null;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function safeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function buildCompetitionPredictionPath(fixtureId: string): string {
  return `/api/public/v1/matches/${safeSegment(fixtureId)}/prediction`;
}

export function buildCompetitionReplayPath(checkpointId?: string): string {
  return checkpointId === undefined
    ? "/api/public/v1/competition/replay"
    : `/api/public/v1/competition/replay/${safeSegment(checkpointId)}`;
}

async function fetchCompetitionJson<T>(
  path: string,
  fetchImpl: FetchLike = fetch,
): Promise<CompetitionFetchResult<T>> {
  try {
    const response = await fetchImpl(`${API_BASE_URL}${path}`, { cache: "no-store" });
    const value = await response.json() as T;
    return {
      ok: response.ok,
      status: response.status,
      value,
      error_message: response.ok ? null : "Competition data is currently unavailable.",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      value: null,
      error_message: "Competition data is currently unavailable.",
    };
  }
}

export function fetchCompetitionPrediction(
  fixtureId: string,
  fetchImpl?: FetchLike,
): Promise<CompetitionFetchResult<CompetitionPredictionResponse>> {
  return fetchCompetitionJson(buildCompetitionPredictionPath(fixtureId), fetchImpl);
}

export function fetchCompetitionReplayIndex(
  fetchImpl?: FetchLike,
): Promise<CompetitionFetchResult<CompetitionReplayIndexResponse>> {
  return fetchCompetitionJson(buildCompetitionReplayPath(), fetchImpl);
}

export function fetchCompetitionReplayCheckpoint(
  checkpointId: string,
  fetchImpl?: FetchLike,
): Promise<CompetitionFetchResult<CompetitionPredictionResponse>> {
  return fetchCompetitionJson(buildCompetitionReplayPath(checkpointId), fetchImpl);
}

export function shouldUseReplayFallback(
  result: CompetitionFetchResult<CompetitionPredictionResponse>,
): boolean {
  return !result.ok || result.value === null || result.value.data === null;
}
