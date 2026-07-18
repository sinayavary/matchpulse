import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { AgentPresenterResponse } from "./agent-presenter-v0.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import type { ProductAgentV1Response } from "./product-agent-v1.js";
import {
  assertNoForbiddenPublicKeys,
  buildPublicBundleResponse,
  buildPublicMatchIntelligenceCardResponse,
  normalizePublicBundleQuery,
  normalizePublicMatchIntelligenceCardQuery,
  normalizePublicMatchQuery,
  normalizePublicMatchesQuery,
  registerPublicApiRoutes,
  sanitizePublicPayload
} from "./public-api.js";
import { SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS } from "./signalcore-contract.js";

const PUBLIC_EVENT_IMPACT_KEYS = [
  "event_count_label",
  "label",
  "level",
  "pressure_label",
  "safe_scope_note",
  "source",
  "status"
];

type PublicFixtureRow = {
  fixtureId: string;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
};

type PublicFixtureFindManyArgs = {
  where?: {
    competition?: string;
    startTimeUtc?: {
      gte?: Date;
      lt?: Date;
    };
  };
  orderBy: { fixtureId: "asc" | "desc" };
  take: number;
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

function makePresenterOutput(
  state: CanonicalMatchState,
  options: { includePressureHint?: boolean; includeOddsReliabilityHint?: boolean } = {}
): AgentPresenterResponse {
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
      state,
      ...(options.includePressureHint
        ? {
            pressure_hint: {
              label: "Medium pressure hint",
              level: "medium" as const,
              source: "stored_scores_snapshot" as const,
              evidence_count: 3,
              limitations: ["Stored score snapshots are limited."],
              safe_scope_note:
                "This pressure hint is rule-based and based on available stored score data. It is not a prediction, probability, or betting recommendation."
            }
          }
        : {}),
      ...(options.includeOddsReliabilityHint
        ? {
            odds_reliability_hint: {
              label: "odds_data_limited" as const,
              status: "limited" as const,
              source: "database" as const,
              snapshot_count: 64,
              market_count: 31,
              provider_count: 1,
              latest_timestamp: "2026-06-12T00:46:20.916Z",
              limitation_count: 2,
              safe_scope_note:
                "This is a data-quality hint about stored odds availability, coverage, and freshness. It is not a prediction, probability, betting recommendation, expected value, or wagering instruction."
            }
          }
        : {})
    },
    meta: {
      status: "live",
      source: "agent-presenter",
      mode: "internal"
    }
  };
}

function makeProductAgentOutput(
  status: ProductAgentV1Response["meta"]["status"] = "live"
): ProductAgentV1Response {
  return {
    data: {
      agent_version: "product-agent-v1",
      fixture_id: "17952170",
      status: status === "live" ? "ready" : status === "no_data" ? "empty" : status,
      headline: "Match intelligence is ready for display.",
      summary: "Fixture, scoreboard, and odds data are available.",
      readiness: { display_ready: status !== "no_data", has_fixture: true, has_scoreboard: true, has_odds: true, is_stale: status === "stale" },
      data_quality: { level: status === "no_data" ? "empty" : "complete", issues: [] },
      freshness: { latest_data_timestamp: "2026-06-04T18:04:23.367Z", freshness_label: status === "stale" ? "stale" : "fresh", note: "Latest persisted data is within the freshness window." },
      signal_brief: { total: 1, critical: 0, warning: 0, info: 1, top_signals: [] },
      decision_context: { attention_level: "none", readiness_level: "ready", market_reliability_level: "available", event_pressure_level: "none", operator_guidance: [], limitations: [] },
      user_facing_notes: ["Fixture identity data is available."],
      safe_scope_note: "Safe informational match intelligence."
    },
    meta: { status, source: "product-agent", mode: "internal" }
  } as ProductAgentV1Response;
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

function makeRangeFilteringDbClient(
  rows: PublicFixtureRow[],
  onFindMany: (args: PublicFixtureFindManyArgs) => void
) {
  return {
    fixture: {
      findMany: async (args: PublicFixtureFindManyArgs) => {
        onFindMany(args);
        const competition = args.where?.competition;
        const lowerBound = args.where?.startTimeUtc?.gte?.getTime();
        const upperBound = args.where?.startTimeUtc?.lt?.getTime();
        const direction = args.orderBy.fixtureId;

        return rows
          .filter((row) => competition === undefined || row.competition === competition)
          .filter((row) => {
            const startTime = row.startTimeUtc?.getTime();
            if (lowerBound !== undefined && (startTime === undefined || startTime < lowerBound)) {
              return false;
            }
            if (upperBound !== undefined && (startTime === undefined || startTime >= upperBound)) {
              return false;
            }
            return true;
          })
          .sort((left, right) => {
            return direction === "asc" ? left.fixtureId.localeCompare(right.fixtureId) : right.fixtureId.localeCompare(left.fixtureId);
          })
          .slice(0, args.take);
      }
    },
    matchState: {
      findUnique: async () => null
    },
    oddsSnapshot: {
      count: async () => 0
    }
  };
}

class OneTimeIsoDate extends Date {
  private remainingSuccessfulCalls: number;

  constructor(value: string, successfulCalls = 1) {
    super(value);
    this.remainingSuccessfulCalls = successfulCalls;
  }

  override toISOString(): string {
    if (this.remainingSuccessfulCalls <= 0) {
      throw new Error("Synthetic insight timestamp failure");
    }
    this.remainingSuccessfulCalls -= 1;
    return super.toISOString();
  }
}

class ThrowingIsoDate extends Date {
  override toISOString(): string {
    throw new Error("Synthetic runtime timestamp failure");
  }
}

function makeRuntimeLikeFixtureRows(count: number): PublicFixtureRow[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) {
      return {
        fixtureId: "17952170",
        competition: "Friendlies",
        homeTeam: "Slovenia",
        awayTeam: "Cyprus",
        startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
        status: "FT"
      };
    }

    if ((index + 1) % 6 === 0) {
      return {
        fixtureId: `fixture-${index + 1}`,
        competition: null,
        homeTeam: `Home ${index + 1}`,
        awayTeam: null,
        startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
        status: "FT"
      };
    }

    return {
      fixtureId: `fixture-${index + 1}`,
      competition: "Friendlies",
      homeTeam: `Home ${index + 1}`,
      awayTeam: `Away ${index + 1}`,
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "FT"
    };
  });
}

