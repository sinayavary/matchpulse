import type { FastifyInstance, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import {
  getAgentPresenterBriefForFixture,
  type AgentPresenterEventImpactHint,
  type AgentPresenterResponse
} from "./agent-presenter-v0.js";
import { lifecycleIsLive, lifecycleIsUpcoming, resolveMatchLifecycle, lifecycleIsRecentlyFinished } from "./match-lifecycle.js";
import { normalizeProviderStatus } from "./txline-normalizer.js";
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
export type PublicMatchesRange = "past" | "live" | "starting_soon" | "upcoming" | "recently_finished" | "interrupted" | "all";

export type PublicAvailabilityStatus = "available" | "not_expected_yet" | "not_attempted" | "upstream_no_data" | "stale" | "upstream_error" | "unsupported";

type PublicFixtureRow = {
  fixtureId: string;
  sport?: string | null;
  stage?: string | null;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  __signals?: PublicCatalogSignals;
  catalogIdentity?: string;
};

type PublicCatalogSignals = {
  lifecycle: ReturnType<typeof resolveMatchLifecycle>;
  state_available: boolean;
  home_score: number | null;
  away_score: number | null;
  phase: string | null;
  minute: number | null;
  latest_data_timestamp: number | null;
  odds_count: number;
  odds_latest_timestamp: number | null;
  event_count: number;
  event_latest_timestamp: number | null;
  state_error?: boolean;
  odds_error?: boolean;
  event_error?: boolean;
  enrichment_error?: boolean;
};

type PublicFixtureWhere = Record<string, unknown>;

type PublicApiDbClient = {
  fixture: {
    findMany(args: any): Promise<PublicFixtureRow[]>;
  };
  matchState: {
    findUnique(args: {
      where: { fixtureId: string };
      select: {
        homeScore: true;
      awayScore: true;
      phase: true;
      minute?: true;
      lastDataReceivedAt: true;
      };
    }): Promise<{
      homeScore: number | null;
      awayScore: number | null;
      phase: string | null;
      minute?: number | null;
      lastDataReceivedAt: Date | null;
    } | null>;
    findMany?: (args: {
      where: { fixtureId: { in: string[] } };
      select: {
        fixtureId: true;
        homeScore: true;
        awayScore: true;
        phase: true;
        minute?: true;
        lastDataReceivedAt: true;
      };
    }) => Promise<Array<{
      fixtureId: string;
      homeScore: number | null;
      awayScore: number | null;
      phase: string | null;
      minute?: number | null;
      lastDataReceivedAt: Date | null;
    }>>;
  };
  oddsSnapshot: {
    count(args: { where: { fixtureId: string } }): Promise<number>;
    groupBy?: (args: any) => Promise<any[]>;
  };
  matchEvent?: {
    groupBy: (args: any) => Promise<any[]>;
  };
};

export type PublicMatchSummary = {
  fixture_id: string;
  catalog_identity: string;
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
  lifecycle: CanonicalMatchState["lifecycle"];
  provider_status_safe: string;
  availability: {
    score: PublicAvailabilityStatus;
    odds: PublicAvailabilityStatus;
    events: PublicAvailabilityStatus;
  };
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
    next_cursor?: string | null;
    has_more?: boolean;
    range?: PublicMatchesRange;
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
  cursor?: unknown;
}): {
  range: PublicMatchesRange;
  competitionId?: string;
  limit: number;
  includeInsight: boolean;
  cursor?: string;
} {
  const range = typeof query.range === "string" && query.range.trim() !== ""
    ? query.range.trim().toLowerCase()
    : "all";

  if (!["past", "upcoming", "live", "starting_soon", "recently_finished", "interrupted", "all"].includes(range)) {
    throw new PublicApiValidationError("range must be one of: live, starting_soon, upcoming, recently_finished, interrupted, all.");
  }

  const competitionId = typeof query.competitionId === "string" && query.competitionId.trim() !== ""
    ? query.competitionId.trim()
    : typeof query.competitionId === "number" && Number.isFinite(query.competitionId)
      ? String(query.competitionId)
    : undefined;

  const cursor = typeof query.cursor === "string" && query.cursor.trim() !== "" ? query.cursor.trim() : undefined;
  return {
    range: range as PublicMatchesRange,
    competitionId,
    limit: normalizeLimit(query.limit, 20, 100),
    includeInsight: readBoolean(query.includeInsight, false),
    cursor
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

type PublicSeekCursor = {
  version: 2;
  range: PublicMatchesRange;
  snapshot_at: string;
  primary_sort_value: number | null;
  secondary_sort_value: number | null;
  fixture_id: string;
  direction: "asc" | "desc";
};

function encodePublicSeekCursor(cursor: PublicSeekCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodePublicSeekCursor(value: string | undefined, range: PublicMatchesRange): PublicSeekCursor | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PublicSeekCursor>;
    if (parsed.version !== 2 || parsed.range !== range || typeof parsed.fixture_id !== "string" ||
      typeof parsed.snapshot_at !== "string" || !Number.isFinite(Date.parse(parsed.snapshot_at)) ||
      (parsed.primary_sort_value !== null && typeof parsed.primary_sort_value !== "number") ||
      (parsed.secondary_sort_value !== null && typeof parsed.secondary_sort_value !== "number") ||
      (parsed.direction !== "asc" && parsed.direction !== "desc")) {
      throw new Error("invalid cursor");
    }
    return parsed as PublicSeekCursor;
  } catch {
    throw new PublicApiValidationError("cursor is invalid or belongs to another range.");
  }
}

function normalizedCatalogText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function fixtureCatalogBaseKey(fixture: PublicFixtureRow): string {
  if (fixture.competition === null || fixture.homeTeam === null || fixture.awayTeam === null) return `incomplete|${fixture.fixtureId}`;
  return [
    normalizedCatalogText(fixture.sport ?? "soccer"),
    normalizedCatalogText(fixture.competition),
    normalizedCatalogText(fixture.homeTeam),
    normalizedCatalogText(fixture.awayTeam)
  ].join("|");
}

function fixtureCatalogStage(fixture: PublicFixtureRow): string {
  return normalizedCatalogText(fixture.stage);
}

function fixtureStartMs(fixture: PublicFixtureRow): number | null {
  const value = fixture.startTimeUtc?.getTime() ?? null;
  return value !== null && Number.isFinite(value) ? value : null;
}

function publicCatalogIdentity(fixture: PublicFixtureRow): string {
  if (fixture.catalogIdentity !== undefined) return fixture.catalogIdentity;
  const start = fixtureStartMs(fixture);
  // This is only an opaque public identity hint. Actual duplicate matching is
  // interval-based below; rounding must never be used as the match condition.
  const canonicalStart = start === null ? "unknown" : String(Math.round(start / 300_000));
  return `mc_${createHash("sha256").update([fixtureCatalogBaseKey(fixture), fixtureCatalogStage(fixture), canonicalStart].join("|"), "utf8").digest("hex").slice(0, 24)}`;
}

function hasConflictingScoreEvidence(left: PublicFixtureRow, right: PublicFixtureRow): boolean {
  const leftSignals = left.__signals;
  const rightSignals = right.__signals;
  if (leftSignals?.home_score !== null && leftSignals?.home_score !== undefined &&
    rightSignals?.home_score !== null && rightSignals?.home_score !== undefined &&
    leftSignals.home_score !== rightSignals.home_score) return true;
  if (leftSignals?.away_score !== null && leftSignals?.away_score !== undefined &&
    rightSignals?.away_score !== null && rightSignals?.away_score !== undefined &&
    leftSignals.away_score !== rightSignals.away_score) return true;
  return false;
}

function hasConflictingLifecycleEvidence(left: PublicFixtureRow, right: PublicFixtureRow): boolean {
  const leftLifecycle = left.__signals?.lifecycle ?? resolveMatchLifecycle({ providerStatus: left.status, startTimeUtc: left.startTimeUtc });
  const rightLifecycle = right.__signals?.lifecycle ?? resolveMatchLifecycle({ providerStatus: right.status, startTimeUtc: right.startTimeUtc });
  return (leftLifecycle.is_terminal && lifecycleIsLive(rightLifecycle)) || (rightLifecycle.is_terminal && lifecycleIsLive(leftLifecycle));
}

function chooseCatalogRepresentative(current: PublicFixtureRow, candidate: PublicFixtureRow): PublicFixtureRow {
  const score = (fixture: PublicFixtureRow): number[] => {
    const signals = fixture.__signals;
    const lifecycle = signals?.lifecycle ?? resolveMatchLifecycle({ providerStatus: fixture.status, startTimeUtc: fixture.startTimeUtc });
    const evidence = lifecycle.is_terminal || lifecycleIsLive(lifecycle) ? 1 : 0;
    const confidence = lifecycle.confidence === "high" ? 3 : lifecycle.confidence === "medium" ? 2 : 1;
    const identity = fixture.competition !== null && fixture.homeTeam !== null && fixture.awayTeam !== null ? 1 : 0;
    const start = fixture.startTimeUtc === null ? 0 : 1;
    return [evidence, confidence, identity, start, signals?.state_available ? 1 : 0, signals?.event_count ?? 0, signals?.odds_count ?? 0, signals?.latest_data_timestamp ?? -Infinity, fixture.updatedAt?.getTime() ?? -Infinity];
  };
  const left = score(current);
  const right = score(candidate);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return (right[index] ?? -Infinity) > (left[index] ?? -Infinity) ? candidate : current;
  }
  return candidate.fixtureId < current.fixtureId ? candidate : current;
}

