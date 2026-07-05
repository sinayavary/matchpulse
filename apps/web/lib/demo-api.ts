/**
 * Demo API client — only calls safe public demo bridge routes.
 * No internal routes, no secrets, no DB access.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

// ── types matching the public demo bridge response shapes ──

export interface DemoFixtureCard {
  fixture_id: string;
  label: string;
  competition: string;
  description: string;
  demo_case: "scoreboard_available" | "odds_available";
}

export interface DemoMatchesResponse {
  data: DemoFixtureCard[];
  meta: {
    status: string;
    source: string;
    mode: string;
  };
}

export interface DemoReadiness {
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
}

export interface AgentBrief {
  headline: string;
  overview: string;
  available_data: string[];
  missing_data: string[];
  freshness_note: string;
  safe_scope_note: string;
}

export interface DemoSignal {
  type: string;
  severity: string;
  title: string;
  message: string;
}

export interface SignalSummary {
  total: number;
  info: number;
  warning: number;
  critical: number;
}

export interface DemoScoreboard {
  available: boolean;
  home_score: number | null;
  away_score: number | null;
}

export interface DemoMatchState {
  fixture_id: string;
  label?: string;
  competition?: string;
  status?: string;
  scoreboard?: DemoScoreboard | null;
  home_score?: number | null;
  away_score?: number | null;
  latest_data_timestamp?: string | null;
}

export interface DemoBundleData {
  fixture_id: string;
  demo_version: string;
  readiness: DemoReadiness;
  brief: AgentBrief | null;
  signal_summary: SignalSummary | null;
  signals: DemoSignal[];
  state: DemoMatchState | null;
}

export interface DemoBundleResponse {
  data: DemoBundleData | null;
  meta: {
    status: string;
    source: string;
    mode: string;
    message?: string;
  };
}

// ── fetch helpers ──

export async function fetchDemoMatches(): Promise<DemoMatchesResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo/matches`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DemoMatchesResponse;
  } catch {
    return null;
  }
}

export async function fetchDemoBundle(
  fixtureId: string
): Promise<DemoBundleResponse | null> {
  try {
    const params = new URLSearchParams({
      includeState: "true",
      includeSignals: "true",
      includeBrief: "true",
      oddsLimit: "20",
    });
    const res = await fetch(
      `${API_BASE_URL}/api/demo/matches/${fixtureId}/bundle?${params}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as DemoBundleResponse;
  } catch {
    return null;
  }
}