function makeRuntimeLikeDbClient(rows: PublicFixtureRow[]) {
  return {
    fixture: {
      findMany: async () => rows
    },
    matchState: {
      findUnique: async ({ where }: { where: { fixtureId: string } }) => {
        if (where.fixtureId === "17952170") {
          return {
            homeScore: 1,
            awayScore: 1,
            phase: "fulltime",
            lastDataReceivedAt: new Date("2026-06-04T18:04:23.367Z")
          };
        }

        if (where.fixtureId === "fixture-5") {
          return {
            homeScore: 2,
            awayScore: 2,
            phase: "fulltime",
            lastDataReceivedAt: new ThrowingIsoDate("2026-06-04T18:04:23.367Z") as unknown as Date
          };
        }

        const fixtureNumber = Number(where.fixtureId.replace("fixture-", ""));
        if (!Number.isFinite(fixtureNumber)) {
          return null;
        }

        if (fixtureNumber % 6 === 0) {
          return null;
        }

        if (fixtureNumber % 4 === 0) {
          return {
            homeScore: null,
            awayScore: null,
            phase: null,
            lastDataReceivedAt: null
          };
        }

        return {
          homeScore: 1,
          awayScore: 0,
          phase: "fulltime",
          lastDataReceivedAt: new Date("2026-06-04T18:04:23.367Z")
        };
      }
    },
    oddsSnapshot: {
      count: async ({ where }: { where: { fixtureId: string } }) => {
        if (where.fixtureId === "17952170") {
          return 0;
        }

        if (where.fixtureId === "fixture-5") {
          return 1;
        }

        const fixtureNumber = Number(where.fixtureId.replace("fixture-", ""));
        if (!Number.isFinite(fixtureNumber)) {
          return 0;
        }

        return fixtureNumber % 3 === 0 ? 0 : 1;
      }
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
        product_ready: true
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

test("final product intelligence route maps a safe public response and forwards bounded options", async () => {
  let received: Record<string, unknown> | undefined;
  const app = Fastify();
  registerPublicApiRoutes(app, {
    getProductAgentV1ForFixture: async (_fixtureId, options) => {
      received = options as Record<string, unknown>;
      return makeProductAgentOutput();
    }
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/public/matches/17952170/product-intelligence?oddsLimit=999&staleAfterMinutes=0&includeEventImpact=false&includeOddsReliability=false"
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.source, "product-agent");
  assert.equal(body.meta.mode, "public");
  for (const key of ["product_version", "fixture_id", "status", "headline", "summary", "readiness", "data_quality", "freshness", "market_data", "match_activity", "signal_counts", "public_notes", "safety_note"]) {
    assert.ok(key in body.data);
  }
  for (const key of ["decision_context", "signal_brief", "top_signals", "signals", "state", "internal_context", "raw_payload", "debug_lineage", "prediction", "probability", "recommended_bet", "wallet", "stake", "payout", "token", "secret"]) {
    assert.equal(collectKeys(body).includes(key), false, key);
  }
  assert.deepEqual(received, { oddsLimit: 50, staleAfterMinutes: 1, includeEventImpact: false, includeOddsReliability: false });
  await app.close();
});

test("final product intelligence route handles unknown query, no_data, and failures safely", async () => {
  const app = Fastify();
  registerPublicApiRoutes(app, { getProductAgentV1ForFixture: async () => makeProductAgentOutput("no_data") });
  const invalid = await app.inject({ method: "GET", url: "/api/public/matches/x/product-intelligence?debug=true" });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().meta.message, "Invalid product intelligence query.");
  const noData = await app.inject({ method: "GET", url: "/api/public/matches/x/product-intelligence" });
  assert.equal(noData.statusCode, 404);
  assert.equal(noData.json().data, null);
  await app.close();

  const failing = Fastify();
  registerPublicApiRoutes(failing, { getProductAgentV1ForFixture: async () => { throw new Error("secret internal failure"); } });
  const failure = await failing.inject({ method: "GET", url: "/api/public/matches/x/product-intelligence" });
  assert.equal(failure.statusCode, 503);
  assert.equal(failure.json().meta.message, "Product intelligence is temporarily unavailable.");
  assert.equal(failure.body.includes("secret internal failure"), false);
  await failing.close();
});

test("public matches query normalizes limit default 20", () => {
  assert.equal(normalizePublicMatchesQuery({}).limit, 20);
});

test("public matches query caps limit at 100", () => {
  assert.equal(normalizePublicMatchesQuery({ limit: 9999 }).limit, 100);
});

test("public matches query defaults includeInsight to false", () => {
  assert.equal(normalizePublicMatchesQuery({}).includeInsight, false);
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
    assert.equal(response.json().meta.message, "range must be one of: live, starting_soon, upcoming, recently_finished, interrupted, all.");
    await app.close();
  });
});

test("public match query caps oddsLimit at 50", () => {
  assert.equal(normalizePublicMatchQuery({ oddsLimit: 999 }).oddsLimit, 50);
});

test("public bundle query caps oddsLimit at 50", () => {
  assert.equal(normalizePublicBundleQuery({ oddsLimit: 999 }).oddsLimit, 50);
});

test("public intelligence card query defaults to safe values", () => {
  const normalized = normalizePublicMatchIntelligenceCardQuery({});
  assert.equal(normalized.oddsLimit, 20);
  assert.equal(normalized.staleAfterMinutes, 180);
});

test("public intelligence card query caps oddsLimit and staleAfterMinutes", () => {
  const normalized = normalizePublicMatchIntelligenceCardQuery({
    oddsLimit: 999,
    staleAfterMinutes: 99_999,
    includeState: true,
    includeSignals: true
  } as {
    oddsLimit: unknown;
    staleAfterMinutes: unknown;
  });
  assert.equal(normalized.oddsLimit, 50);
  assert.equal(normalized.staleAfterMinutes, 10080);
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

test("public intelligence card builder returns only the allowed top-level fields", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState(), {
      includePressureHint: true,
      includeOddsReliabilityHint: true
    }),
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.deepEqual(Object.keys(output.data ?? {}).sort(), [
    "agent_version",
    "brief",
    "event_impact",
    "fixture_id",
    "odds_reliability_hint",
    "pressure_hint",
    "signal_summary"
  ]);
  assert.equal(output.meta.mode, "public");
  assert.equal(output.meta.public_api_version, "public-v0");
});

test("public intelligence card builder maps event impact to the approved public-safe shape", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState()),
    eventImpactHint: {
      status: "available",
      level: "high",
      label: "Internal label must not be exposed",
      key_event_count: 2,
      pressure_level: "medium",
      source: "stored_events"
    },
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.deepEqual(Object.keys(output.data?.event_impact ?? {}).sort(), PUBLIC_EVENT_IMPACT_KEYS);
  assert.deepEqual(output.data?.event_impact, {
    status: "available",
    level: "high",
    label: "High match-event impact",
    event_count_label: "2 key events",
    pressure_label: "Moderate event pressure",
    source: "stored_events",
    safe_scope_note: "This summary describes stored match events only. It is not a prediction, probability, betting recommendation, or wagering instruction."
  });
});