function deduplicatePublicFixtures(fixtures: PublicFixtureRow[]): { fixtures: PublicFixtureRow[]; deduplicatedCount: number } {
  const clusters = new Map<string, Array<{ fixtures: PublicFixtureRow[]; minStart: number; maxStart: number }>>();
  for (const fixture of fixtures) {
    const baseKey = fixtureCatalogBaseKey(fixture);
    const start = fixtureStartMs(fixture);
    const stage = fixtureCatalogStage(fixture);
    const candidates = clusters.get(baseKey) ?? [];
    let matched: { fixtures: PublicFixtureRow[]; minStart: number; maxStart: number } | undefined;
    if (start !== null) {
      matched = candidates.find((cluster) => {
        if (cluster.minStart === Number.NEGATIVE_INFINITY || cluster.maxStart === Number.POSITIVE_INFINITY) return false;
        if (start - cluster.minStart > 5 * 60_000 || cluster.maxStart - start > 5 * 60_000) return false;
        return cluster.fixtures.every((member) => {
          const memberStage = fixtureCatalogStage(member);
          const stageConflict = stage !== "" && memberStage !== "" && stage !== memberStage;
          return !stageConflict && !hasConflictingScoreEvidence(member, fixture) && !hasConflictingLifecycleEvidence(member, fixture);
        });
      });
    }
    if (matched === undefined) {
      const cluster = { fixtures: [fixture], minStart: start ?? Number.NEGATIVE_INFINITY, maxStart: start ?? Number.POSITIVE_INFINITY };
      candidates.push(cluster);
      clusters.set(baseKey, candidates);
    } else {
      matched.fixtures.push(fixture);
      matched.minStart = Math.min(matched.minStart, start ?? matched.minStart);
      matched.maxStart = Math.max(matched.maxStart, start ?? matched.maxStart);
    }
  }
  const representatives: PublicFixtureRow[] = [];
  for (const groups of clusters.values()) {
    for (const cluster of groups) {
      const representative = cluster.fixtures.reduce((current, candidate) => chooseCatalogRepresentative(current, candidate));
      representative.catalogIdentity = publicCatalogIdentity(representative);
      representatives.push(representative);
    }
  }
  return { fixtures: representatives, deduplicatedCount: Math.max(0, fixtures.length - representatives.length) };
}

