const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export type ApiMeta = {
  status: string;
  source: string;
  mode: string;
  message?: string;
};

export type PublicStatus = {
  service: "matchpulse-api";
  ok: true;
  public_api_version: "public-v0";
  demo_available: boolean;
};

export type PublicScoreboard = {
  available: boolean;
  home_score: number | null;
  away_score: number | null;
  phase?: string | null;
  last_data_received_at?: string | null;
};

export type PublicOddsMarket = {
  market_id: string;
  market_name: string | null;
  selection_name: string;
  odds: number;
  direction: string;
  source_timestamp: string | null;
};

export type PublicOddsSummary = {
  available: boolean;
  count: number;
  markets?: PublicOddsMarket[];
};

export type PublicQuality = {
  status: "complete" | "partial" | "empty";
  has_fixture?: boolean;
  has_scoreboard?: boolean;
  has_odds?: boolean;
  issues: string[];
};

export type PublicFreshness = {
  built_at?: string;
  latest_score_timestamp?: string | null;
  latest_odds_timestamp?: string | null;
  latest_data_timestamp: string | null;
};

export type PublicMatchSummary = {
  fixture_id: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  start_time_utc: string | null;
  status: string | null;
  scoreboard: PublicScoreboard;
  odds: PublicOddsSummary;
  quality: PublicQuality;
  latest_data_timestamp: string | null;
};

export type PublicMatchState = {
  fixture_id: string;
  identity: {
    fixture_id: string;
    competition: string | null;
    home_team: string | null;
    away_team: string | null;
    start_time_utc: string | null;
    status: string | null;
  };
  scoreboard: PublicScoreboard;
  odds: PublicOddsSummary;
  freshness: PublicFreshness;
  quality: PublicQuality;
};

export type PublicReadiness = {
  status: "ready" | "partial" | "empty";
  display_ready: boolean;
  has_state: boolean;
  has_brief: boolean;
  has_signals: boolean;
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  issue_count: number;
  issues: string[];
};

export type PublicAgentBrief = {
  status_label: "ready" | "partial" | "empty";
  headline: string;
  overview: string;
  available_data: string[];
  missing_data: string[];
  freshness_note: string;
  quality_notes: string[];
  safe_scope_note: string;
};

export type PublicSignal = {
  type: string;
  severity: string;
  title: string;
  message: string;
};

export type PublicSignalSummary = {
  status: "ready" | "partial" | "empty";
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  latest_data_timestamp: string | null;
  signal_count: number;
  info_count: number;
  warning_count: number;
  critical_count: number;
};

export type PublicMatchBundle = {
  fixture_id: string;
  readiness: PublicReadiness;
  brief: PublicAgentBrief | null;
  signal_summary: PublicSignalSummary | null;
  signals: PublicSignal[];
  state: PublicMatchState | null;
};

export type PublicResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type PublicFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  meta: ApiMeta | null;
};

export type PublicMatchesParams = {
  range?: "past" | "upcoming" | "live" | "all";
  limit?: number;
};

export type PublicMatchOptions = {
  includeOdds?: boolean;
  oddsLimit?: number;
  staleAfterMinutes?: number;
};

export type PublicBundleOptions = {
  includeState?: boolean;
  includeSignals?: boolean;
  includeBrief?: boolean;
  oddsLimit?: number;
  staleAfterMinutes?: number;
};

async function fetchPublic<T>(path: string): Promise<PublicFetchResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
    const json = (await response.json()) as Partial<PublicResponse<T>>;

    return {
      ok: response.ok,
      status: response.status,
      data: (json.data ?? null) as T | null,
      meta: (json.meta ?? null) as ApiMeta | null
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      meta: null
    };
  }
}

export async function fetchPublicStatus(): Promise<PublicFetchResult<PublicStatus>> {
  return fetchPublic<PublicStatus>("/api/public/status");
}

export async function fetchPublicMatches(
  params: PublicMatchesParams = {}
): Promise<PublicFetchResult<PublicMatchSummary[]>> {
  const search = new URLSearchParams();
  search.set("range", params.range ?? "all");
  search.set("limit", String(params.limit ?? 50));
  return fetchPublic<PublicMatchSummary[]>(`/api/public/matches?${search.toString()}`);
}

export async function fetchPublicMatch(
  fixtureId: string,
  options: PublicMatchOptions = {}
): Promise<PublicFetchResult<PublicMatchState>> {
  const search = new URLSearchParams();
  if (options.includeOdds !== undefined) search.set("includeOdds", String(options.includeOdds));
  if (options.oddsLimit !== undefined) search.set("oddsLimit", String(options.oddsLimit));
  if (options.staleAfterMinutes !== undefined) {
    search.set("staleAfterMinutes", String(options.staleAfterMinutes));
  }

  const query = search.toString();
  return fetchPublic<PublicMatchState>(
    `/api/public/matches/${fixtureId}${query ? `?${query}` : ""}`
  );
}

export async function fetchPublicMatchBundle(
  fixtureId: string,
  options: PublicBundleOptions = {}
): Promise<PublicFetchResult<PublicMatchBundle>> {
  const search = new URLSearchParams();
  if (options.includeState !== undefined) search.set("includeState", String(options.includeState));
  if (options.includeSignals !== undefined) {
    search.set("includeSignals", String(options.includeSignals));
  }
  if (options.includeBrief !== undefined) search.set("includeBrief", String(options.includeBrief));
  if (options.oddsLimit !== undefined) search.set("oddsLimit", String(options.oddsLimit));
  if (options.staleAfterMinutes !== undefined) {
    search.set("staleAfterMinutes", String(options.staleAfterMinutes));
  }

  const query = search.toString();
  return fetchPublic<PublicMatchBundle>(
    `/api/public/matches/${fixtureId}/bundle${query ? `?${query}` : ""}`
  );
}

export function formatFixtureLabel(match: {
  home_team: string | null;
  away_team: string | null;
}): string {
  return `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`;
}

export function formatScoreboard(scoreboard: PublicScoreboard): string {
  if (!scoreboard.available) return "Scoreboard missing";
  if (
    typeof scoreboard.home_score === "number" &&
    typeof scoreboard.away_score === "number"
  ) {
    return `${scoreboard.home_score} - ${scoreboard.away_score}`;
  }
  return "Scoreboard available, score unavailable";
}

export function sanitizeSafeScopeNote(note: string | null | undefined): string {
  if (!note) {
    return "This brief describes data availability, freshness, and quality only. It does not provide actions or financial guidance.";
  }

  const forbidden = [
    "bet",
    "betting",
    "wager",
    "stake",
    "deposit",
    "payout",
    "profit",
    "sportsbook",
    "prediction",
    "recommendation",
    "expected value",
    "edge",
    "winner",
    "confidence",
    "probability"
  ];

  const normalized = note.toLowerCase();
  if (forbidden.some((word) => normalized.includes(word))) {
    return "This brief describes data availability, freshness, and quality only. It does not provide actions or financial guidance.";
  }

  return note;
}