test("public intelligence card builder uses unavailable event impact when the internal hint is absent", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState()),
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.equal(output.data?.event_impact.status, "unavailable");
  assert.deepEqual(Object.keys(output.data?.event_impact ?? {}).sort(), PUBLIC_EVENT_IMPACT_KEYS);
});

test("public intelligence card builder includes compact brief", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState()),
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.deepEqual(output.data?.brief, {
    status_label: "ready",
    headline: "Safe headline",
    overview: "Safe overview",
    available_data: ["Fixture identity is available."],
    missing_data: [],
    freshness_note: "Latest persisted data is within the freshness window.",
    quality_notes: ["Data is available for safe display."],
    safe_scope_note:
      "This brief only describes data availability, freshness, and quality for safe display."
  });
});

test("public intelligence card builder reduces signal_summary to allowed keys only", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState()),
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.deepEqual(Object.keys(output.data?.signal_summary ?? {}).sort(), [
    "has_fixture",
    "has_odds",
    "has_scoreboard",
    "latest_data_timestamp",
    "status"
  ]);
});

test("public intelligence card builder includes optional hints when present", () => {
  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: makePresenterOutput(makeState(), {
      includePressureHint: true,
      includeOddsReliabilityHint: true
    }),
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  assert.equal(output.data?.pressure_hint?.level, "medium");
  assert.equal(output.data?.odds_reliability_hint?.status, "limited");
});

test("public intelligence card builder excludes signals state and insight", () => {
  const contaminated = makePresenterOutput(makeState(), {
    includePressureHint: true,
    includeOddsReliabilityHint: true
  }) as AgentPresenterResponse & {
    data: AgentPresenterResponse["data"] & {
      insight?: { safe: boolean };
      state: CanonicalMatchState & { debug_lineage?: string };
      signals: Array<AgentPresenterResponse["data"]["signals"][number] & { raw_payload?: string }>;
    };
  };
  contaminated.data.insight = { safe: false };
  contaminated.data.state = {
    ...contaminated.data.state,
    debug_lineage: "remove"
  };
  contaminated.data.signals = [{
    ...contaminated.data.signals[0],
    raw_payload: "remove"
  }];

  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: contaminated,
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  const serialized = JSON.stringify(output).toLowerCase();
  assert.equal(serialized.includes("\"signals\""), false);
  assert.equal(serialized.includes("\"state\""), false);
  assert.equal(serialized.includes("\"insight\""), false);
});

