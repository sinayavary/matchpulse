import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { AgentPresenterResponse } from "./agent-presenter-v0.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import {
  buildPublicBundleResponse,
  buildPublicMatchSummary,
  registerPublicApiRoutes
} from "./public-api.js";
import { SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS, assertNoForbiddenSignalFields } from "./signalcore-contract.js";

function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  const baseIdentity: CanonicalMatchState["identity"] = {
    fixture_id: "17952170",
    competition: "Friendlies",
    home_team: "Slovenia",
    away_team: "Cyprus",
    start_time_utc: "2026-06-04T16:00:00.000Z",
    status: "UNKNOWN"
  };
  const baseScoreboard: CanonicalMatchState["scoreboard"] = {
    available: true,
    home_score: 1,
    away_score: 1,
    phase: "unknown",
    last_data_received_at: "2026-06-04T18:04:23.367Z"
  };
  const baseOdds: CanonicalMatchState["odds"] = {
    available: true,
    count: 1,
    markets: [{
      market_id: "1x2",
      market_name: "Match Result",
      selection_name: "Home",
      odds: 2.2,
      direction: "stable",
      source_timestamp: "2026-06-04T18:00:00.000Z"
    }]
  };
  const baseFreshness: CanonicalMatchState["freshness"] = {
    built_at: "2026-06-04T18:05:00.000Z",
    latest_score_timestamp: "2026-06-04T18:04:23.367Z",
    latest_odds_timestamp: "2026-06-04T18:00:00.000Z",
    latest_data_timestamp: "2026-06-04T18:04:23.367Z"
  };
  const baseQuality: CanonicalMatchState["quality"] = {
    status: "complete",
    has_fixture: true,
    has_scoreboard: true,
    has_odds: true,
    issues: []
  };

  const baseState: CanonicalMatchState = {
    fixture_id: "17952170",
    identity: baseIdentity,
    scoreboard: baseScoreboard,
    odds: baseOdds,
    freshness: baseFreshness,
    quality: baseQuality
  };

  return {
    ...baseState,
    ...overrides,
    identity: { ...baseIdentity, ...overrides.identity },
    scoreboard: { ...baseScoreboard, ...overrides.scoreboard },
    odds: { ...baseOdds, ...overrides.odds },
    freshness: { ...baseFreshness, ...overrides.freshness },
    quality: { ...baseQuality, ...overrides.quality }
  };
}

function makePresenterOutput(state: CanonicalMatchState): AgentPresenterResponse {
  return {
    data: {
      fixture_id: state.fixture_id,
      agent_version: "presenter-v0",
      brief: {
        status_label: state.quality.status === "complete"
          ? "ready"
          : state.quality.status === "partial" ? "partial" : "empty",
        headline: "Safe headline",
        overview: "Safe overview",
        available_data: ["Fixture identity is available."],
        missing_data: [],
        freshness_note: "Latest persisted data is within the freshness window.",
        quality_notes: ["Data is available for safe display."],
        safe_scope_note:
          "This brief only describes data availability, freshness, and quality."
      },
      signal_summary: {
        status: state.quality.status === "complete"
          ? "ready"
          : state.quality.status === "partial" ? "partial" : "empty",
        signal_count: 1,
        critical_count: 0,
        warning_count: 0,
        info_count: 1,
        has_fixture: state.quality.has_fixture,
        has_scoreboard: state.quality.has_scoreboard,
        has_odds: state.quality.has_odds,
        latest_data_timestamp: state.freshness.latest_data_timestamp
      },
      signals: [{
        type: "DATA_READY",
        severity: "info",
        title: "Data ready",
        message: "Fixture and live data are available."
      }],
      state
    },
    meta: {
      status: "live",
      source: "agent-presenter",
      mode: "internal"
    }
  };
}

function collectKeys(value: unknown): string[] {
  const keys: string[] = [];
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object") return;
    for (const [key, nested] of Object.entries(current)) {
      keys.push(key.toLowerCase());
      visit(nested);
    }
  };
  visit(value);
  return keys;
}

async function withDatabaseUrl<T>(callback: () => Promise<T>): Promise<T> {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://public-api-test";
  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
}

test("public status route returns the safe public-v0 shape", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => [] } }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({ method: "GET", url: "/api/public/status" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
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
    });

    await app.close();
  });
});

