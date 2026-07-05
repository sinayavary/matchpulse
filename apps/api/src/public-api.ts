import type { FastifyInstance, FastifyReply } from "fastify";
import { getAgentPresenterBriefForFixture, type AgentPresenterResponse } from "./agent-presenter-v0.js";
import { buildDemoReadiness } from "./demo-bundle.js";
import { getDbClient } from "./db.js";
import {
  buildCanonicalMatchState,
  getDbBackedMatchState,
  type CanonicalMatchState,
  type MatchStateBuilderOptions
} from "./match-state-builder.js";
import {
  SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS,
  assertNoForbiddenSignalFields
} from "./signalcore-contract.js";

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
};

export type PublicStatusResponse = {
  data: {
    service: "matchpulse-api";
    ok: true;
    public_api_version: "public-v0";
    demo_available: true;
  };
  meta: {
    status: "live";
    source: "database";
    mode: PublicApiMode;
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
      oddsLimit?: number;
      staleAfterMinutes?: number;
      format?: "compact" | "full";
    }
  ) => Promise<AgentPresenterResponse>;
  now: () => Date;
};

const defaultDependencies: PublicApiDependencies = {
  getDbClient,
  getDbBackedMatchState,
  getAgentPresenterBriefForFixture,
  now: () => new Date()
};

const forbiddenPublicFields = new Set<string>(
  SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS.map((field) => field.toLowerCase())
);

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

export function normalizePublicMatchesQuery(query: {
  range?: unknown;
  competitionId?: unknown;
  limit?: unknown;
}): {
  range: PublicMatchesRange;
  competitionId?: string;
  limit: number;
} {
  const range = typeof query.range === "string" && query.range.trim() !== ""
    ? query.range.trim().toLowerCase()
    : "all";

  if (!["past", "upcoming", "live", "all"].includes(range)) {
    throw new PublicApiValidationError("range must be one of: past, upcoming, live, all.");
  }

  const competitionId = typeof query.competitionId === "string" && query.competitionId.trim() !== ""
    ? query.competitionId.trim()
    : undefined;

  return {
    range: range as PublicMatchesRange,
    competitionId,
    limit: normalizeLimit(query.limit, 20, 100)
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

export function stripForbiddenFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenFields(item)) as T;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenPublicFields.has(key.toLowerCase())) continue;
    output[key] = stripForbiddenFields(nested);
  }
  return output as T;
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

export function buildPublicStatusResponse(): PublicStatusResponse {
  const output: PublicStatusResponse = {
    data: {
      service: "matchpulse-api",
      ok: true,
      public_api_version: "public-v0",
      demo_available: true
    },
    meta: {
      status: "live",
      source: "database",
      mode: "public"
    }
  };
  assertNoForbiddenSignalFields(output);
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
  assertNoForbiddenSignalFields(output);
  return output;
}

export function buildPublicMatchResponse(input: {
  state: CanonicalMatchState;
  staleAfterMinutes: number;
  now: Date;
  message?: string;
}): PublicMatchResponse {
  const output: PublicMatchResponse = {
    data: stripForbiddenFields(input.state),
    meta: {
      status: toPublicMetaStatus(input.state, input.staleAfterMinutes, input.now),
      source: "database",
      mode: "public",
      ...(input.message === undefined ? {} : { message: input.message })
    }
  };
  assertNoForbiddenSignalFields(output);
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

  const output: PublicBundleResponse = {
    data: stripForbiddenFields({
      fixture_id: input.presenterOutput.data.fixture_id,
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
  assertNoForbiddenSignalFields(output);
  return output;
}

async function readPublicMatchState(
  fixtureId: string,
  options: ReturnType<typeof normalizePublicMatchQuery>,
  dependencies: PublicApiDependencies
): Promise<CanonicalMatchState> {
  if (!process.env.DATABASE_URL) {
    return buildCanonicalMatchState({
      fixtureId,
      fixture: null,
      scoreboard: null,
      odds: [],
      includeOdds: options.includeOdds
    });
  }

  try {
    return await dependencies.getDbBackedMatchState(fixtureId, options);
  } catch {
    return buildCanonicalMatchState({
      fixtureId,
      fixture: null,
      scoreboard: null,
      odds: [],
      includeOdds: options.includeOdds
    });
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
    };

    let normalized: ReturnType<typeof normalizePublicMatchesQuery>;
    try {
      normalized = normalizePublicMatchesQuery(query);
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
      throw error;
    }

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

    try {
      const now = deps.now();
      const candidates = await deps.getDbClient().fixture.findMany({
        where: normalized.competitionId === undefined
          ? undefined
          : { competition: normalized.competitionId },
        orderBy: { startTimeUtc: normalized.range === "past" ? "desc" : "asc" },
        take: normalized.range === "live"
          ? Math.min(normalized.limit * 5, 500)
          : Math.min(normalized.limit * 3, 300),
        select: {
          fixtureId: true,
          competition: true,
          homeTeam: true,
          awayTeam: true,
          startTimeUtc: true,
          status: true
        }
      });

      const summaries: PublicMatchSummary[] = [];
      for (const fixture of candidates) {
        const state = await deps.getDbBackedMatchState(fixture.fixtureId, {
          includeOdds: true,
          oddsLimit: 50
        });
        if (!matchesRequestedRange(state, normalized.range, now)) continue;
        summaries.push(buildPublicMatchSummary(state));
        if (summaries.length >= normalized.limit) break;
      }

      const output: PublicMatchesResponse = {
        data: stripForbiddenFields(summaries),
        meta: {
          status: summaries.length > 0 ? "live" : "no_data",
          source: "database",
          mode: "public"
        }
      };
      assertNoForbiddenSignalFields(output);
      return output;
    } catch {
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
    const state = await readPublicMatchState(fixtureId, normalized, deps);

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
}