function lifecyclePriority(lifecycle: ReturnType<typeof resolveMatchLifecycle>): number {
  const priorities: Record<string, number> = { penalties: 6, extra_time: 5, live_second_half: 4, halftime: 3, live_first_half: 2, unknown_in_progress: 1 };
  return priorities[lifecycle.lifecycle] ?? 0;
}

function publicSortValues(fixture: PublicFixtureRow, range: PublicMatchesRange): { primary: number | null; secondary: number | null; direction: "asc" | "desc" } {
  const signals = fixture.__signals;
  const lifecycle = signals?.lifecycle ?? resolveMatchLifecycle({ providerStatus: fixture.status, startTimeUtc: fixture.startTimeUtc });
  const start = fixture.startTimeUtc?.getTime() ?? null;
  if (range === "live") return { primary: lifecyclePriority(lifecycle) * 1_000_000 + (signals?.minute ?? -1), secondary: signals?.latest_data_timestamp ?? null, direction: "desc" };
  if (range === "past" || range === "recently_finished") return { primary: signals?.latest_data_timestamp ?? fixture.updatedAt?.getTime() ?? start, secondary: start, direction: "desc" };
  if (range === "interrupted") return { primary: fixture.updatedAt?.getTime() ?? signals?.latest_data_timestamp ?? null, secondary: start, direction: "desc" };
  return { primary: start, secondary: null, direction: "asc" };
}

