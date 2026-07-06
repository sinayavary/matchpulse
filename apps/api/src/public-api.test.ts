import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { AgentPresenterResponse } from "./agent-presenter-v0.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import {
  assertNoForbiddenPublicKeys,
  buildPublicBundleResponse,
  normalizePublicBundleQuery,
  normalizePublicMatchQuery,
  normalizePublicMatchesQuery,
  registerPublicApiRoutes,
  sanitizePublicPayload
} from "./public-api.js";
import { SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS } from "./signalcore-contract.js";

type PublicFixtureRow = {
  fixtureId: string;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
};

function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  const baseIdentity: CanonicalMatchState["identity"] = {
    fixture_id: "17952170",
    competition: "Friendlies",
    home_team: "Slovenia",
    away_team: "Cyprus",
    start_time_utc: "2026-06-04T16:00:00.000Z",
    status: "FT"
  };
  const baseScoreboard: CanonicalMatchState["scoreboard"] = {
    available: true,
    home_score: 1,
    away_score: 1,
    phase: "fulltime",
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
          "This brief only describes data availability, freshness, and quality for safe display."
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

function makeFixtureRows(count: number): PublicFixtureRow[] {
  return Array.from({ length: count }, (_, index) => ({
    fixtureId: `fixture-${index + 1}`,
    competition: "Friendlies",
    homeTeam: `Home ${index + 1}`,
    awayTeam: `Away ${index + 1}`,
    startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
    status: "FT"
  }));
}

function makeDbClient(rows: PublicFixtureRow[]) {
  const rowById = new Map(rows.map((row) => [row.fixtureId, row]));
  return {
    fixture: {
      findMany: async () => rows
    },
    matchState: {
      findUnique: async ({ where }: { where: { fixtureId: string } }) => {
        const row = rowById.get(where.fixtureId);
        if (row === undefined) return null;
        return {
          homeScore: 1,
          awayScore: 1,
          phase: "fulltime",
          lastDataReceivedAt: new Date("2026-06-04T18:04:23.367Z")
        };
      }
    },
    oddsSnapshot: {
      count: async ({ where }: { where: { fixtureId: string } }) => (rowById.has(where.fixtureId) ? 1 : 0)
    }
  };
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
      getDbClient: () => makeDbClient([]),
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

test("public meta stays database/public across public routes", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(2)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/api/public/status" }),
      app.inject({ method: "GET", url: "/api/public/matches?range=all&limit=20" }),
      app.inject({ method: "GET", url: "/api/public/matches/17952170?includeOdds=true" }),
      app.inject({ method: "GET", url: "/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true" })
    ]);

    for (const response of responses) {
      const body = response.json();
      assert.equal(body.meta.source, "database");
      assert.equal(body.meta.mode, "public");
    }

    await app.close();
  });
});

test("public matches query normalizes limit default 20", () => {
  assert.equal(normalizePublicMatchesQuery({}).limit, 20);
});

test("public matches query caps limit at 100", () => {
  assert.equal(normalizePublicMatchesQuery({ limit: 9999 }).limit, 100);
});

test("invalid public matches range is handled safely", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
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

test("public match query caps oddsLimit at 50", () => {
  assert.equal(normalizePublicMatchQuery({ oddsLimit: 999 }).oddsLimit, 50);
});

test("public bundle query caps oddsLimit at 50", () => {
  assert.equal(normalizePublicBundleQuery({ oddsLimit: 999 }).oddsLimit, 50);
});

test("single public match route caps oddsLimit at 50", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const calls: number[] = [];
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
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

test("bundle public route caps oddsLimit at 50", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const calls: number[] = [];
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async (_fixtureId, options) => {
        calls.push(options?.oddsLimit ?? -1);
        return makePresenterOutput(makeState());
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=999"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [50]);
    await app.close();
  });
});

test("unknown fixture returns a safe 404 no_data response", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
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
          issues: ["fixture_missing", "scoreboard_missing", "odds_missing", "no_persisted_data"]
        }
      }),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/not-real"
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().meta.status, "no_data");
    assert.equal(response.json().meta.message, "Fixture not found.");
    await app.close();
  });
});

