import type { FastifyInstance, FastifyReply } from "fastify";
import {
  getAgentPresenterBriefForFixture,
  type AgentPresenterEventImpactHint,
  type AgentPresenterResponse
} from "./agent-presenter-v0.js";
import { buildDemoReadiness } from "./demo-bundle.js";
import { getDbClient } from "./db.js";
import {
  buildCanonicalMatchState,
  getDbBackedMatchState,
  type CanonicalMatchState,
  type MatchStateBuilderOptions
} from "./match-state-builder.js";
import {
  buildProductAgentV1InsightSummary,
  buildProductAgentV1Insight,
  type ProductAgentV1Insight,
  type ProductAgentV1InsightSummary
} from "./product-agent-v1.js";
import {
  SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS
} from "./signalcore-contract.js";
import type { SignalCoreV0Signal, SignalCoreV0Summary } from "./signalcore-v0.js";
import {
  mapAgentPresenterEventImpactToPublicSummary,
  type PublicEventImpactSummary
} from "./public-event-impact-contract.js";
import {
  assertFinalProductIntelligencePublicSafe,
  mapProductAgentToFinalProductIntelligence,
  type FinalProductIntelligence
} from "./final-product-intelligence.js";
import { getProductAgentV1ForFixture } from "./product-agent-v1.js";

export type PublicApiMode = "public";
export type PublicMetaStatus = "live" | "no_data" | "stale" | "degraded";
export type PublicMatchesRange = "past" | "upcoming" | "live" | "all";

type PublicFixtureRow = {
  fixtureId: string;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
};

type PublicApiDbClient = {
  fixture: {
    findMany(args: {
      where?: { competition?: string };
      orderBy: { startTimeUtc: "asc" | "desc" };
      take: number;
      select: {
        fixtureId: true;
        competition: true;
        homeTeam: true;
        awayTeam: true;
        startTimeUtc: true;
        status: true;
      };
    }): Promise<PublicFixtureRow[]>;
  };
  matchState: {
    findUnique(args: {
      where: { fixtureId: string };
      select: {
        homeScore: true;
        awayScore: true;
        phase: true;
        lastDataReceivedAt: true;
      };
    }): Promise<{
      homeScore: number | null;
      awayScore: number | null;
      phase: string | null;
      lastDataReceivedAt: Date | null;
    } | null>;
  };
  oddsSnapshot: {
    count(args: { where: { fixtureId: string } }): Promise<number>;
  };
};

export type PublicMatchSummary = {
  fixture_id: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  start_time_utc: string | null;
  status: string | null;
  scoreboard: {
    available: boolean;
    home_score: number | null;
    away_score: number | null;
  };
  odds: {
    available: boolean;
    count: number;
  };
  quality: {
    status: CanonicalMatchState["quality"]["status"];
    issues: string[];
  };
  latest_data_timestamp: string | null;
  insight_summary?: ProductAgentV1InsightSummary;
};

export type PublicStatusResponse = {
  data: {
    service: "matchpulse-api";
    ok: true;
    public_api_version: "public-v0";
    product_ready: true;
  };
  meta: {
    status: "live";
    source: "database";
    mode: PublicApiMode;
  };
};

export type PublicFinalProductIntelligenceResponse = {
  data: FinalProductIntelligence | null;
  meta: {
    status: PublicMetaStatus;
    source: "product-agent";
    mode: PublicApiMode;
    public_api_version: "public-v0";
    message?: string;
  };
};

export type PublicMatchesResponse = {
  data: PublicMatchSummary[];
  meta: {
    status: PublicMetaStatus;
    source: "database";
    mode: PublicApiMode;
  };
};

export type PublicMatchResponse = {
  data: CanonicalMatchState;
  meta: {
    status: PublicMetaStatus;
    source: "database";
    mode: PublicApiMode;
    message?: string;
  };
};

export type PublicBundleResponse = {
  data: {
    fixture_id: string;
    insight: ProductAgentV1Insight | null;
    readiness: ReturnType<typeof buildDemoReadiness>;
    brief: AgentPresenterResponse["data"]["brief"] | null;
    signal_summary: AgentPresenterResponse["data"]["signal_summary"] | null;
    signals: AgentPresenterResponse["data"]["signals"];
    state: CanonicalMatchState | null;
  };
  meta: {
    status: PublicMetaStatus;
    source: "database";
    mode: PublicApiMode;
    message?: string;
  };
};

export type PublicMatchIntelligenceCardResponse = {
  data: {
    fixture_id: string;
    agent_version: "presenter-v0";
    brief: {
      status_label: "ready" | "partial" | "empty";
      headline: string;
      overview: string;
      available_data: string[];
      missing_data: string[];
      freshness_note: string;
      quality_notes: string[];
      safe_scope_note: string;
    };
    signal_summary: {
      status: "ready" | "partial" | "empty";
      has_fixture: boolean;
      has_scoreboard: boolean;
      has_odds: boolean;
      latest_data_timestamp: string | null;
    };
    pressure_hint?: {
      label: string;
      level: "none" | "low" | "medium" | "high";
      source: "stored_scores_snapshot";
      evidence_count: number;
      limitations: string[];
      safe_scope_note: string;
    };
    odds_reliability_hint?: {
      label: "odds_data_unavailable" | "odds_data_limited" | "odds_data_available";
      status: "unavailable" | "limited" | "available";
      source: "database";
      snapshot_count: number;
      market_count: number;
      provider_count: number;
      latest_timestamp: string | null;
      limitation_count: number;
      safe_scope_note: string;
    };
    event_impact: PublicEventImpactSummary;
  } | null;
  meta: {
    status: PublicMetaStatus;
    source: "database";
    mode: PublicApiMode;
    public_api_version: "public-v0";
    message?: string;
  };
};