function comparePublicFixtures(left: PublicFixtureRow, right: PublicFixtureRow, range: PublicMatchesRange): number {
  const a = publicSortValues(left, range);
  const b = publicSortValues(right, range);
  const direction = a.direction === "desc" ? -1 : 1;
  const primaryA = a.primary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  const primaryB = b.primary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  if (primaryA !== primaryB) return (primaryA - primaryB) * direction;
  const secondaryA = a.secondary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  const secondaryB = b.secondary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  if (secondaryA !== secondaryB) return (secondaryA - secondaryB) * direction;
  return direction < 0 ? right.fixtureId.localeCompare(left.fixtureId) : left.fixtureId.localeCompare(right.fixtureId);
}

function fixtureIsAfterCursor(fixture: PublicFixtureRow, cursor: PublicSeekCursor, range: PublicMatchesRange): boolean {
  const values = publicSortValues(fixture, range);
  const direction = cursor.direction === "desc" ? -1 : 1;
  const primary = values.primary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  const cursorPrimary = cursor.primary_sort_value ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  if (primary !== cursorPrimary) return direction < 0 ? primary < cursorPrimary : primary > cursorPrimary;
  const secondary = values.secondary ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  const cursorSecondary = cursor.secondary_sort_value ?? (direction < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  if (secondary !== cursorSecondary) return direction < 0 ? secondary < cursorSecondary : secondary > cursorSecondary;
  return direction < 0 ? fixture.fixtureId < cursor.fixture_id : fixture.fixtureId > cursor.fixture_id;
}

function missingUpcomingDayWarnings(fixtures: PublicFixtureRow[], now: Date): string[] {
  const horizon = Math.max(1, Math.min(31, Math.trunc(Number(process.env.MATCHPULSE_DISCOVERY_FUTURE_DAYS) || 14)));
  const days = new Set(fixtures.map((fixture) => {
    const start = fixture.startTimeUtc?.getTime();
    return start === undefined || !Number.isFinite(start) ? null : Math.floor(start / 86_400_000);
  }).filter((day): day is number => day !== null));
  const today = Math.floor(now.getTime() / 86_400_000);
  return Array.from({ length: horizon + 1 }, (_, offset) => today + offset)
    .filter((day) => !days.has(day))
    .map((day) => new Date(day * 86_400_000).toISOString().slice(0, 10));
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
  if (state.lifecycle) return lifecycleIsRecentlyFinished(state.lifecycle) || state.lifecycle.is_terminal;
  const token = readStatusToken(state);
  if (pastStatusTokens.has(token)) return true;

  const startTime = parseTimestamp(state.identity.start_time_utc);
  return startTime !== null && startTime < now.getTime() && !liveStatusTokens.has(token);
}

function isLiveState(state: CanonicalMatchState): boolean {
  if (state.lifecycle) return lifecycleIsLive(state.lifecycle);
  const token = readStatusToken(state);
  return liveStatusTokens.has(token);
}

function isUpcomingState(state: CanonicalMatchState, now: Date): boolean {
  if (state.lifecycle) return lifecycleIsUpcoming(state.lifecycle);
  if (isLiveState(state) || isPastState(state, now)) return false;
  const startTime = parseTimestamp(state.identity.start_time_utc);
  return startTime !== null && startTime > now.getTime();
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
  const lifecycle = fixture.__signals?.lifecycle ?? resolveMatchLifecycle({ providerStatus: fixture.status, startTimeUtc: fixture.startTimeUtc, now, captureLeadMinutes: 60 });
  const isLive = lifecycleIsLive(lifecycle);
  const isPast = lifecycleIsRecentlyFinished(lifecycle) || lifecycle.is_terminal;
  const isUpcoming = lifecycleIsUpcoming(lifecycle);
  const isInterrupted = lifecycle.lifecycle === "postponed" || lifecycle.lifecycle === "cancelled" || lifecycle.lifecycle === "abandoned";

  if (range === "live") return isLive;
  if (range === "starting_soon") {
    const start = fixture.startTimeUtc?.getTime() ?? Number.NaN;
    return isUpcoming && Number.isFinite(start) && start <= now.getTime() + 2 * 60 * 60_000;
  }
  if (range === "past") return isPast && !isInterrupted;
  if (range === "recently_finished") {
    const start = fixture.startTimeUtc?.getTime() ?? Number.NaN;
    return isPast && !isInterrupted && Number.isFinite(start) && start >= now.getTime() - 48 * 60 * 60_000 && start <= now.getTime();
  }
  if (range === "interrupted") return isInterrupted;
  return isUpcoming;
}

function buildPublicFixtureWhere(
  range: PublicMatchesRange,
  competitionId: string | undefined,
  now: Date
): PublicFixtureWhere | undefined {
  const startTimeUtc = ["upcoming", "starting_soon"].includes(range)
    ? { gte: now }
    : ["past", "recently_finished"].includes(range)
      ? { ...(range === "recently_finished" ? { gte: new Date(now.getTime() - 48 * 60 * 60_000) } : {}), lt: now }
      : undefined;

  if (competitionId === undefined && startTimeUtc === undefined) {
    return undefined;
  }

  return {
    ...(competitionId === undefined ? {} : { competition: competitionId }),
    ...(startTimeUtc === undefined ? {} : { startTimeUtc })
  };
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
  const lifecycle = state.lifecycle ?? resolveMatchLifecycle({
    providerStatus: state.identity.status,
    startTimeUtc: state.identity.start_time_utc
  });
  const output: PublicMatchSummary = {
    fixture_id: state.fixture_id,
    catalog_identity: publicCatalogIdentity({ fixtureId: state.fixture_id, competition: state.identity.competition, homeTeam: state.identity.home_team, awayTeam: state.identity.away_team, startTimeUtc: state.identity.start_time_utc === null ? null : new Date(state.identity.start_time_utc), status: state.identity.status }),
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
    latest_data_timestamp: state.freshness.latest_data_timestamp,
    lifecycle,
    provider_status_safe: normalizeProviderStatus(state.identity.status).normalized_status,
    availability: {
      score: state.scoreboard.available ? "available" : lifecycleIsUpcoming(lifecycle) ? "not_expected_yet" : "upstream_no_data",
      odds: state.odds.available ? "available" : lifecycleIsUpcoming(lifecycle) ? "not_expected_yet" : "upstream_no_data",
      events: lifecycleIsUpcoming(lifecycle) ? "not_expected_yet" : "not_attempted"
    }
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
  signals?: PublicCatalogSignals;
  now: Date;
}): PublicMatchSummary {
  const lifecycle = resolveMatchLifecycle({
    providerStatus: input.fixture.status,
    persistedPhase: input.matchState?.phase,
    startTimeUtc: input.fixture.startTimeUtc,
    now: input.now,
    captureLeadMinutes: 60,
    captureTailMinutes: 180
  });
  const stale = (timestamp: number | null) => timestamp !== null && input.now.getTime() - timestamp > 60 * 60_000;
  const noDataStatus = (error: boolean | undefined, timestamp: number | null): PublicAvailabilityStatus => error ? "upstream_error" : stale(timestamp) ? "stale" : lifecycleIsUpcoming(lifecycle) ? "not_expected_yet" : "upstream_no_data";
  const availability = {
    score: lifecycleIsUpcoming(lifecycle) ? input.hasScoreboard && !stale(input.signals?.latest_data_timestamp ?? null) ? "available" : "not_expected_yet" : input.hasScoreboard ? stale(input.signals?.latest_data_timestamp ?? null) ? "stale" : "available" : noDataStatus(input.signals?.state_error, null),
    odds: lifecycleIsUpcoming(lifecycle) ? input.hasOdds && !stale(input.signals?.odds_latest_timestamp ?? null) ? "available" : "not_expected_yet" : input.hasOdds ? stale(input.signals?.odds_latest_timestamp ?? null) ? "stale" : "available" : noDataStatus(input.signals?.odds_error, null),
    events: input.signals?.event_count && input.signals.event_count > 0
      ? stale(input.signals.event_latest_timestamp) ? "stale" : "available"
      : input.signals?.event_error ? "upstream_error" : lifecycleIsUpcoming(lifecycle) ? "not_expected_yet" : input.signals === undefined ? "not_attempted" : "upstream_no_data"
  } satisfies Record<keyof PublicMatchSummary["availability"], PublicAvailabilityStatus>;
  return sanitizeAndAssertPublicPayload({
    fixture_id: input.fixture.fixtureId,
    catalog_identity: input.fixture.catalogIdentity ?? publicCatalogIdentity(input.fixture),
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
    latest_data_timestamp: input.latestDataTimestamp,
    lifecycle: {
      lifecycle: lifecycle.lifecycle,
      source: lifecycle.source,
      reason_code: lifecycle.reason_code,
      normalized_phase: lifecycle.normalized_phase,
      is_active: lifecycle.is_active,
      is_terminal: lifecycle.is_terminal,
      updated_at: lifecycle.updated_at
    },
    provider_status_safe: normalizeProviderStatus(input.fixture.status).normalized_status,
    availability
  });
}

type BatchStateRow = { fixtureId: string; homeScore: number | null; awayScore: number | null; phase: string | null; lastDataReceivedAt: Date | null; minute?: number | null };
type BatchAggregateRow = { fixtureId: string; _count: { _all: number }; _max?: { sourceTimestamp: Date | null } };

async function enrichPublicFixtureSignals(
  fixtures: PublicFixtureRow[],
  deps: PublicApiDependencies,
  now: Date
): Promise<PublicFixtureRow[]> {
  if (fixtures.length === 0) return fixtures;
  const db = deps.getDbClient();
  const ids = fixtures.map((fixture) => fixture.fixtureId);
  const states = new Map<string, BatchStateRow>();
  const odds = new Map<string, BatchAggregateRow>();
  const events = new Map<string, BatchAggregateRow>();
  let stateError = false;
  let oddsError = false;
  let eventError = false;

  if (db.matchState.findMany !== undefined) {
    try {
      const rows = await db.matchState.findMany({ where: { fixtureId: { in: ids } }, select: { fixtureId: true, homeScore: true, awayScore: true, phase: true, minute: true, lastDataReceivedAt: true } });
      for (const row of rows) states.set(row.fixtureId, row);
    } catch { stateError = true; }
  } else {
    await Promise.all(ids.map(async (fixtureId) => {
      try {
        const row = await db.matchState.findUnique({ where: { fixtureId }, select: { homeScore: true, awayScore: true, phase: true, lastDataReceivedAt: true } });
        if (row !== null) states.set(fixtureId, { fixtureId, ...row });
      } catch { stateError = true; }
    }));
  }
  const oddsGroupBy = db.oddsSnapshot.groupBy;
  if (oddsGroupBy !== undefined) {
    try {
      const rows = await oddsGroupBy({ by: ["fixtureId"], where: { fixtureId: { in: ids } }, _count: { _all: true }, _max: { sourceTimestamp: true } });
      for (const row of rows) odds.set(row.fixtureId, row);
    } catch { oddsError = true; }
  } else {
    await Promise.all(ids.map(async (fixtureId) => {
      try { const count = await db.oddsSnapshot.count({ where: { fixtureId } }); if (count > 0) odds.set(fixtureId, { fixtureId, _count: { _all: count } }); }
      catch { oddsError = true; }
    }));
  }
  if (db.matchEvent?.groupBy !== undefined) {
    try {
      const rows = await db.matchEvent.groupBy({ by: ["fixtureId"], where: { fixtureId: { in: ids } }, _count: { _all: true }, _max: { sourceTimestamp: true } });
      for (const row of rows) events.set(row.fixtureId, row);
    } catch { eventError = true; }
  }
  return fixtures.map((fixture) => {
    const state = states.get(fixture.fixtureId);
    const oddsRow = odds.get(fixture.fixtureId);
    const eventRow = events.get(fixture.fixtureId);
    const lifecycle = resolveMatchLifecycle({ providerStatus: fixture.status, persistedPhase: state?.phase, startTimeUtc: fixture.startTimeUtc, now, captureLeadMinutes: 60, captureTailMinutes: 180 });
    const stateTimestamp = state?.lastDataReceivedAt === null || state?.lastDataReceivedAt === undefined ? null : parseTimestamp(toIsoTimestamp(state.lastDataReceivedAt));
    const timestamps = [stateTimestamp, oddsRow?._max?.sourceTimestamp?.getTime() ?? null, eventRow?._max?.sourceTimestamp?.getTime() ?? null].filter((value): value is number => value !== null && Number.isFinite(value));
    return {
      ...fixture,
      __signals: {
        lifecycle,
        state_available: state !== undefined,
        home_score: state?.homeScore ?? null,
        away_score: state?.awayScore ?? null,
        phase: state?.phase ?? null,
        minute: state?.minute ?? null,
        latest_data_timestamp: timestamps.length === 0 ? null : Math.max(...timestamps),
        odds_count: oddsRow?._count._all ?? 0,
        odds_latest_timestamp: oddsRow?._max?.sourceTimestamp?.getTime() ?? null,
        event_count: eventRow?._count._all ?? 0,
        event_latest_timestamp: eventRow?._max?.sourceTimestamp?.getTime() ?? null,
        state_error: stateError,
        odds_error: oddsError,
        event_error: eventError,
        enrichment_error: stateError || oddsError || eventError
      }
    };
  });
}

async function buildPublicMatchSummaries(
  fixtures: PublicFixtureRow[],
  normalized: ReturnType<typeof normalizePublicMatchesQuery>,
  deps: PublicApiDependencies,
  now: Date
): Promise<PublicMatchSummary[]> {
  const filteredFixtures = fixtures.filter((fixture) => fixtureMatchesRequestedRange(fixture, normalized.range, now));
  const summaries = await Promise.all(filteredFixtures.map(async (fixture) => {
    const signals = fixture.__signals;
    let matchState: Awaited<ReturnType<PublicApiDbClient["matchState"]["findUnique"]>> = signals?.state_available ? { homeScore: signals.home_score, awayScore: signals.away_score, phase: signals.phase, lastDataReceivedAt: signals.latest_data_timestamp === null ? null : new Date(signals.latest_data_timestamp), minute: signals.minute } : null;
    let oddsCount = signals?.odds_count ?? 0;
    if (signals === undefined) {
      const db = deps.getDbClient();
      try { matchState = await db.matchState.findUnique({ where: { fixtureId: fixture.fixtureId }, select: { homeScore: true, awayScore: true, phase: true, lastDataReceivedAt: true } }); } catch { matchState = null; }
      try { oddsCount = await db.oddsSnapshot.count({ where: { fixtureId: fixture.fixtureId } }); } catch { oddsCount = 0; }
    }
    const hasScoreboard = matchState !== null;
    const hasOdds = oddsCount > 0;
    const hasIdentity = fixture.competition !== null &&
      fixture.homeTeam !== null &&
      fixture.awayTeam !== null;
    const issues: string[] = [];

    const resolvedLifecycle = resolveMatchLifecycle({
      providerStatus: fixture.status,
      persistedPhase: matchState?.phase,
      startTimeUtc: fixture.startTimeUtc,
      now,
      captureLeadMinutes: 60,
      captureTailMinutes: 180
    });
    if (fixture.startTimeUtc !== null && fixture.startTimeUtc.getTime() > now.getTime() &&
      (resolvedLifecycle.is_terminal || lifecycleIsLive(resolvedLifecycle))) {
      issues.push("lifecycle_time_conflict");
    }

    if (!hasScoreboard) issues.push(signals?.state_error ? "scoreboard_upstream_error" : "scoreboard_missing");
    if (!hasOdds) issues.push(signals?.odds_error ? "odds_upstream_error" : "odds_missing");
    if (!hasIdentity) issues.push("identity_incomplete");
    if (!hasScoreboard && !hasOdds) issues.push("no_persisted_data");

    const qualityStatus = !hasScoreboard && !hasOdds
      ? "empty" as const
      : hasScoreboard && hasOdds
        ? "complete" as const
        : "partial" as const;
    const insightIssues = [...issues];
    const latestDataTimestamp = signals?.latest_data_timestamp === null || signals?.latest_data_timestamp === undefined
      ? toIsoTimestamp(matchState?.lastDataReceivedAt)
      : new Date(signals.latest_data_timestamp).toISOString();
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
      latestDataTimestamp,
      signals,
      now
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

type PublicCatalogScan = {
  fixtures: PublicFixtureRow[];
  scanned_count: number;
  snapshot_at: string;
  scan_budget: number;
  scan_budget_exhausted: boolean;
};

async function scanPublicCatalog(
  normalized: ReturnType<typeof normalizePublicMatchesQuery>,
  deps: PublicApiDependencies,
  snapshotAt: Date,
  now: Date
): Promise<PublicCatalogScan> {
  const db = deps.getDbClient();
  const pageSize = 250;
  const scanBudget = Math.max(pageSize, Math.min(250_000, Math.trunc(Number(process.env.MATCHPULSE_CATALOG_SCAN_BUDGET) || 100_000)));
  const fixtures: PublicFixtureRow[] = [];
  let cursorId: string | undefined;
  let scanned = 0;
  let exhausted = false;
  while (scanned < scanBudget) {
    const remaining = Math.min(pageSize, scanBudget - scanned);
    const rows = await db.fixture.findMany({
      where: {
        ...(buildPublicFixtureWhere(normalized.range, normalized.competitionId, now) ?? {}),
        createdAt: { lte: snapshotAt },
        updatedAt: { lte: snapshotAt }
      },
      // Scan in the same unique order used by the database cursor. The catalog
      // is sorted after enrichment, so this traversal order is only a stable
      // bounded walk and must not be mixed with start-time ordering.
      orderBy: { fixtureId: "asc" },
      ...(cursorId === undefined ? {} : { cursor: { fixtureId: cursorId }, skip: 1 }),
      take: remaining,
      select: { fixtureId: true, sport: true, stage: true, competition: true, homeTeam: true, awayTeam: true, startTimeUtc: true, status: true, createdAt: true, updatedAt: true }
    });
    if (rows.length === 0) { exhausted = true; break; }
    fixtures.push(...rows);
    scanned += rows.length;
    const nextId = rows[rows.length - 1]?.fixtureId;
    if (nextId === undefined || nextId === cursorId) { exhausted = true; break; }
    cursorId = nextId;
    if (rows.length < remaining) { exhausted = true; break; }
  }
  return { fixtures, scanned_count: scanned, snapshot_at: snapshotAt.toISOString(), scan_budget: scanBudget, scan_budget_exhausted: !exhausted && scanned >= scanBudget };
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
      cursor?: unknown;
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

      const cursor = decodePublicSeekCursor(normalized.cursor, normalized.range);
      const now = deps.now();
      const snapshotAt = cursor === undefined ? now : new Date(cursor.snapshot_at);
      const effectiveNow = snapshotAt;
      const scan = await scanPublicCatalog(normalized, deps, snapshotAt, effectiveNow);
      const enriched = await enrichPublicFixtureSignals(scan.fixtures, deps, effectiveNow);
      const rangeCandidates = enriched.filter((fixture) => fixtureMatchesRequestedRange(fixture, normalized.range, effectiveNow));
      const deduplicated = deduplicatePublicFixtures(rangeCandidates);
      const sorted = deduplicated.fixtures.sort((left, right) => comparePublicFixtures(left, right, normalized.range));
      const afterCursor = cursor === undefined ? sorted : sorted.filter((fixture) => fixtureIsAfterCursor(fixture, cursor, normalized.range));
      const pageFixtures = afterCursor.slice(0, normalized.limit + 1);
      const hasMore = pageFixtures.length > normalized.limit || scan.scan_budget_exhausted;
      const visibleFixtures = pageFixtures.slice(0, normalized.limit);
      const data = await buildPublicMatchSummaries(visibleFixtures, normalized, deps, effectiveNow);
      const lastFixture = visibleFixtures[visibleFixtures.length - 1];
      const lastSort = lastFixture === undefined ? null : publicSortValues(lastFixture, normalized.range);
      return {
        data,
        meta: {
          status: data.length > 0 ? "live" as const : "no_data" as const,
          source: "database" as const,
          mode: "public" as const,
          next_cursor: hasMore && lastFixture !== undefined
            ? encodePublicSeekCursor({ version: 2, range: normalized.range, snapshot_at: scan.snapshot_at, primary_sort_value: lastSort?.primary ?? null, secondary_sort_value: lastSort?.secondary ?? null, fixture_id: lastFixture.fixtureId, direction: lastSort?.direction ?? "asc" })
            : null,
          has_more: hasMore,
          range: normalized.range,
          generated_at: now.toISOString(),
          result_count: data.length,
          deduplicated_count: deduplicated.deduplicatedCount,
          scanned_count: scan.scanned_count,
          snapshot_at: scan.snapshot_at,
          cursor_version: 2,
          data_status: data.length === visibleFixtures.length && !scan.scan_budget_exhausted ? "complete" as const : "partial" as const,
          source_rows_scanned: scan.scanned_count,
          representatives_returned: sorted.length,
          duplicate_rows_suppressed: deduplicated.deduplicatedCount,
          lifecycle_rows_excluded: Math.max(0, enriched.length - rangeCandidates.length),
          cursor_rows_excluded: Math.max(0, sorted.length - afterCursor.length),
          earliest_returned_start: visibleFixtures[0]?.startTimeUtc?.toISOString() ?? null,
          latest_returned_start: visibleFixtures[visibleFixtures.length - 1]?.startTimeUtc?.toISOString() ?? null,
          missing_day_warnings: normalized.range === "upcoming" ? missingUpcomingDayWarnings(sorted, effectiveNow) : []
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
