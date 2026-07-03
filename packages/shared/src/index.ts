export type ApiStatus =
  | "live"
  | "reconnecting"
  | "degraded"
  | "stale"
  | "no_data"
  | "replay"
  | "error";

export type ApiMeta = {
  status: ApiStatus;
  last_updated: string;
  seconds_since_update: number;
  source: "txline" | "mock" | "replay" | "internal";
  mode: "live" | "mock" | "replay";
  message?: string;
};

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type MatchSummary = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  start_time_utc: string;
  competition: string;
  status: string;
};

export type MatchState = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  score: { home: number; away: number };
  phase: string;
  minute: number;
  market_mood: string;
  momentum: {
    home: number;
    away: number;
    label: string;
  };
};

export type SignalType =
  | "GOAL_MARKET_CONFIRMATION"
  | "SHARP_ODDS_MOVE"
  | "MARKET_OVERREACTION"
  | "MOMENTUM_SHIFT"
  | "RISK_ALERT"
  | "PHASE_CHANGE"
  | "INFO";

export type Signal = {
  signal_id: string;
  fixture_id: string;
  minute: number;
  type: SignalType;
  title: string;
  explanation: string;
  confidence: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  created_at: string;
};

export type Scenario = {
  scenario_id: string;
  fixture_id: string;
  label: string;
  probability: number;
  confidence: "low" | "medium" | "high";
  explanation: string;
};

export function createMeta(source: ApiMeta["source"] = "mock", mode: ApiMeta["mode"] = "mock", status: ApiStatus = "live"): ApiMeta {
  const now = new Date().toISOString();
  return {
    status,
    last_updated: now,
    seconds_since_update: 0,
    source,
    mode
  };
}