test("public match summary only exposes the approved summary fields", () => {
  const unsafeState = makeState() as CanonicalMatchState & {
    probability?: number;
    confidence?: number;
  };
  unsafeState.probability = 0.99;
  unsafeState.confidence = 0.99;
  const summary = buildPublicMatchSummary(unsafeState);

  assert.deepEqual(Object.keys(summary).sort(), [
    "away_team",
    "competition",
    "fixture_id",
    "home_team",
    "latest_data_timestamp",
    "odds",
    "quality",
    "scoreboard",
    "start_time_utc",
    "status"
  ]);
  assertNoForbiddenSignalFields(summary);
});

test("public bundle strips forbidden nested fields before returning", () => {
  const contaminated = makePresenterOutput(makeState()) as AgentPresenterResponse & {
    data: AgentPresenterResponse["data"] & {
      brief: AgentPresenterResponse["data"]["brief"] & { recommendation?: string };
      signals: Array<AgentPresenterResponse["data"]["signals"][number] & { confidence?: number }>;
      state: CanonicalMatchState & { profit?: number };
    };
  };
  contaminated.data.brief.recommendation = "removed";
  contaminated.data.signals = [{
    ...contaminated.data.signals[0],
    confidence: 0.87
  }];
  contaminated.data.state = {
    ...contaminated.data.state,
    profit: 25
  };

  const output = buildPublicBundleResponse({
    presenterOutput: contaminated,
    options: {
      includeState: true,
      includeSignals: true,
      includeBrief: true,
      oddsLimit: 20,
      staleAfterMinutes: 60
    },
    staleAfterMinutes: 60,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  const keys = collectKeys(output);
  assertNoForbiddenSignalFields(output);
  for (const field of SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS) {
    assert.equal(keys.includes(field.toLowerCase()), false);
  }
});

test("unknown fixture is handled safely with a 404 response", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => [] } }),
      getDbBackedMatchState: async (fixtureId) => makeState({
        fixture_id: fixtureId,
        identity: {
          fixture_id: fixtureId,
          competition: null,
          home_team: null,
          away_team: null,
          start_time_utc: null,
          status: null
        },
        scoreboard: {
          available: false,
          home_score: null,
          away_score: null,
          phase: null,
          last_data_received_at: null
        },
        odds: {
          available: false,
          count: 0,
          markets: []
        },
        freshness: {
          built_at: "2026-06-04T18:05:00.000Z",
          latest_score_timestamp: null,
          latest_odds_timestamp: null,
          latest_data_timestamp: null
        },
        quality: {
          status: "empty",
          has_fixture: false,
          has_scoreboard: false,
          has_odds: false,
          issues: [
            "fixture_missing",
            "scoreboard_missing",
            "odds_missing",
            "no_persisted_data"
          ]
        }
      }),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/not-real"
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().meta.message, "Fixture not found.");
    await app.close();
  });
});

test("public match route caps oddsLimit at 50", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const calls: number[] = [];
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => [] } }),
      getDbBackedMatchState: async (_fixtureId, options) => {
        calls.push(options?.oddsLimit ?? -1);
        return makeState();
      },
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170?includeOdds=true&oddsLimit=999"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [50]);
    await app.close();
  });
});

test("public matches route validates range safely", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => [] } }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=bad-value"
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().meta.message, "range must be one of: past, upcoming, live, all.");
    await app.close();
  });
});

test("no public route response contains forbidden keys", async () => {
  await withDatabaseUrl(async () => {
    const state = makeState();
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: {
          findMany: async () => [{
            fixtureId: state.fixture_id,
            competition: state.identity.competition,
            homeTeam: state.identity.home_team,
            awayTeam: state.identity.away_team,
            startTimeUtc: new Date(state.identity.start_time_utc!),
            status: state.identity.status
          }]
        }
      }),
      getDbBackedMatchState: async () => state,
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(state),
      now: () => new Date("2026-06-04T19:00:00.000Z")
    });

    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/api/public/status" }),
      app.inject({ method: "GET", url: "/api/public/matches?range=all&limit=20" }),
      app.inject({ method: "GET", url: "/api/public/matches/17952170?includeOdds=true&oddsLimit=20" }),
      app.inject({ method: "GET", url: "/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20" })
    ]);

    for (const response of responses) {
      const body = response.json();
      assertNoForbiddenSignalFields(body);
      const keys = collectKeys(body);
      for (const field of SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS) {
        assert.equal(keys.includes(field.toLowerCase()), false);
      }
    }

    await app.close();
  });
});