test("public intelligence card forbidden key scan passes for card-specific fields", () => {
  const contaminated = makePresenterOutput(makeState(), {
    includePressureHint: true,
    includeOddsReliabilityHint: true
  }) as AgentPresenterResponse & {
    data: AgentPresenterResponse["data"] & {
      brief: AgentPresenterResponse["data"]["brief"] & { formula?: string };
      pressure_hint?: AgentPresenterResponse["data"]["pressure_hint"] & { adapter_status?: string };
      odds_reliability_hint?: AgentPresenterResponse["data"]["odds_reliability_hint"] & { primary_side?: string };
    };
  };
  contaminated.data.brief.formula = "remove";
  if (contaminated.data.pressure_hint !== undefined) {
    contaminated.data.pressure_hint.adapter_status = "remove";
  }
  if (contaminated.data.odds_reliability_hint !== undefined) {
    contaminated.data.odds_reliability_hint.primary_side = "remove";
  }

  const output = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: contaminated,
    staleAfterMinutes: 180,
    now: new Date("2026-06-04T19:00:00.000Z")
  });

  const serialized = JSON.stringify(output).toLowerCase();
  for (const field of ["formula", "adapter_status", "primary_side"]) {
    assert.equal(serialized.includes(`\"${field}\"`), false);
  }
  assertNoForbiddenPublicKeys(output);
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

test("public upcoming range filters before bounded take and returns nearest future fixtures", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      ...Array.from({ length: 101 }, (_, index) => ({
        fixtureId: `historical-${index + 1}`,
        competition: "World Cup",
        homeTeam: `Historical Home ${index + 1}`,
        awayTeam: `Historical Away ${index + 1}`,
        startTimeUtc: new Date(now.getTime() - (index + 1) * 60_000),
        status: "FT"
      })),
      {
        fixtureId: "future-near",
        competition: "World Cup",
        homeTeam: "England",
        awayTeam: "Argentina",
        startTimeUtc: new Date("2026-07-15T13:00:00.000Z"),
        status: "UNKNOWN"
      },
      {
        fixtureId: "future-far",
        competition: "World Cup",
        homeTeam: "Spain",
        awayTeam: "TBD",
        startTimeUtc: new Date("2026-07-15T14:00:00.000Z"),
        status: "UNKNOWN"
      }
    ];
    let findManyArgs: PublicFixtureFindManyArgs | undefined;
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeRangeFilteringDbClient(rows, (args) => {
        findManyArgs = args;
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => now
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=upcoming&competitionId=World%20Cup&limit=1"
    });

    const body = response.json();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.data.map((item: { fixture_id: string }) => item.fixture_id), ["future-near"]);
    assert.equal(body.meta.status, "live");
    assert.equal(body.meta.range, "upcoming");
    assert.equal(body.meta.has_more, true);
    assert.equal(typeof body.meta.next_cursor, "string");
    assert.deepEqual(Object.keys(body.data[0]).sort(), [
      "availability",
      "away_team",
      "catalog_identity",
      "competition",
      "fixture_id",
      "home_team",
      "latest_data_timestamp",
      "lifecycle",
      "odds",
      "provider_status_safe",
      "quality",
      "scoreboard",
      "start_time_utc",
      "status"
    ]);
    assert.equal(findManyArgs?.where?.competition, "World Cup");
    assert.equal(findManyArgs?.where?.startTimeUtc?.gte, now);
    assert.equal(findManyArgs?.where?.startTimeUtc?.lt, undefined);
    assert.equal(findManyArgs?.orderBy.fixtureId, "asc");
    assert.equal(findManyArgs?.take, 250);
    await app.close();
  });
});

test("public past range filters before bounded take and returns the most recent past fixtures", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      ...Array.from({ length: 101 }, (_, index) => ({
        fixtureId: `future-${index + 1}`,
        competition: "World Cup",
        homeTeam: `Future Home ${index + 1}`,
        awayTeam: `Future Away ${index + 1}`,
        startTimeUtc: new Date(now.getTime() + (index + 1) * 60_000),
        status: "UNKNOWN"
      })),
      {
        fixtureId: "past-recent",
        competition: "World Cup",
        homeTeam: "Recent Home",
        awayTeam: "Recent Away",
        startTimeUtc: new Date("2026-07-15T11:55:00.000Z"),
        status: "FT"
      },
      {
        fixtureId: "past-older",
        competition: "World Cup",
        homeTeam: "Older Home",
        awayTeam: "Older Away",
        startTimeUtc: new Date("2026-07-15T11:00:00.000Z"),
        status: "FT"
      }
    ];
    let findManyArgs: PublicFixtureFindManyArgs | undefined;
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeRangeFilteringDbClient(rows, (args) => {
        findManyArgs = args;
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => now
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=past&limit=2"
    });

    const body = response.json();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.data.map((item: { fixture_id: string }) => item.fixture_id), [
      "past-recent",
      "past-older"
    ]);
    assert.equal(findManyArgs?.where?.startTimeUtc?.gte, undefined);
    assert.equal(findManyArgs?.where?.startTimeUtc?.lt, now);
    assert.equal(findManyArgs?.orderBy.fixtureId, "asc");
    assert.equal(findManyArgs?.take, 250);
    await app.close();
  });
});

test("public matches list remains lightweight and returns the requested limit", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(30)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => new Date("2026-07-18T12:00:00.000Z")
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

test("public matches list stays backward compatible without includeInsight", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(1)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=20"
    });

    assert.equal(response.statusCode, 200);
    assert.equal("insight_summary" in response.json().data[0], false);
    await app.close();
  });
});