export type PublicApiDependencies = {
  getDbClient: () => PublicApiDbClient;
  getDbBackedMatchState: (
    fixtureId: string,
    options?: MatchStateBuilderOptions
  ) => Promise<CanonicalMatchState>;
  getAgentPresenterBriefForFixture: (
    fixtureId: string,
    options?: {
      includeState?: boolean;
      includePressure?: boolean;
      includeOddsReliability?: boolean;
      includeEventImpact?: boolean;
      oddsLimit?: number;
      staleAfterMinutes?: number;
      format?: "compact" | "full";
    }
  ) => Promise<AgentPresenterResponse>;
  getAgentPresenterEventImpactHintForFixture?: (
    fixtureId: string
  ) => Promise<AgentPresenterEventImpactHint | undefined>;
  getProductAgentV1ForFixture: typeof getProductAgentV1ForFixture;
  now: () => Date;
};

const defaultDependencies: PublicApiDependencies = {
  getDbClient,
  getDbBackedMatchState,
  getAgentPresenterBriefForFixture,
  getProductAgentV1ForFixture,
  now: () => new Date()
};

const forbiddenPublicFields = new Set<string>(
  SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS.map((field) => field.toLowerCase())
);

const forbiddenPublicCardFields = new Set<string>([
  ...forbiddenPublicFields,
  "formula",
  "raw_payload",
  "debug_lineage",
  "primary_side",
  "pressure_score",
  "adapter_status",
  "raw odds rows",
  "internal model details",
  "secrets",
  "signals",
  "state",
  "insight"
]);

const liveStatusTokens = new Set([
  "live",
  "1h",
  "2h",
  "ht",
  "halftime",
  "inplay",
  "in_running",
  "running"
]);

const pastStatusTokens = new Set([
  "finished",
  "complete",
  "completed",
  "final",
  "fulltime",
  "ft",
  "ended"
]);

class PublicApiValidationError extends Error {}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return defaultValue;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeLimit(value: unknown, defaultValue: number, max: number): number {
  const parsed = readNumber(value);
  if (parsed === undefined) return defaultValue;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function normalizeStaleAfterMinutes(value: unknown, defaultValue = 60): number {
  return normalizeLimit(value, defaultValue, 10080);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizePublicPayload<T>(value: T): T {
  const visited = new WeakMap<object, unknown>();

  function sanitize(current: unknown): unknown {
    if (Array.isArray(current)) {
      return current.map((item) => sanitize(item));
    }
    if (!isPlainObject(current)) {
      return current;
    }
    const cached = visited.get(current);
    if (cached !== undefined) return cached;

    const output: Record<string, unknown> = {};
    visited.set(current, output);
    for (const [key, nested] of Object.entries(current)) {
      if (forbiddenPublicFields.has(key.toLowerCase())) continue;
      output[key] = sanitize(nested);
    }
    return output;
  }

  return sanitize(value) as T;
}

export function assertNoForbiddenPublicKeys(value: unknown): void {
  const visited = new WeakSet<object>();

  function inspect(current: unknown, path: string): void {
    if (!isPlainObject(current) && !Array.isArray(current)) return;
    if (visited.has(current as object)) return;
    visited.add(current as object);

    if (Array.isArray(current)) {
      current.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      const fieldPath = path ? `${path}.${key}` : key;
      if (forbiddenPublicFields.has(normalizedKey)) {
        throw new TypeError(`Forbidden public field: ${fieldPath}`);
      }
      inspect(nestedValue, fieldPath);
    }
  }

  inspect(value, "");
}

export function normalizePublicMatchesQuery(query: {
  range?: unknown;
  competitionId?: unknown;
  limit?: unknown;
  includeInsight?: unknown;
}): {
  range: PublicMatchesRange;
  competitionId?: string;
  limit: number;
  includeInsight: boolean;
} {
  const range = typeof query.range === "string" && query.range.trim() !== ""
    ? query.range.trim().toLowerCase()
    : "all";

  if (!["past", "upcoming", "live", "all"].includes(range)) {
    throw new PublicApiValidationError("range must be one of: past, upcoming, live, all.");
  }

  const competitionId = typeof query.competitionId === "string" && query.competitionId.trim() !== ""
    ? query.competitionId.trim()
    : typeof query.competitionId === "number" && Number.isFinite(query.competitionId)
      ? String(query.competitionId)
    : undefined;

  return {
    range: range as PublicMatchesRange,
    competitionId,
    limit: normalizeLimit(query.limit, 20, 100),
    includeInsight: readBoolean(query.includeInsight, false)
  };
}

export function normalizePublicMatchQuery(query: {
  includeOdds?: unknown;
  oddsLimit?: unknown;
  staleAfterMinutes?: unknown;
}): Required<MatchStateBuilderOptions> & { staleAfterMinutes: number } {
  return {
    includeOdds: readBoolean(query.includeOdds, true),
    oddsLimit: normalizeLimit(query.oddsLimit, 20, 50),
    staleAfterMinutes: normalizeStaleAfterMinutes(query.staleAfterMinutes)
  };
}

export function normalizePublicBundleQuery(query: {
  includeState?: unknown;
  includeSignals?: unknown;
  includeBrief?: unknown;
  oddsLimit?: unknown;
  staleAfterMinutes?: unknown;
}): {
  includeState: boolean;
  includeSignals: boolean;
  includeBrief: boolean;
  oddsLimit: number;
  staleAfterMinutes: number;
} {
  return {
    includeState: readBoolean(query.includeState, true),
    includeSignals: readBoolean(query.includeSignals, true),
    includeBrief: readBoolean(query.includeBrief, true),
    oddsLimit: normalizeLimit(query.oddsLimit, 20, 50),
    staleAfterMinutes: normalizeStaleAfterMinutes(query.staleAfterMinutes)
  };
}

export function normalizePublicMatchIntelligenceCardQuery(query: {
  oddsLimit?: unknown;
  staleAfterMinutes?: unknown;
}): {
  oddsLimit: number;
  staleAfterMinutes: number;
} {
  return {
    oddsLimit: normalizeLimit(query.oddsLimit, 20, 50),
    staleAfterMinutes: normalizeStaleAfterMinutes(query.staleAfterMinutes, 180)
  };
}

export function normalizePublicProductIntelligenceQuery(query: Record<string, unknown>): {
  oddsLimit: number;
  staleAfterMinutes: number;
  includeEventImpact: boolean;
  includeOddsReliability: boolean;
} {
  const allowed = new Set([
    "oddsLimit",
    "staleAfterMinutes",
    "includeEventImpact",
    "includeOddsReliability"
  ]);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      throw new PublicApiValidationError("Invalid product intelligence query.");
    }
  }
  return {
    oddsLimit: normalizeLimit(query.oddsLimit, 20, 50),
    staleAfterMinutes: normalizeStaleAfterMinutes(query.staleAfterMinutes, 180),
    includeEventImpact: readBoolean(query.includeEventImpact, true),
    includeOddsReliability: readBoolean(query.includeOddsReliability, true)
  };
}

