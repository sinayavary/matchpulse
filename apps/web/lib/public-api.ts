export function resolveApiBaseUrl(environment: Record<string, string | undefined> = process.env, browser = typeof window !== "undefined"): string {
  if (browser && environment.NODE_ENV === "production") return "/api/bff";
  const candidate = browser
    ? environment.NEXT_PUBLIC_API_BASE_URL
    : environment.MATCHPULSE_API_BASE_URL ?? environment.NEXT_PUBLIC_API_BASE_URL;
  if (!candidate && environment.NODE_ENV !== "production") return "http://localhost:4000";
  if (!candidate) throw new Error("A MatchPulse API base URL is required in production.");
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error("The MatchPulse API base URL is invalid."); }
  if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) throw new Error("The MatchPulse API base URL must use HTTP or HTTPS.");
  return candidate.replace(/\/$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

export type ApiMeta = {
  status: string;
  source: string;
  mode: string;
  message?: string;
  next_cursor?: string | null;
  has_more?: boolean;
  range?: string;
  generated_at?: string;
  result_count?: number;
  deduplicated_count?: number;
  scanned_count?: number;
  snapshot_at?: string;
  cursor_version?: number;
  data_status?: "complete" | "partial" | "unavailable";
  source_rows_scanned?: number;
  representatives_returned?: number;
  duplicate_rows_suppressed?: number;
  lifecycle_rows_excluded?: number;
  cursor_rows_excluded?: number;
  earliest_returned_start?: string | null;
  latest_returned_start?: string | null;
  missing_day_warnings?: string[];
};

export type PublicStatus = {
  service: "matchpulse-api";
  ok: true;
  public_api_version: "public-v0";
  product_ready: boolean;
  readiness: {
    overall: "ready" | "degraded" | "unavailable";
    checked_at: string;
    components: Record<string, { status: "ready" | "degraded" | "unavailable"; timestamp: string | null; reason_code: string }>;
  };
};

export type PublicCompetition = { competition_id: string; name: string };

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
  catalog_identity: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  start_time_utc: string | null;
  status: string | null;
  scoreboard: PublicScoreboard;
  odds: PublicOddsSummary;
  quality: PublicQuality;
  latest_data_timestamp: string | null;
  lifecycle: { lifecycle: string; source: string; reason_code: string; normalized_phase: string | null; is_active: boolean; is_terminal: boolean; updated_at: string };
  availability: {
    score: "available" | "not_expected_yet" | "not_attempted" | "upstream_no_data" | "stale" | "upstream_error" | "unsupported";
    odds: "available" | "not_expected_yet" | "not_attempted" | "upstream_no_data" | "stale" | "upstream_error" | "unsupported";
    events: "available" | "not_expected_yet" | "not_attempted" | "upstream_no_data" | "stale" | "upstream_error" | "unsupported";
  };
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

export type PublicReplayPoint = {
  as_of: string; minute: number | null; phase: string | null;
  score: { home: number | null; away: number | null };
  odds: Array<{ market_id: string; selection_name: string; odds: number; source_timestamp: string | null }>;
  probabilities: { home: number; draw: number; away: number } | null;
  next_goal: { home: number; none: number; away: number } | null;
  momentum: { home: number; neutral: number; away: number } | null;
  confidence: { level: string; score: number } | null; risk: string | null;
  events: Array<{ event_type: string; title: string; minute: number | null; team_side: string; source_timestamp: string | null }>;
};

export type PublicReplay = {
  status: "ok" | "no_data";
  fixture: { fixture_id: string; competition: string; home_team: string; away_team: string; start_time_utc: string | null; status: string } | null;
  coverage: { start: string | null; end: string | null };
  timeline: PublicReplayPoint[]; gaps: string[]; source: string; model_version: string | null;
};

export type PublicMatchesParams = {
  range?: "past" | "upcoming" | "live" | "starting_soon" | "recently_finished" | "interrupted" | "all";
  limit?: number;
  cursor?: string;
  competitionId?: string;
  from?: string;
  to?: string;
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

async function fetchPublic<T>(path: string, signal?: AbortSignal): Promise<PublicFetchResult<T>> {
  try {
    const targetPath = API_BASE_URL === "/api/bff"
      ? path.replace(/^\/api\/public(?=\/|$)/, "/public")
      : path;
    const response = await fetch(`${API_BASE_URL}${targetPath}`, { cache: "no-store", signal });
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

export async function fetchPublicStatus(signal?: AbortSignal): Promise<PublicFetchResult<PublicStatus>> {
  return fetchPublic<PublicStatus>("/api/public/status", signal);
}

export async function fetchPublicCompetitions(signal?: AbortSignal): Promise<PublicFetchResult<PublicCompetition[]>> {
  return fetchPublic<PublicCompetition[]>("/api/public/competitions", signal);
}

export async function fetchPublicMatches(
  params: PublicMatchesParams = {},
  signal?: AbortSignal
): Promise<PublicFetchResult<PublicMatchSummary[]>> {
  const search = new URLSearchParams();
  search.set("range", params.range ?? "all");
  search.set("limit", String(params.limit ?? 50));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.competitionId) search.set("competitionId", params.competitionId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return fetchPublic<PublicMatchSummary[]>(`/api/public/matches?${search.toString()}`, signal);
}

export async function fetchPublicReplay(fixtureId: string, selectedTime?: string): Promise<PublicFetchResult<PublicReplay>> {
  const query = selectedTime ? `?selectedTime=${encodeURIComponent(selectedTime)}` : "";
  return fetchPublic<PublicReplay>(`/api/public/matches/${encodeURIComponent(fixtureId)}/replay${query}`);
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