test("public matches list can include compact insight summaries when includeInsight=true", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const rows: PublicFixtureRow[] = [{
      fixtureId: "17952170",
      competition: "Friendlies",
      homeTeam: "Slovenia",
      awayTeam: "Cyprus",
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "FT"
    }];

    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: {
          findMany: async () => rows
        },
        matchState: {
          findUnique: async () => ({
            homeScore: 1,
            awayScore: 1,
            phase: "fulltime",
            lastDataReceivedAt: new Date("2026-06-04T18:04:23.367Z")
          })
        },
        oddsSnapshot: {
          count: async () => 0
        }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => new Date("2026-07-18T12:00:00.000Z")
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=20&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, [{
      fixture_id: "17952170",
      catalog_identity: "mc_0ccfcc39792bdc49f54fd19f",
      competition: "Friendlies",
      home_team: "Slovenia",
      away_team: "Cyprus",
      start_time_utc: "2026-06-04T16:00:00.000Z",
      status: "FT",
      scoreboard: {
        available: true,
        home_score: 1,
        away_score: 1
      },
      odds: {
        available: false,
        count: 0
      },
      quality: {
        status: "partial",
        issues: ["odds_missing"]
      },
      latest_data_timestamp: "2026-06-04T18:04:23.367Z",
      provider_status_safe: "finished",
      lifecycle: {
        lifecycle: "finished",
        source: "provider_terminal",
        reason_code: "provider_terminal_ft",
        normalized_phase: "fulltime",
        is_active: false,
        is_terminal: true,
        updated_at: "2026-07-18T12:00:00.000Z"
      },
      availability: {
        score: "stale",
        odds: "upstream_no_data",
        events: "upstream_no_data"
      },
      insight_summary: {
        agent_version: "product-agent-v1",
        status: "stale",
        quality: "partial",
        freshness: "stale",
        issue_count: 2,
        issues: ["odds_missing", "data_stale"],
        top_signal_types: ["DATA_STALE", "ODDS_MISSING"],
        display_ready: true
      }
    }]);

    await app.close();
  });
});

test("public matches insight summaries stay compact and exclude full insight state and signals", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(1)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=20&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    const item = response.json().data[0];
    assert.equal(item.insight_summary.agent_version, "product-agent-v1");
    assert.equal("insight" in item, false);
    assert.equal("state" in item, false);
    assert.equal("signals" in item, false);
    assert.equal("signal_summary" in item, false);
    assert.equal("headline" in item.insight_summary, false);
    assert.equal("summary" in item.insight_summary, false);
    assert.equal("readiness" in item.insight_summary, false);
    await app.close();
  });
});

test("public matches insight summaries exclude forbidden product and betting fields", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(1)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=20&includeInsight=true"
    });

    const serialized = JSON.stringify(response.json().data[0]).toLowerCase();
    for (const field of [
      "prediction",
      "probability",
      "confidence",
      "recommendation",
      "recommended_bet",
      "bet",
      "wager",
      "stake",
      "expected_value",
      "edge",
      "winner",
      "deposit",
      "payout",
      "wallet"
    ]) {
      assert.equal(serialized.includes(`\"${field}\"`), false);
    }

    await app.close();
  });
});

test("public intelligence card route forwards pressure and odds reliability options", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const captured: Array<Record<string, unknown>> = [];
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async (_fixtureId, options) => {
        captured.push({ ...options });
        return makePresenterOutput(makeState(), {
          includePressureHint: true,
          includeOddsReliabilityHint: true
        });
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170/intelligence-card?oddsLimit=999&staleAfterMinutes=999999"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(captured, [{
      includeState: false,
      includePressure: true,
      includeOddsReliability: true,
      oddsLimit: 50,
      staleAfterMinutes: 10080,
      format: "compact"
    }, {
      includeEventImpact: true,
      format: "compact"
    }]);
    await app.close();
  });
});

test("public intelligence card route returns public-safe event impact and falls back when its provider throws", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      getAgentPresenterEventImpactHintForFixture: async () => {
        throw new Error("internal event impact provider failed");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170/intelligence-card?includeEventImpact=true&includeInternalContext=true&includeState=true&includeSignals=true"
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.event_impact.status, "unavailable");
    assert.deepEqual(Object.keys(body.data.event_impact).sort(), PUBLIC_EVENT_IMPACT_KEYS);
    const serialized = JSON.stringify(body).toLowerCase();
    for (const field of ["event_impact_hint", "event_impact_assessed", "signals", "state", "context", "internal_context", "insight", "raw", "raw_payload", "debug", "debug_lineage", "formula", "probability", "prediction", "confidence", "winner", "recommended_bet", "bet", "expected_value", "ev", "edge", "wager", "stake", "profit", "payout", "wallet", "deposit"]) {
      assert.equal(serialized.includes(`\"${field}\"`), false, field);
    }
    await app.close();
  });
});

test("public intelligence card route does not allow query params to expose state or signals", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState(), {
        includePressureHint: true
      })
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170/intelligence-card?includeState=true&includeSignals=true"
    });

    assert.equal(response.statusCode, 200);
    const serialized = JSON.stringify(response.json()).toLowerCase();
    assert.equal(serialized.includes("\"signals\""), false);
    assert.equal(serialized.includes("\"state\""), false);
    assert.equal(serialized.includes("\"insight\""), false);
    await app.close();
  });
});