function sanitizeAndAssertPublicPayload<T>(value: T): T {
  const sanitized = sanitizePublicPayload(value);
  assertNoForbiddenPublicKeys(sanitized);
  return sanitized;
}

function sanitizePublicCardPayload<T>(value: T): T {
  const visited = new WeakMap<object, unknown>();

  function sanitize(current: unknown): unknown {
    if (Array.isArray(current)) {
      return current.map((item) => sanitize(item));
    }
    if (!isPlainObject(current)) {
      return current;
    }
    const cached = visited.get(current);
    if (cached !== undefined) return cached;

    const output: Record<string, unknown> = {};
    visited.set(current, output);
    for (const [key, nested] of Object.entries(current)) {
      if (forbiddenPublicCardFields.has(key.toLowerCase())) continue;
      output[key] = sanitize(nested);
    }
    return output;
  }

  return sanitize(value) as T;
}

function assertNoForbiddenPublicCardKeys(value: unknown): void {
  const visited = new WeakSet<object>();

  function inspect(current: unknown, path: string): void {
    if (!isPlainObject(current) && !Array.isArray(current)) return;
    if (visited.has(current as object)) return;
    visited.add(current as object);

    if (Array.isArray(current)) {
      current.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      const fieldPath = path ? `${path}.${key}` : key;
      if (forbiddenPublicCardFields.has(normalizedKey)) {
        throw new TypeError(`Forbidden public card field: ${fieldPath}`);
      }
      inspect(nestedValue, fieldPath);
    }
  }

  inspect(value, "");
}

function sanitizeAndAssertPublicCardPayload<T>(value: T): T {
  const sanitized = sanitizePublicCardPayload(value);
  assertNoForbiddenPublicCardKeys(sanitized);
  return sanitized;
}

function sanitizeInsightSummarySafe(
  insightSummary: ProductAgentV1InsightSummary | undefined
): ProductAgentV1InsightSummary | undefined {
  if (insightSummary === undefined) return undefined;

  try {
    return sanitizeAndAssertPublicPayload(insightSummary);
  } catch {
    return undefined;
  }
}

function createSyntheticSignal(
  type: SignalCoreV0Signal["type"],
  severity: SignalCoreV0Signal["severity"],
  title: string,
  message: string
): SignalCoreV0Signal {
  return {
    type,
    severity,
    title,
    message,
    details: {}
  };
}

function toIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    try {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "number") {
    try {
      return Number.isFinite(value) ? new Date(value).toISOString() : null;
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    try {
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && "toISOString" in value && typeof value.toISOString === "function") {
    try {
      const isoValue = value.toISOString();
      const parsed = Date.parse(isoValue);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    } catch {
      return null;
    }
  }

  return null;
}

function parseTimestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isStateStale(state: CanonicalMatchState, staleAfterMinutes: number, now: Date): boolean {
  const latestTimestamp = parseTimestamp(state.freshness.latest_data_timestamp);
  if (latestTimestamp === null) return false;
  return now.getTime() - latestTimestamp > staleAfterMinutes * 60_000;
}

function toPublicMetaStatus(
  state: CanonicalMatchState,
  staleAfterMinutes: number,
  now: Date
): PublicMetaStatus {
  if (state.quality.status === "empty") return "no_data";
  if (isStateStale(state, staleAfterMinutes, now)) return "stale";
  return state.quality.status === "complete" ? "live" : "degraded";
}

function readStatusToken(state: CanonicalMatchState): string {
  return (state.scoreboard.phase ?? state.identity.status ?? "").trim().toLowerCase();
}

function isPastState(state: CanonicalMatchState, now: Date): boolean {
  const token = readStatusToken(state);
  if (pastStatusTokens.has(token)) return true;

  const startTime = parseTimestamp(state.identity.start_time_utc);
  return startTime !== null && startTime < now.getTime() && !liveStatusTokens.has(token);
}

function isLiveState(state: CanonicalMatchState): boolean {
  const token = readStatusToken(state);
  return liveStatusTokens.has(token);
}

function isUpcomingState(state: CanonicalMatchState, now: Date): boolean {
  if (isLiveState(state) || isPastState(state, now)) return false;
  const startTime = parseTimestamp(state.identity.start_time_utc);
  return startTime === null || startTime >= now.getTime();
}

function matchesRequestedRange(
  state: CanonicalMatchState,
  range: PublicMatchesRange,
  now: Date
): boolean {
  if (range === "all") return true;
  if (range === "live") return isLiveState(state);
  if (range === "past") return isPastState(state, now);
  return isUpcomingState(state, now);
}

function fixtureMatchesRequestedRange(
  fixture: PublicFixtureRow,
  range: PublicMatchesRange,
  now: Date
): boolean {
  if (range === "all") return true;
  const token = (fixture.status ?? "").trim().toLowerCase();
  const startTime = parseTimestamp(toIsoTimestamp(fixture.startTimeUtc));
  const isLive = liveStatusTokens.has(token);
  const isPast = pastStatusTokens.has(token) ||
    (startTime !== null && startTime < now.getTime() && !isLive);
  const isUpcoming = !isLive && !isPast;

  if (range === "live") return isLive;
  if (range === "past") return isPast;
  return isUpcoming;
}

export function buildPublicStatusResponse(): PublicStatusResponse {
  const output: PublicStatusResponse = {
    data: {
      service: "matchpulse-api",
      ok: true,
      public_api_version: "public-v0",
      product_ready: true
    },
    meta: {
      status: "live",
      source: "database",
      mode: "public"
    }
  };
  assertNoForbiddenPublicKeys(output);
  return output;
}

export function buildPublicMatchSummary(
  state: CanonicalMatchState
): PublicMatchSummary {
  const output: PublicMatchSummary = {
    fixture_id: state.fixture_id,
    competition: state.identity.competition,
    home_team: state.identity.home_team,
    away_team: state.identity.away_team,
    start_time_utc: state.identity.start_time_utc,
    status: state.identity.status,
    scoreboard: {
      available: state.scoreboard.available,
      home_score: state.scoreboard.home_score,
      away_score: state.scoreboard.away_score
    },
    odds: {
      available: state.odds.available,
      count: state.odds.count
    },
    quality: {
      status: state.quality.status,
      issues: [...state.quality.issues]
    },
    latest_data_timestamp: state.freshness.latest_data_timestamp
  };
  assertNoForbiddenPublicKeys(output);
  return output;
}

export function buildPublicMatchResponse(input: {
  state: CanonicalMatchState;
  staleAfterMinutes: number;
  now: Date;
  message?: string;
  metaStatus?: PublicMetaStatus;
}): PublicMatchResponse {
  const output: PublicMatchResponse = {
    data: sanitizeAndAssertPublicPayload(input.state),
    meta: {
      status: input.metaStatus ?? toPublicMetaStatus(input.state, input.staleAfterMinutes, input.now),
      source: "database",
      mode: "public",
      ...(input.message === undefined ? {} : { message: input.message })
    }
  };
  assertNoForbiddenPublicKeys(output);
  return output;
}

export function buildPublicBundleResponse(input: {
  presenterOutput: AgentPresenterResponse;
  options: ReturnType<typeof normalizePublicBundleQuery>;
  staleAfterMinutes: number;
  now: Date;
  message?: string;
}): PublicBundleResponse {
  const state = input.presenterOutput.data.state ?? buildCanonicalMatchState({
    fixtureId: input.presenterOutput.data.fixture_id,
    fixture: null,
    scoreboard: null,
    odds: [],
    includeOdds: true
  });
  const insight = buildProductAgentV1Insight({
    fixture_id: input.presenterOutput.data.fixture_id,
    summary: input.presenterOutput.data.signal_summary,
    signals: input.presenterOutput.data.signals,
    state
  });

  const output: PublicBundleResponse = {
    data: sanitizeAndAssertPublicPayload({
      fixture_id: input.presenterOutput.data.fixture_id,
      insight,
      readiness: buildDemoReadiness(input.presenterOutput, input.options),
      brief: input.options.includeBrief ? input.presenterOutput.data.brief : null,
      signal_summary: input.options.includeSignals ? input.presenterOutput.data.signal_summary : null,
      signals: input.options.includeSignals ? input.presenterOutput.data.signals : [],
      state: input.options.includeState ? state : null
    }),
    meta: {
      status: toPublicMetaStatus(state, input.staleAfterMinutes, input.now),
      source: "database",
      mode: "public",
      ...(input.message === undefined ? {} : { message: input.message })
    }
  };
  assertNoForbiddenPublicKeys(output);
  return output;
}

function toPublicCardMetaStatus(input: {
  presenterOutput: AgentPresenterResponse;
  staleAfterMinutes: number;
  now: Date;
}): PublicMetaStatus {
  if (input.presenterOutput.meta.status === "no_data" ||
    input.presenterOutput.data.signal_summary.status === "empty") {
    return "no_data";
  }

  const latestTimestamp = parseTimestamp(input.presenterOutput.data.signal_summary.latest_data_timestamp);
  if (latestTimestamp !== null &&
    input.now.getTime() - latestTimestamp > input.staleAfterMinutes * 60_000) {
    return "stale";
  }

  return input.presenterOutput.meta.status === "live" ? "live" : "degraded";
}

export function buildPublicMatchIntelligenceCardResponse(input: {
  presenterOutput: AgentPresenterResponse;
  eventImpactHint?: AgentPresenterEventImpactHint;
  staleAfterMinutes: number;
  now: Date;
  message?: string;
  metaStatus?: PublicMetaStatus;
}): PublicMatchIntelligenceCardResponse {
  const { data: presenterData } = input.presenterOutput;
  const payload = sanitizeAndAssertPublicCardPayload({
    fixture_id: presenterData.fixture_id,
    agent_version: presenterData.agent_version,
    brief: {
      status_label: presenterData.brief.status_label,
      headline: presenterData.brief.headline,
      overview: presenterData.brief.overview,
      available_data: [...presenterData.brief.available_data],
      missing_data: [...presenterData.brief.missing_data],
      freshness_note: presenterData.brief.freshness_note,
      quality_notes: [...presenterData.brief.quality_notes],
      safe_scope_note: presenterData.brief.safe_scope_note
    },
    signal_summary: {
      status: presenterData.signal_summary.status,
      has_fixture: presenterData.signal_summary.has_fixture,
      has_scoreboard: presenterData.signal_summary.has_scoreboard,
      has_odds: presenterData.signal_summary.has_odds,
      latest_data_timestamp: presenterData.signal_summary.latest_data_timestamp
    },
    event_impact: mapAgentPresenterEventImpactToPublicSummary(input.eventImpactHint),
    ...(presenterData.pressure_hint === undefined
      ? {}
      : {
          pressure_hint: {
            label: presenterData.pressure_hint.label,
            level: presenterData.pressure_hint.level,
            source: presenterData.pressure_hint.source,
            evidence_count: presenterData.pressure_hint.evidence_count,
            limitations: [...presenterData.pressure_hint.limitations],
            safe_scope_note: presenterData.pressure_hint.safe_scope_note
          }
        }),
    ...(presenterData.odds_reliability_hint === undefined
      ? {}
      : {
          odds_reliability_hint: {
            label: presenterData.odds_reliability_hint.label,
            status: presenterData.odds_reliability_hint.status,
            source: presenterData.odds_reliability_hint.source,
            snapshot_count: presenterData.odds_reliability_hint.snapshot_count,
            market_count: presenterData.odds_reliability_hint.market_count,
            provider_count: presenterData.odds_reliability_hint.provider_count,
            latest_timestamp: presenterData.odds_reliability_hint.latest_timestamp,
            limitation_count: presenterData.odds_reliability_hint.limitation_count,
            safe_scope_note: presenterData.odds_reliability_hint.safe_scope_note
          }
        })
  });

  const output: PublicMatchIntelligenceCardResponse = {
    data: payload,
    meta: {
      status: input.metaStatus ?? toPublicCardMetaStatus(input),
      source: "database",
      mode: "public",
      public_api_version: "public-v0",
      ...(input.message === undefined ? {} : { message: input.message })
    }
  };
  assertNoForbiddenPublicCardKeys(output);
  return output;
}

async function readPublicMatchState(
  fixtureId: string,
  options: ReturnType<typeof normalizePublicMatchQuery>,
  dependencies: PublicApiDependencies
): Promise<{ state: CanonicalMatchState; degraded: boolean }> {
  if (!process.env.DATABASE_URL) {
    return {
      state: buildCanonicalMatchState({
        fixtureId,
        fixture: null,
        scoreboard: null,
        odds: [],
        includeOdds: options.includeOdds
      }),
      degraded: false
    };
  }

  try {
    return {
      state: await dependencies.getDbBackedMatchState(fixtureId, options),
      degraded: false
    };
  } catch {
    return {
      state: buildCanonicalMatchState({
        fixtureId,
        fixture: null,
        scoreboard: null,
        odds: [],
        includeOdds: options.includeOdds
      }),
      degraded: true
    };
  }
}

function isUnknownFixtureState(state: CanonicalMatchState): boolean {
  return state.quality.status === "empty" && !state.quality.has_fixture;
}

function notFound(reply: FastifyReply): void {
  reply.code(404);
}

function badRequest(reply: FastifyReply): void {
  reply.code(400);
}

function unavailable(reply: FastifyReply): void {
  reply.code(503);
}

function buildDegradedPublicMatchResponse(state: CanonicalMatchState, now: Date): PublicMatchResponse {
  return buildPublicMatchResponse({
    state,
    staleAfterMinutes: 0,
    now,
    metaStatus: "degraded",
    message: "Public match data is temporarily unavailable."
  });
}

function buildSyntheticSignalSummary(input: {
  fixture: PublicFixtureRow;
  hasScoreboard: boolean;
  oddsCount: number;
  latestDataTimestamp: string | null;
}): SignalCoreV0Summary {
  const hasFixture = true;
  const hasOdds = input.oddsCount > 0;
  const summaryStatus = !hasFixture && !input.hasScoreboard && !hasOdds
    ? "empty" as const
    : hasFixture && (input.hasScoreboard || hasOdds)
      ? "ready" as const
      : "partial" as const;

  return {
    status: summaryStatus,
    signal_count: 0,
    critical_count: 0,
    warning_count: 0,
    info_count: 0,
    has_fixture: hasFixture,
    has_scoreboard: input.hasScoreboard,
    has_odds: hasOdds,
    latest_data_timestamp: input.latestDataTimestamp
  };
}

function buildCompactInsightSummary(input: {
  fixture: PublicFixtureRow;
  hasScoreboard: boolean;
  oddsCount: number;
  staleAfterMinutes: number;
  now: Date;
  latestDataTimestamp: string | null;
}): ProductAgentV1InsightSummary {
  const hasIdentity = input.fixture.competition !== null &&
    input.fixture.homeTeam !== null &&
    input.fixture.awayTeam !== null;
  const summary = buildSyntheticSignalSummary(input);
  const latestDataTimestamp = summary.latest_data_timestamp;
  const isStale = latestDataTimestamp !== null &&
    input.now.getTime() - Date.parse(latestDataTimestamp) > input.staleAfterMinutes * 60_000;
  const signals: SignalCoreV0Signal[] = [];

  if (!summary.has_fixture) {
    signals.push(
      createSyntheticSignal("FIXTURE_MISSING", summary.status === "empty" ? "critical" : "warning", "Fixture missing", "Fixture identity data is missing.")
    );
  }
  if (!summary.has_scoreboard) {
    signals.push(
      createSyntheticSignal("SCOREBOARD_MISSING", "warning", "Scoreboard missing", "Scoreboard data is missing.")
    );
  }
  if (!summary.has_odds) {
    signals.push(
      createSyntheticSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing.")
    );
  }
  if (!hasIdentity) {
    signals.push(
      createSyntheticSignal("IDENTITY_INCOMPLETE", "warning", "Identity incomplete", "Fixture identity is missing one or more required fields.")
    );
  }
  if (isStale) {
    signals.push(
      createSyntheticSignal("DATA_STALE", "warning", "Data stale", "The latest data timestamp is older than the freshness window.")
    );
  }
  if (signals.length === 0 && summary.status !== "empty") {
    signals.push(
      createSyntheticSignal("DATA_READY", "info", "Data ready", "Fixture and at least one live data component are available.")
    );
  }

  const criticalCount = signals.filter((signal) => signal.severity === "critical").length;
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;
  const infoCount = signals.filter((signal) => signal.severity === "info").length;
  const insight = buildProductAgentV1Insight({
    fixture_id: input.fixture.fixtureId,
    summary: {
      ...summary,
      signal_count: signals.length,
      critical_count: criticalCount,
      warning_count: warningCount,
      info_count: infoCount
    },
    signals
  });

  return buildProductAgentV1InsightSummary(insight);
}

function buildFallbackCompactInsightSummary(input: {
  fixture: PublicFixtureRow;
  oddsCount: number;
  qualityStatus: PublicMatchSummary["quality"]["status"];
  issues: string[];
  latestDataTimestamp: string | null;
}): ProductAgentV1InsightSummary {
  const issueSet = new Set(input.issues);

  return {
    agent_version: "product-agent-v1",
    status: issueSet.has("data_stale")
      ? "stale"
      : input.qualityStatus === "complete"
        ? "ready"
        : input.qualityStatus,
    quality: input.qualityStatus,
    freshness: issueSet.has("data_stale")
      ? "stale"
      : input.latestDataTimestamp === null
        ? "unknown"
        : "fresh",
    issue_count: issueSet.size,
    issues: [...issueSet],
    top_signal_types: [
      ...(issueSet.has("data_stale") ? ["DATA_STALE" as const] : []),
      ...(input.oddsCount === 0 ? ["ODDS_MISSING" as const] : []),
      ...(issueSet.has("scoreboard_missing") ? ["SCOREBOARD_MISSING" as const] : []),
      ...(
        input.fixture.competition === null ||
        input.fixture.homeTeam === null ||
        input.fixture.awayTeam === null
          ? ["IDENTITY_INCOMPLETE" as const]
          : []
      )
    ].slice(0, 3),
    display_ready: input.qualityStatus !== "empty" &&
      input.fixture.competition !== null &&
      input.fixture.homeTeam !== null &&
      input.fixture.awayTeam !== null &&
      (!issueSet.has("scoreboard_missing") || input.oddsCount > 0)
  };
}

function buildCompactInsightSummarySafe(input: {
  fixture: PublicFixtureRow;
  hasScoreboard: boolean;
  oddsCount: number;
  staleAfterMinutes: number;
  now: Date;
  qualityStatus: PublicMatchSummary["quality"]["status"];
  issues: string[];
  latestDataTimestamp: string | null;
}): ProductAgentV1InsightSummary | undefined {
  try {
    return buildCompactInsightSummary(input);
  } catch {
    try {
      return buildFallbackCompactInsightSummary(input);
    } catch {
      return undefined;
    }
  }
}

function buildPublicMatchSummaryBase(input: {
  fixture: PublicFixtureRow;
  hasScoreboard: boolean;
  matchState: Awaited<ReturnType<PublicApiDbClient["matchState"]["findUnique"]>>;
  hasOdds: boolean;
  oddsCount: number;
  qualityStatus: PublicMatchSummary["quality"]["status"];
  issues: string[];
  latestDataTimestamp: string | null;
}): PublicMatchSummary {
  return sanitizeAndAssertPublicPayload({
    fixture_id: input.fixture.fixtureId,
    competition: input.fixture.competition,
    home_team: input.fixture.homeTeam,
    away_team: input.fixture.awayTeam,
    start_time_utc: toIsoTimestamp(input.fixture.startTimeUtc),
    status: input.fixture.status,
    scoreboard: {
      available: input.hasScoreboard,
      home_score: input.matchState?.homeScore ?? null,
      away_score: input.matchState?.awayScore ?? null
    },
    odds: {
      available: input.hasOdds,
      count: input.oddsCount
    },
    quality: {
      status: input.qualityStatus,
      issues: input.issues
    },
    latest_data_timestamp: input.latestDataTimestamp
  });
}

async function buildPublicMatchSummaries(
  fixtures: PublicFixtureRow[],
  normalized: ReturnType<typeof normalizePublicMatchesQuery>,
  deps: PublicApiDependencies,
  now: Date
): Promise<PublicMatchSummary[]> {
  const db = deps.getDbClient();
  const summaries = await Promise.all(fixtures.map(async (fixture) => {
    if (!fixtureMatchesRequestedRange(fixture, normalized.range, now)) {
      return null;
    }

    const [matchStateResult, oddsCountResult] = await Promise.allSettled([
      db.matchState.findUnique({
        where: { fixtureId: fixture.fixtureId },
        select: {
          homeScore: true,
          awayScore: true,
          phase: true,
          lastDataReceivedAt: true
        }
      }),
      db.oddsSnapshot.count({
        where: { fixtureId: fixture.fixtureId }
      })
    ]);

    const matchState = matchStateResult.status === "fulfilled" ? matchStateResult.value : null;
    const oddsCount = oddsCountResult.status === "fulfilled" ? oddsCountResult.value : 0;
    const hasScoreboard = matchState !== null;
    const hasOdds = oddsCount > 0;
    const hasIdentity = fixture.competition !== null &&
      fixture.homeTeam !== null &&
      fixture.awayTeam !== null;
    const issues: string[] = [];

    if (!hasScoreboard) issues.push("scoreboard_missing");
    if (!hasOdds) issues.push("odds_missing");
    if (!hasIdentity) issues.push("identity_incomplete");
    if (!hasScoreboard && !hasOdds) issues.push("no_persisted_data");

    const qualityStatus = !hasScoreboard && !hasOdds
      ? "empty" as const
      : hasScoreboard && hasOdds
        ? "complete" as const
        : "partial" as const;
    const insightIssues = [...issues];
    const latestDataTimestamp = toIsoTimestamp(matchState?.lastDataReceivedAt);
    const isStale = latestDataTimestamp !== null &&
      now.getTime() - Date.parse(latestDataTimestamp) > 60 * 60_000;
    if (isStale) insightIssues.push("data_stale");
    const baseSummary = buildPublicMatchSummaryBase({
      fixture,
      hasScoreboard,
      matchState,
      hasOdds,
      oddsCount,
      qualityStatus,
      issues,
      latestDataTimestamp
    });

    if (!normalized.includeInsight) {
      return baseSummary;
    }

    const insightSummary = sanitizeInsightSummarySafe(
      buildCompactInsightSummarySafe({
        fixture,
        hasScoreboard,
        oddsCount,
        staleAfterMinutes: 60,
        now,
        qualityStatus,
        issues: insightIssues,
        latestDataTimestamp
      })
    );

    if (insightSummary === undefined) {
      return baseSummary;
    }

    return {
      ...baseSummary,
      insight_summary: insightSummary
    };
  }));

  return summaries.filter((summary): summary is PublicMatchSummary => summary !== null);
}

export function registerPublicApiRoutes(
  app: FastifyInstance,
  dependencies: Partial<PublicApiDependencies> = {}
): void {
  const deps: PublicApiDependencies = {
    ...defaultDependencies,
    ...dependencies
  };

  app.get("/api/public/status", async () => buildPublicStatusResponse());

  app.get("/api/public/matches", async (request, reply) => {
    const query = request.query as {
      range?: unknown;
      competitionId?: unknown;
      limit?: unknown;
      includeInsight?: unknown;
    };

    try {
      const normalized = normalizePublicMatchesQuery(query);

      if (!process.env.DATABASE_URL) {
        return {
          data: [],
          meta: {
            status: "no_data" as const,
            source: "database" as const,
            mode: "public" as const
          }
        };
      }

      const now = deps.now();
      const candidates = await deps.getDbClient().fixture.findMany({
        where: normalized.competitionId === undefined
          ? undefined
          : { competition: normalized.competitionId },
        orderBy: { startTimeUtc: normalized.range === "past" ? "desc" : "asc" },
        take: Math.min(normalized.limit * 5, 100),
        select: {
          fixtureId: true,
          competition: true,
          homeTeam: true,
          awayTeam: true,
          startTimeUtc: true,
          status: true
        }
      });

      const data = await buildPublicMatchSummaries(candidates, normalized, deps, now);
      return {
        data: data.slice(0, normalized.limit),
        meta: {
          status: data.length > 0 ? "live" as const : "no_data" as const,
          source: "database" as const,
          mode: "public" as const
        }
      };
    } catch (error) {
      if (error instanceof PublicApiValidationError) {
        badRequest(reply);
        return {
          data: [],
          meta: {
            status: "no_data" as const,
            source: "database" as const,
            mode: "public" as const,
            message: error.message
          }
        };
      }
      unavailable(reply);
      return {
        data: [],
        meta: {
          status: "degraded" as const,
          source: "database" as const,
          mode: "public" as const,
          message: "Public match list is temporarily unavailable."
        }
      };
    }
  });

  app.get("/api/public/matches/:fixtureId", async (request, reply) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const query = request.query as {
      includeOdds?: unknown;
      oddsLimit?: unknown;
      staleAfterMinutes?: unknown;
    };
    const normalized = normalizePublicMatchQuery(query);
    const now = deps.now();
    const { state, degraded } = await readPublicMatchState(fixtureId, normalized, deps);

    if (degraded) {
      reply.code(503);
      return buildDegradedPublicMatchResponse(state, now);
    }

    if (isUnknownFixtureState(state)) {
      notFound(reply);
      return buildPublicMatchResponse({
        state,
        staleAfterMinutes: normalized.staleAfterMinutes,
        now,
        message: "Fixture not found."
      });
    }

    return buildPublicMatchResponse({
      state,
      staleAfterMinutes: normalized.staleAfterMinutes,
      now
    });
  });

  app.get("/api/public/matches/:fixtureId/bundle", async (request, reply) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const query = request.query as {
      includeState?: unknown;
      includeSignals?: unknown;
      includeBrief?: unknown;
      oddsLimit?: unknown;
      staleAfterMinutes?: unknown;
    };
    const normalized = normalizePublicBundleQuery(query);
    const now = deps.now();

    try {
      const presenterOutput = await deps.getAgentPresenterBriefForFixture(fixtureId, {
        includeState: true,
        oddsLimit: normalized.oddsLimit,
        staleAfterMinutes: normalized.staleAfterMinutes,
        format: "full"
      });
      const state = presenterOutput.data.state ?? buildCanonicalMatchState({
        fixtureId,
        fixture: null,
        scoreboard: null,
        odds: [],
        includeOdds: true
      });
      const isMissing = isUnknownFixtureState(state);
      if (isMissing) {
        notFound(reply);
      }
      return buildPublicBundleResponse({
        presenterOutput,
        options: normalized,
        staleAfterMinutes: normalized.staleAfterMinutes,
        now,
        ...(isMissing ? { message: "Fixture not found." } : {})
      });
    } catch {
      unavailable(reply);
      return {
        data: {
          fixture_id: fixtureId,
          insight: null,
          readiness: {
            status: "empty" as const,
            display_ready: false,
            has_state: false,
            has_brief: false,
            has_signals: false,
            has_fixture: false,
            has_scoreboard: false,
            has_odds: false,
            issue_count: 1,
            issues: ["no_persisted_data" as const]
          },
          brief: null,
          signal_summary: null,
          signals: [],
          state: null
        },
        meta: {
          status: "degraded" as const,
          source: "database" as const,
          mode: "public" as const,
          message: "Public match bundle is temporarily unavailable."
        }
      };
    }
  });

  app.get("/api/public/matches/:fixtureId/intelligence-card", async (request, reply) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const query = request.query as {
      oddsLimit?: unknown;
      staleAfterMinutes?: unknown;
      includeState?: unknown;
      includeSignals?: unknown;
    };
    const normalized = normalizePublicMatchIntelligenceCardQuery(query);
    const now = deps.now();

    try {
      const presenterOutput = await deps.getAgentPresenterBriefForFixture(fixtureId, {
        includeState: false,
        includePressure: true,
        includeOddsReliability: true,
        oddsLimit: normalized.oddsLimit,
        staleAfterMinutes: normalized.staleAfterMinutes,
        format: "compact"
      });
      let eventImpactHint: AgentPresenterEventImpactHint | undefined;
      try {
        eventImpactHint = deps.getAgentPresenterEventImpactHintForFixture === undefined
          ? (await deps.getAgentPresenterBriefForFixture(fixtureId, {
              includeEventImpact: true,
              format: "compact"
            })).data.event_impact_hint
          : await deps.getAgentPresenterEventImpactHintForFixture(fixtureId);
      } catch {
        eventImpactHint = undefined;
      }
      const isNoData = presenterOutput.meta.status === "no_data" ||
        presenterOutput.data.signal_summary.status === "empty";
      if (isNoData) {
        notFound(reply);
      }
      return buildPublicMatchIntelligenceCardResponse({
        presenterOutput,
        eventImpactHint,
        staleAfterMinutes: normalized.staleAfterMinutes,
        now,
        ...(isNoData
          ? { metaStatus: "no_data" as const, message: "Match intelligence card data is not available for this fixture." }
          : {})
      });
    } catch {
      unavailable(reply);
      return {
        data: null,
        meta: {
          status: "degraded" as const,
          source: "database" as const,
          mode: "public" as const,
          public_api_version: "public-v0" as const,
          message: "Public match intelligence card is temporarily unavailable."
        }
      };
    }
  });

  app.get("/api/public/matches/:fixtureId/product-intelligence", async (request, reply) => {
    const { fixtureId } = request.params as { fixtureId: string };
    try {
      const query = normalizePublicProductIntelligenceQuery(
        request.query as Record<string, unknown>
      );
      const productAgentOutput = await deps.getProductAgentV1ForFixture(fixtureId, query);
      const intelligence = mapProductAgentToFinalProductIntelligence(productAgentOutput);
      assertFinalProductIntelligencePublicSafe(intelligence);

      if (productAgentOutput.meta.status === "no_data" || intelligence.status === "no_data") {
        reply.code(404);
        return {
          data: null,
          meta: {
            status: "no_data" as const,
            source: "product-agent" as const,
            mode: "public" as const,
            public_api_version: "public-v0" as const,
            message: "Product intelligence is not available for this fixture."
          }
        } satisfies PublicFinalProductIntelligenceResponse;
      }

      const response: PublicFinalProductIntelligenceResponse = {
        data: intelligence,
        meta: {
          status: intelligence.status,
          source: "product-agent",
          mode: "public",
          public_api_version: "public-v0"
        }
      };
      assertNoForbiddenPublicKeys(response);
      return response;
    } catch (error) {
      if (error instanceof PublicApiValidationError) {
        badRequest(reply);
        return {
          data: null,
          meta: {
            status: "no_data" as const,
            source: "product-agent" as const,
            mode: "public" as const,
            public_api_version: "public-v0" as const,
            message: "Invalid product intelligence query."
          }
        } satisfies PublicFinalProductIntelligenceResponse;
      }
      unavailable(reply);
      return {
        data: null,
        meta: {
          status: "degraded" as const,
          source: "product-agent" as const,
          mode: "public" as const,
          public_api_version: "public-v0" as const,
          message: "Product intelligence is temporarily unavailable."
        }
      } satisfies PublicFinalProductIntelligenceResponse;
    }
  });
}