test("public match response strips deeply nested forbidden keys", () => {
  const state = makeState() as CanonicalMatchState & {
    odds: CanonicalMatchState["odds"] & {
      markets: Array<CanonicalMatchState["odds"]["markets"][number] & {
        Confidence?: number;
        nested?: {
          ReCoMmEnDaTiOn?: string;
          details?: Array<{ WALLET?: string; safe: boolean }>;
        };
      }>;
    };
  };
  state.odds.markets = [{
    ...state.odds.markets[0],
    Confidence: 0.98,
    nested: {
      ReCoMmEnDaTiOn: "remove",
      details: [{
        WALLET: "remove",
        safe: true
      }]
    }
  }];

  const output = sanitizePublicPayload({
    wrapper: {
      state,
      probability: 0.9,
      signals: [{
        type: "safe",
        payload: {
          edge: 1,
          nested: {
            Profit: 99
          }
        }
      }]
    }
  });

  const keys = collectKeys(output);
  for (const field of SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS) {
    assert.equal(keys.includes(field.toLowerCase()), false);
  }
  assertNoForbiddenPublicKeys(output);
});

test("assertNoForbiddenPublicKeys fails when forbidden keys remain", () => {
  assert.throws(
    () => assertNoForbiddenPublicKeys({ nested: { confidence: 1 } }),
    /Forbidden public field: nested\.confidence/
  );
});

test("public bundle output contains no forbidden keys", () => {
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
  for (const field of SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS) {
    assert.equal(keys.includes(field.toLowerCase()), false);
  }
  assertNoForbiddenPublicKeys(output);
  assert.equal(output.data.insight?.agent_version, "product-agent-v1");
});

test("public bundle includes Product Agent v1 insight and preserves existing sections", () => {
  const output = buildPublicBundleResponse({
    presenterOutput: makePresenterOutput(makeState({
      odds: {
        available: false,
        count: 0,
        markets: []
      },
      quality: {
        status: "partial",
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issues: ["odds_missing"]
      }
    })),
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

  assert.equal(output.data.insight?.agent_version, "product-agent-v1");
  assert.equal(output.data.insight?.status, "partial");
  assert.equal(output.data.readiness.status, "partial");
  assert.equal(output.data.brief?.status_label, "partial");
  assert.equal(output.data.signal_summary?.has_odds, false);
  assert.equal(output.data.signals.length, 1);
  assert.equal(output.data.state?.quality.has_odds, false);
});

test("public bundle insight does not leak internal-only fields", () => {
  const output = buildPublicBundleResponse({
    presenterOutput: makePresenterOutput(makeState()),
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

  assert.equal("meta" in (output.data.insight ?? {}), false);
  assert.equal("mode" in (output.data.insight ?? {}), false);
  assert.deepEqual(Object.keys(output.data.insight?.signal_brief.top_signals[0] ?? {}).sort(), [
    "message",
    "severity",
    "title",
    "type"
  ]);
});

test("public sanitizer is case-insensitive", () => {
  const payload = sanitizePublicPayload({
    outer: {
      ConFiDeNcE: 1,
      nested: {
        WALLET: "remove",
        safe: true
      }
    }
  });

  assert.deepEqual(payload, {
    outer: {
      nested: {
        safe: true
      }
    }
  });
});

test("single public match route returns a safe degraded response on backend failure", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => {
        throw new Error("Prisma stack /tmp/secret DATABASE_URL=postgresql://hidden");
      },
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170"
    });

    const body = response.json();
    assert.equal(response.statusCode, 503);
    assert.equal(body.meta.status, "degraded");
    assert.equal(body.meta.source, "database");
    assert.equal(body.meta.mode, "public");
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("stack"), false);
    assert.equal(serialized.includes("DATABASE_URL"), false);
    assert.equal(serialized.includes("secret"), false);
    assert.equal(serialized.includes("/tmp/"), false);
    await app.close();
  });
});

test("public matches list remains lightweight and returns the requested limit", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(30)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 20);
    await app.close();
  });
});

test("public matches list caps the returned limit at 100", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(150)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=9999"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 100);
    await app.close();
  });
});

test("public API helpers do not disturb legacy /api/matches or /api/demo routes", async () => {
  const app = Fastify();
  app.get("/api/matches", async () => ({
    data: { source: "mock" },
    meta: { status: "live", source: "mock", mode: "mock" }
  }));
  app.get("/api/demo/matches", async () => ({
    data: { source: "demo-bridge" },
    meta: { status: "live", source: "demo-bridge", mode: "public-demo" }
  }));

  registerPublicApiRoutes(app, {
    getDbClient: () => makeDbClient([]),
    getDbBackedMatchState: async () => makeState(),
    getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
  });

  const [matches, demo] = await Promise.all([
    app.inject({ method: "GET", url: "/api/matches" }),
    app.inject({ method: "GET", url: "/api/demo/matches" })
  ]);

  assert.deepEqual(matches.json(), {
    data: { source: "mock" },
    meta: { status: "live", source: "mock", mode: "mock" }
  });
  assert.deepEqual(demo.json(), {
    data: { source: "demo-bridge" },
    meta: { status: "live", source: "demo-bridge", mode: "public-demo" }
  });

  await app.close();
});