test("public intelligence card route returns safe no_data body for missing fixture", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async (fixtureId) => ({
        ...makePresenterOutput(makeState({ fixture_id: fixtureId })),
        data: {
          ...makePresenterOutput(makeState({ fixture_id: fixtureId })).data,
          fixture_id: fixtureId,
          brief: {
            status_label: "empty",
            headline: "No persisted match data is available.",
            overview: "The system does not have enough persisted data to build a brief.",
            available_data: [],
            missing_data: ["Fixture identity is missing.", "Scoreboard data is missing.", "Odds data is missing."],
            freshness_note: "No latest data timestamp is available.",
            quality_notes: [],
            safe_scope_note:
              "This brief only describes data availability, freshness, and quality for safe display."
          },
          signal_summary: {
            status: "empty",
            signal_count: 0,
            critical_count: 0,
            warning_count: 0,
            info_count: 0,
            has_fixture: false,
            has_scoreboard: false,
            has_odds: false,
            latest_data_timestamp: null
          }
        },
        meta: {
          status: "no_data" as const,
          source: "agent-presenter" as const,
          mode: "internal" as const
        }
      })
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/not-real/intelligence-card"
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().meta.status, "no_data");
    assert.equal(
      response.json().meta.message,
      "Match intelligence card data is not available for this fixture."
    );
    assert.equal(response.json().data.fixture_id, "not-real");
    await app.close();
  });
});

test("public intelligence card route returns a safe degraded response on runtime failure", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient([]),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => {
        throw new Error("Internal stack with secrets and raw_payload");
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches/17952170/intelligence-card"
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      data: null,
      meta: {
        status: "degraded",
        source: "database",
        mode: "public",
        public_api_version: "public-v0",
        message: "Public match intelligence card is temporarily unavailable."
      }
    });
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
    assert.equal("insight_summary" in response.json().data[0], false);
    await app.close();
  });
});

test("public matches includeInsight=true supports the documented max limit of 100", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => makeDbClient(makeFixtureRows(150)),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=100&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 100);
    assert.equal(response.json().data.every((item: { insight_summary?: unknown }) => item.insight_summary !== undefined), true);
    await app.close();
  });
});

test("public matches includeInsight=true safely handles incomplete persisted match summaries", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const rows: PublicFixtureRow[] = [{
      fixtureId: "17952170",
      competition: null,
      homeTeam: "Slovenia",
      awayTeam: null,
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "FT"
    }];

    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: {
          findMany: async () => rows
        },
        matchState: {
          findUnique: async () => null
        },
        oddsSnapshot: {
          count: async () => 0
        }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=100&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 1);
    assert.equal(response.json().data[0].insight_summary.agent_version, "product-agent-v1");
    assert.deepEqual(response.json().data[0].insight_summary.issues.sort(), [
      "identity_incomplete",
      "odds_missing",
      "scoreboard_missing"
    ]);
    await app.close();
  });
});

test("public matches includeInsight=true returns 200 for a runtime-like mixed 20-item list", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const rows = makeRuntimeLikeFixtureRows(20);

    registerPublicApiRoutes(app, {
      getDbClient: () => makeRuntimeLikeDbClient(rows),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=20&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.status, "live");
    assert.equal(response.json().data.length, 20);

    const referenceItem = response.json().data.find((item: { fixture_id: string }) => item.fixture_id === "17952170");
    assert.deepEqual(referenceItem.insight_summary, {
      agent_version: "product-agent-v1",
      status: "stale",
      quality: "partial",
      freshness: "stale",
      issue_count: 2,
      issues: ["odds_missing", "data_stale"],
      top_signal_types: ["DATA_STALE", "ODDS_MISSING"],
      display_ready: true
    });

    const malformedItem = response.json().data.find((item: { fixture_id: string }) => item.fixture_id === "fixture-5");
    assert.equal(Boolean(malformedItem?.insight_summary), true);
    assert.equal(malformedItem.insight_summary.freshness, "unknown");
    assert.equal("insight" in malformedItem, false);
    assert.equal("state" in malformedItem, false);
    assert.equal("signals" in malformedItem, false);

    await app.close();
  });
});

test("public matches includeInsight=true returns 200 for a runtime-like mixed 100-item list", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const rows = makeRuntimeLikeFixtureRows(100);

    registerPublicApiRoutes(app, {
      getDbClient: () => makeRuntimeLikeDbClient(rows),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=100&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.status, "live");
    assert.equal(response.json().data.length, 100);
    assert.equal(
      response.json().data.every((item: { insight_summary?: unknown }) => item.insight_summary !== undefined),
      true
    );

    const emptyishItems = response.json().data.filter((item: { quality: { status: string } }) => item.quality.status === "empty");
    assert.equal(emptyishItems.length > 0, true);

    const malformedItem = response.json().data.find((item: { fixture_id: string }) => item.fixture_id === "fixture-5");
    assert.equal(Boolean(malformedItem?.insight_summary), true);
    assert.equal(malformedItem.insight_summary.agent_version, "product-agent-v1");

    await app.close();
  });
});

test("one problematic includeInsight item does not make the whole public matches list fail", async () => {
  await withDatabaseUrl(async () => {
    const app = Fastify();
    const rows = makeFixtureRows(100);

    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: {
          findMany: async () => rows
        },
        matchState: {
          findUnique: async ({ where }: { where: { fixtureId: string } }) => ({
            homeScore: 1,
            awayScore: 1,
            phase: "fulltime",
            lastDataReceivedAt: where.fixtureId === "fixture-100"
              ? new OneTimeIsoDate("2026-06-04T18:04:23.367Z")
              : new Date("2026-06-04T18:04:23.367Z")
          })
        },
        oddsSnapshot: {
          count: async () => 1
        }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState())
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/matches?range=all&limit=100&includeInsight=true"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.status, "live");
    assert.equal(response.json().data.length, 100);
    const problematicItem = response.json().data.find((item: { fixture_id: string }) => item.fixture_id === "fixture-100");
    assert.equal(Boolean(problematicItem), true);
    assert.equal(problematicItem.insight_summary.agent_version, "product-agent-v1");
    assert.equal(problematicItem.insight_summary.status, "stale");
    assert.equal(problematicItem.insight_summary.top_signal_types.includes("DATA_STALE"), true);
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

test("upcoming excludes future terminal rows and exposes lifecycle plus availability", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "future-finished", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T14:00:00.000Z"), status: "FT" },
      { fixtureId: "future-scheduled", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date("2026-07-18T15:00:00.000Z"), status: "Scheduled" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async () => rows },
        matchState: { findUnique: async () => null },
        oddsSnapshot: { count: async () => 0 }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=10" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((item: { fixture_id: string }) => item.fixture_id), ["future-scheduled"]);
    assert.equal(response.json().data[0].lifecycle.lifecycle, "scheduled");
    assert.equal(response.json().data[0].availability.score, "not_expected_yet");
    await app.close();
  });
});

test("catalog deduplicates equivalent source fixtures before cursor pagination", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "duplicate-weak", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:00:00.000Z"), status: "UNKNOWN" },
      { fixtureId: "duplicate-strong", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:02:00.000Z"), status: "Scheduled" },
      { fixtureId: "next-match", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date("2026-07-18T16:00:00.000Z"), status: "Scheduled" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async () => rows },
        matchState: { findUnique: async () => null },
        oddsSnapshot: { count: async () => 0 }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => now
    });
    const first = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=1" });
    assert.equal(first.json().meta.deduplicated_count, 1);
    assert.deepEqual(first.json().data.map((item: { fixture_id: string }) => item.fixture_id), ["duplicate-strong"]);
    const second = await app.inject({ method: "GET", url: `/api/public/matches?range=upcoming&limit=1&cursor=${encodeURIComponent(first.json().meta.next_cursor)}` });
    assert.deepEqual(second.json().data.map((item: { fixture_id: string }) => item.fixture_id), ["next-match"]);
    await app.close();
  });
});

test("catalog deduplicates across a five-minute bucket boundary using interval evidence", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "boundary-1459", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T14:59:00.000Z"), status: "Scheduled" },
      { fixtureId: "boundary-1501", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:01:00.000Z"), status: "Scheduled" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => rows }, matchState: { findUnique: async () => null }, oddsSnapshot: { count: async () => 0 } }),
      getDbBackedMatchState: async () => makeState(),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=10" });
    assert.equal(response.json().data.length, 1);
    assert.equal(response.json().meta.deduplicated_count, 1);
    assert.match(response.json().data[0].catalog_identity, /^mc_[a-f0-9]{24}$/);
    await app.close();
  });
});

test("catalog keeps same-team fixtures separate when the interval exceeds tolerance or evidence conflicts", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "real-a", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:00:00.000Z"), status: "Scheduled" },
      { fixtureId: "real-b", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:04:00.000Z"), status: "Scheduled" },
      { fixtureId: "real-c", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:08:00.000Z"), status: "Scheduled" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => rows }, matchState: { findUnique: async () => null, findMany: async () => [] }, oddsSnapshot: { count: async () => 0, groupBy: async () => [] } }),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=10" });
    assert.equal(response.json().data.length, 2);
    assert.equal(response.json().meta.deduplicated_count, 1);
    await app.close();
  });
});

test("public list uses bounded batch enrichment instead of per-fixture reads", async () => {
  await withDatabaseUrl(async () => {
    const rows: PublicFixtureRow[] = [
      { fixtureId: "batch-a", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-19T15:00:00.000Z"), status: "Scheduled" },
      { fixtureId: "batch-b", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date("2026-07-19T16:00:00.000Z"), status: "Scheduled" }
    ];
    let stateBatchCalls = 0;
    let oddsBatchCalls = 0;
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async () => rows },
        matchState: {
          findUnique: async () => { throw new Error("per-fixture state query is forbidden"); },
          findMany: async () => { stateBatchCalls += 1; return []; }
        },
        oddsSnapshot: {
          count: async () => { throw new Error("per-fixture odds query is forbidden"); },
          groupBy: async () => { oddsBatchCalls += 1; return []; }
        }
      }),
      getDbBackedMatchState: async () => makeState(),
      getAgentPresenterBriefForFixture: async () => makePresenterOutput(makeState()),
      now: () => new Date("2026-07-18T12:00:00.000Z")
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=20" });
    assert.equal(response.statusCode, 200);
    assert.equal(stateBatchCalls, 1);
    assert.equal(oddsBatchCalls, 1);
    assert.equal(response.json().data.length, 2);
    await app.close();
  });
});

test("recently_finished is a strict 48-hour lifecycle window", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "inside", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date(now.getTime() - 48 * 60 * 60_000 + 1), status: "FT" },
      { fixtureId: "outside", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date(now.getTime() - 48 * 60 * 60_000 - 1), status: "FT" },
      { fixtureId: "interrupted", competition: "Cup", homeTeam: "E", awayTeam: "F", startTimeUtc: new Date(now.getTime() - 60 * 60_000), status: "Postponed" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({ fixture: { findMany: async () => rows }, matchState: { findUnique: async () => null, findMany: async () => [] }, oddsSnapshot: { count: async () => 0, groupBy: async () => [] }, matchEvent: { groupBy: async () => [] } }),
      getDbBackedMatchState: async () => makeState(),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=recently_finished&limit=20" });
    assert.deepEqual(response.json().data.map((item: { fixture_id: string }) => item.fixture_id), ["inside"]);
    await app.close();
  });
});

test("catalog scan continues past 10000 rows with bounded 250-row database pages", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = Array.from({ length: 10_001 }, (_, index) => ({ fixtureId: `large-${String(index).padStart(5, "0")}`, competition: "Cup", homeTeam: `Home ${index}`, awayTeam: `Away ${index}`, startTimeUtc: new Date(now.getTime() + (index + 1) * 60_000), status: "Scheduled" }));
    let maxTake = 0;
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async (args: { cursor?: { fixtureId: string }; take: number }) => { maxTake = Math.max(maxTake, args.take); const start = args.cursor === undefined ? 0 : Number(args.cursor.fixtureId.slice(6)) + 1; return rows.slice(start, start + args.take); } },
        matchState: { findUnique: async () => null, findMany: async () => [] },
        oddsSnapshot: { count: async () => 0, groupBy: async () => [] },
        matchEvent: { groupBy: async () => [] }
      }),
      getDbBackedMatchState: async () => makeState(),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=1" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.scanned_count, 10_001);
    assert.equal(maxTake, 250);
    assert.equal(response.json().data[0].fixture_id, "large-00000");
    await app.close();
  });
});

test("snapshot cursor excludes fixtures inserted after traversal began", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: Array<PublicFixtureRow & { createdAt: Date }> = [
      { fixtureId: "snap-a", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T13:00:00Z"), status: "Scheduled", createdAt: new Date("2026-07-18T11:00:00Z") },
      { fixtureId: "snap-b", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date("2026-07-18T14:00:00Z"), status: "Scheduled", createdAt: new Date("2026-07-18T11:00:00Z") }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async (args: { cursor?: { fixtureId: string }; where?: { createdAt?: { lte?: Date } }; take: number }) => rows.filter((row) => (args.where?.createdAt?.lte === undefined || row.createdAt <= args.where.createdAt.lte) && (args.cursor === undefined || row.fixtureId > args.cursor.fixtureId)).slice(0, args.take) },
        matchState: { findUnique: async () => null, findMany: async () => [] },
        oddsSnapshot: { count: async () => 0, groupBy: async () => [] },
        matchEvent: { groupBy: async () => [] }
      }),
      getDbBackedMatchState: async () => makeState(),
      now: () => now
    });
    const first = await app.inject({ method: "GET", url: "/api/public/matches?range=upcoming&limit=1" });
    rows.unshift({ fixtureId: "snap-inserted", competition: "Cup", homeTeam: "X", awayTeam: "Y", startTimeUtc: new Date("2026-07-18T12:30:00Z"), status: "Scheduled", createdAt: new Date("2026-07-18T12:00:00.001Z") });
    const second = await app.inject({ method: "GET", url: `/api/public/matches?range=upcoming&limit=1&cursor=${encodeURIComponent(first.json().meta.next_cursor)}` });
    assert.deepEqual(second.json().data.map((item: { fixture_id: string }) => item.fixture_id), ["snap-b"]);
    await app.close();
  });
});

test("event availability is batch-derived and distinguishes available, stale, and upstream-no-data", async () => {
  await withDatabaseUrl(async () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const rows: PublicFixtureRow[] = [
      { fixtureId: "event-live", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T10:00:00Z"), status: "Live" },
      { fixtureId: "event-stale", competition: "Cup", homeTeam: "C", awayTeam: "D", startTimeUtc: new Date("2026-07-18T09:00:00Z"), status: "FT" },
      { fixtureId: "event-none", competition: "Cup", homeTeam: "E", awayTeam: "F", startTimeUtc: new Date("2026-07-18T08:00:00Z"), status: "FT" }
    ];
    const app = Fastify();
    registerPublicApiRoutes(app, {
      getDbClient: () => ({
        fixture: { findMany: async () => rows },
        matchState: { findUnique: async () => null, findMany: async () => [] },
        oddsSnapshot: { count: async () => 0, groupBy: async () => [] },
        matchEvent: { groupBy: async () => [{ fixtureId: "event-live", _count: { _all: 1 }, _max: { sourceTimestamp: now } }, { fixtureId: "event-stale", _count: { _all: 1 }, _max: { sourceTimestamp: new Date(now.getTime() - 2 * 60 * 60_000) } }] }
      }),
      getDbBackedMatchState: async () => makeState(),
      now: () => now
    });
    const response = await app.inject({ method: "GET", url: "/api/public/matches?range=all&limit=20" });
    const byId = new Map((response.json().data as Array<{ fixture_id: string; availability: { events: string } }>).map((item) => [item.fixture_id, item]));
    assert.equal(byId.get("event-live")!.availability.events, "available");
    assert.equal(byId.get("event-stale")!.availability.events, "stale");
    assert.equal(byId.get("event-none")!.availability.events, "upstream_no_data");
    await app.close();
  });
});
