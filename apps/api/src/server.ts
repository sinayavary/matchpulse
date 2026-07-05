import "./load-env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { readMock, response, notFoundResponse } from "./mock-store.js";
import type { MatchState } from "@matchpulse/shared";
import {
  createTxlineLiveClient,
  getTxlineConfigFromEnv,
  toTxlineStatusData,
  TxlineLiveError
} from "@matchpulse/txline-client";
import {
  hasFiniteGoalScore,
  isRecord,
  normalizeTxlineScore,
  normalizeTxlineFixture,
  normalizeTxlineMatchPreview,
  normalizeAsOfToEpochMs,
  parseFixtureId,
  readFiniteNumber,
  readString,
  selectLatestTxlineScore
} from "./txline-normalizer.js";
import {
  DEFAULT_TXLINE_DEMO_SEED_ID,
  findTxlineDemoSeedById,
  TXLINE_DEMO_SEEDS,
  type TxlineDemoSeed
} from "./txline-demo-seeds.js";
import {
  buildTxlineReplaySummary,
  buildTxlineReplayTimeline
} from "./txline-replay.js";

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT ?? 4000);

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true
});

app.get("/api/health", async () =>
  response({
    service: "matchpulse-api",
    ok: true,
    txline_network: process.env.TXLINE_NETWORK ?? "devnet",
    service_level_id: Number(process.env.TXLINE_SERVICE_LEVEL_ID ?? 1)
  })
);

app.get("/api/internal/txline/status", async () => {
  const txlineConfig = getTxlineConfigFromEnv();
  const statusData = toTxlineStatusData(txlineConfig);

  return {
    data: statusData,
    meta: {
      status: "live",
      source: "backend",
      mode: txlineConfig.dataMode
    }
  };
});

app.get("/api/internal/txline/demo/seeds", async () => {
  const txlineConfig = getTxlineConfigFromEnv();

  return {
    data: {
      items: TXLINE_DEMO_SEEDS,
      count: TXLINE_DEMO_SEEDS.length
    },
    meta: {
      status: "live" as const,
      source: "backend" as const,
      mode: txlineConfig.dataMode
    }
  };
});

function txlineMeta(status: "live" | "degraded" | "error", message?: string) {
  return {
    status,
    source: "txline" as const,
    mode: "live" as const,
    last_updated: new Date().toISOString(),
    seconds_since_update: 0,
    ...(message ? { message } : {})
  };
}

function normalizedTxlineMeta(
  mode: "live" | "auto",
  status: "live" | "degraded" | "error",
  message?: string
) {
  return {
    status,
    source: "txline" as const,
    mode,
    last_updated: new Date().toISOString(),
    seconds_since_update: 0,
    ...(message ? { message } : {})
  };
}

function safeTxlineError(error: unknown) {
  return error instanceof TxlineLiveError
    ? error.safe
    : {
        endpointPath: "unknown",
        endpointHost: "unknown",
        kind: "unknown" as const,
        message: "The TxLINE request failed."
      };
}

function normalizedTxlineError(
  mode: "live" | "auto",
  error: unknown
) {
  const safeError = safeTxlineError(error);
  const degradableKinds = new Set([
    "unauthorized", "forbidden", "rate_limited", "server_error", "timeout", "network"
  ]);
  const status = mode === "auto" && degradableKinds.has(safeError.kind)
    ? "degraded"
    : "error";
  return {
    data: { error: safeError },
    meta: normalizedTxlineMeta(mode, status, safeError.message)
  };
}

function normalizedRouteMode(dataMode: "mock" | "live" | "auto"): "live" | "auto" {
  return dataMode === "auto" ? "auto" : "live";
}

function buildScoreQaSummary(rawFixture: unknown, rawScores: unknown, fixtureId: string) {
  const selectedScore = selectLatestTxlineScore(rawScores, fixtureId);
  const score = selectedScore !== null && isRecord(rawFixture)
    ? normalizeTxlineScore(selectedScore, rawFixture.Participant1IsHome)
    : { home: null, away: null };
  const hasGoalScore = hasFiniteGoalScore(score);

  return {
    has_score_snapshot: selectedScore !== null,
    has_goal_score: hasGoalScore,
    selected_seq: selectedScore !== null && isRecord(selectedScore)
      ? readFiniteNumber(selectedScore.Seq)
      : null,
    selected_ts: selectedScore !== null && isRecord(selectedScore)
      ? readFiniteNumber(selectedScore.Ts)
      : null,
    action: selectedScore !== null && isRecord(selectedScore)
      ? readString(selectedScore.Action)
      : null,
    note: selectedScore === null
      ? "no_score_snapshot"
      : hasGoalScore
        ? "goal_score_available"
        : "score_snapshot_without_goals"
  };
}

function toSafeTxlineDemoSeed(seed: TxlineDemoSeed) {
  return {
    id: seed.id,
    label: seed.label,
    fixtureId: seed.fixtureId,
    competitionId: seed.competitionId,
    startEpochDay: seed.startEpochDay,
    knownScore: seed.knownScore,
    knownAction: seed.knownAction,
    knownSeq: seed.knownSeq,
    description: seed.description
  };
}

function publicLiveNormalizationUnavailable() {
  return {
    data: null,
    meta: txlineMeta("error", "not_implemented_for_live_normalization")
  };
}

async function runRawLiveRequest(request: () => Promise<unknown>) {
  const config = getTxlineConfigFromEnv();
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: txlineMeta("error", "Raw TxLINE routes require live or auto mode.")
    };
  }

  try {
    return { data: await request(), meta: txlineMeta("live") };
  } catch (error) {
    const safeError = error instanceof TxlineLiveError
      ? error.safe
      : {
          endpointPath: "unknown",
          endpointHost: "unknown",
          kind: "unknown" as const,
          message: "The TxLINE request failed."
        };
    const degradableKinds = new Set([
      "unauthorized", "forbidden", "rate_limited", "server_error", "timeout", "network"
    ]);
    const status = config.dataMode === "auto" && degradableKinds.has(safeError.kind)
      ? "degraded"
      : "error";
    return {
      data: { error: safeError },
      meta: txlineMeta(status, safeError.message)
    };
  }
}

app.get("/api/internal/txline/live/fixtures/snapshot", async (request) => {
  const config = getTxlineConfigFromEnv();
  if (config.dataMode === "mock") return runRawLiveRequest(async () => null);
  const query = request.query as { competitionId?: string; startEpochDay?: string };
  const competitionId = query.competitionId ?? config.defaultCompetitionId;
  const startEpochDay = Number(query.startEpochDay ?? config.defaultStartEpochDay);
  if (!competitionId || !Number.isFinite(startEpochDay)) {
    return { data: null, meta: txlineMeta("error", "competitionId and startEpochDay are required.") };
  }
  return runRawLiveRequest(() =>
    createTxlineLiveClient().getFixtureSnapshot({ competitionId, startEpochDay })
  );
});

app.get("/api/internal/txline/live/scores/snapshot/:fixtureId", async (request) => {
  if (getTxlineConfigFromEnv().dataMode === "mock") return runRawLiveRequest(async () => null);
  const { fixtureId } = request.params as { fixtureId: string };
  const { asOf: rawAsOf } = request.query as { asOf?: string };
  const asOf = Number(rawAsOf);
  if (!rawAsOf || !Number.isFinite(asOf)) {
    return { data: null, meta: txlineMeta("error", "asOf is required.") };
  }
  return runRawLiveRequest(() => createTxlineLiveClient().getScoreSnapshot({ fixtureId, asOf }));
});

app.get("/api/internal/txline/live/odds/snapshot/:fixtureId", async (request) => {
  if (getTxlineConfigFromEnv().dataMode === "mock") return runRawLiveRequest(async () => null);
  const { fixtureId } = request.params as { fixtureId: string };
  const { asOf: rawAsOf } = request.query as { asOf?: string };
  const asOf = Number(rawAsOf);
  if (!rawAsOf || !Number.isFinite(asOf)) {
    return { data: null, meta: txlineMeta("error", "asOf is required.") };
  }
  return runRawLiveRequest(() => createTxlineLiveClient().getOddsSnapshot({ fixtureId, asOf }));
});

app.get("/api/internal/txline/normalized/fixtures/preview", async (request) => {
  const config = getTxlineConfigFromEnv();
  const mode = normalizedRouteMode(config.dataMode);
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Normalized TxLINE routes require live or auto mode.")
    };
  }

  const query = request.query as {
    competitionId?: string;
    startEpochDay?: string;
    includeRaw?: string;
  };
  const competitionId = query.competitionId ?? config.defaultCompetitionId;
  const startEpochDay = Number(query.startEpochDay ?? config.defaultStartEpochDay);
  if (!competitionId || !Number.isFinite(startEpochDay)) {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "competitionId and startEpochDay are required.")
    };
  }

  try {
    const rawFixtures = await createTxlineLiveClient().getFixtureSnapshot({
      competitionId,
      startEpochDay
    });
    const items = Array.isArray(rawFixtures)
      ? rawFixtures.flatMap((rawFixture) => {
          const normalized = normalizeTxlineFixture(rawFixture, {
            includeRaw: query.includeRaw === "true"
          });
          return normalized === null ? [] : [normalized];
        })
      : [];
    return {
      data: { items, count: items.length },
      meta: normalizedTxlineMeta(mode, "live")
    };
  } catch (error) {
    return normalizedTxlineError(mode, error);
  }
});

app.get("/api/internal/txline/normalized/matches/:fixtureId/preview", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  const mode = normalizedRouteMode(config.dataMode);
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Normalized TxLINE routes require live or auto mode.")
    };
  }

  const { fixtureId } = request.params as { fixtureId: string };
  const query = request.query as {
    competitionId?: string;
    startEpochDay?: string;
    asOf?: string;
    includeRaw?: string;
  };
  const competitionId = query.competitionId ?? config.defaultCompetitionId;
  const startEpochDay = Number(query.startEpochDay ?? config.defaultStartEpochDay);
  const asOf = Number(query.asOf);
  if (!competitionId || !Number.isFinite(startEpochDay) || !query.asOf || !Number.isFinite(asOf)) {
    return {
      data: null,
      meta: normalizedTxlineMeta(
        mode,
        "error",
        "competitionId, startEpochDay, and asOf are required."
      )
    };
  }

  try {
    const client = createTxlineLiveClient();
    const rawFixtures = await client.getFixtureSnapshot({ competitionId, startEpochDay });
    const rawFixture = Array.isArray(rawFixtures)
      ? rawFixtures.find((candidate) =>
          isRecord(candidate) && parseFixtureId(candidate.FixtureId) === fixtureId
        )
      : undefined;
    if (rawFixture === undefined) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found.")
      };
    }

    const rawScores = await client.getScoreSnapshot({ fixtureId, asOf });
    const preview = normalizeTxlineMatchPreview(rawFixture, rawScores, {
      includeRaw: query.includeRaw === "true"
    });
    if (preview === null) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found.")
      };
    }
    return { data: preview, meta: normalizedTxlineMeta(mode, "live") };
  } catch (error) {
    return normalizedTxlineError(mode, error);
  }
});

app.get("/api/internal/txline/demo/live-preview", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  const mode = normalizedRouteMode(config.dataMode);
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Normalized TxLINE routes require live or auto mode.")
    };
  }

  const query = request.query as {
    seed?: string;
    asOf?: string;
    includeRaw?: string;
  };
  const seedId = query.seed ?? DEFAULT_TXLINE_DEMO_SEED_ID;
  const seed = findTxlineDemoSeedById(seedId);

  if (seed === undefined) {
    reply.code(404);
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Demo seed not found.")
    };
  }

  const normalizedAsOf = query.asOf === undefined
    ? Date.now().toString()
    : normalizeAsOfToEpochMs(query.asOf);
  if (normalizedAsOf === null) {
    return {
      data: null,
      meta: normalizedTxlineMeta(
        mode,
        "error",
        "asOf must be a valid ISO date string or epoch milliseconds."
      )
    };
  }

  try {
    const client = createTxlineLiveClient();
    const rawFixtures = await client.getFixtureSnapshot({
      competitionId: String(seed.competitionId),
      startEpochDay: seed.startEpochDay
    });
    const rawFixture = Array.isArray(rawFixtures)
      ? rawFixtures.find((candidate) =>
          isRecord(candidate) && parseFixtureId(candidate.FixtureId) === seed.fixtureId
        )
      : undefined;

    if (rawFixture === undefined) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found for demo seed.")
      };
    }

    const rawScores = await client.getScoreSnapshot({
      fixtureId: seed.fixtureId,
      asOf: Number(normalizedAsOf)
    });
    const preview = normalizeTxlineMatchPreview(rawFixture, rawScores, {
      includeRaw: query.includeRaw === "true"
    });

    if (preview === null) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found for demo seed.")
      };
    }

    return {
      data: {
        seed,
        preview,
        qa: buildScoreQaSummary(rawFixture, rawScores, seed.fixtureId)
      },
      meta: normalizedTxlineMeta(mode, "live")
    };
  } catch (error) {
    return normalizedTxlineError(mode, error);
  }
});

app.get("/api/internal/txline/demo/replay", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  const mode = normalizedRouteMode(config.dataMode);
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Normalized TxLINE routes require live or auto mode.")
    };
  }

  const query = request.query as {
    seed?: string;
    asOf?: string;
  };
  const seedId = query.seed ?? DEFAULT_TXLINE_DEMO_SEED_ID;
  const seed = findTxlineDemoSeedById(seedId);

  if (seed === undefined) {
    reply.code(404);
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Demo seed not found.")
    };
  }

  const normalizedAsOf = query.asOf === undefined
    ? Date.now().toString()
    : normalizeAsOfToEpochMs(query.asOf);
  if (normalizedAsOf === null) {
    return {
      data: null,
      meta: normalizedTxlineMeta(
        mode,
        "error",
        "asOf must be a valid ISO date string or epoch milliseconds."
      )
    };
  }

  try {
    const client = createTxlineLiveClient();
    const rawFixtures = await client.getFixtureSnapshot({
      competitionId: String(seed.competitionId),
      startEpochDay: seed.startEpochDay
    });
    const rawFixture = Array.isArray(rawFixtures)
      ? rawFixtures.find((candidate) =>
          isRecord(candidate) && parseFixtureId(candidate.FixtureId) === seed.fixtureId
        )
      : undefined;

    if (rawFixture === undefined) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found for demo seed.")
      };
    }

    const rawScores = await client.getScoreSnapshot({
      fixtureId: seed.fixtureId,
      asOf: Number(normalizedAsOf)
    });
    const fixture = normalizeTxlineMatchPreview(rawFixture, rawScores);

    if (fixture === null) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found for demo seed.")
      };
    }

    const timeline = buildTxlineReplayTimeline(rawScores, {
      fixtureId: seed.fixtureId,
      participant1IsHome: rawFixture.Participant1IsHome
    });
    const summary = buildTxlineReplaySummary(timeline);

    return {
      data: {
        seed: toSafeTxlineDemoSeed(seed),
        fixture,
        timeline,
        count: timeline.length,
        summary
      },
      meta: normalizedTxlineMeta(mode, "live")
    };
  } catch (error) {
    return normalizedTxlineError(mode, error);
  }
});

app.get("/api/internal/txline/normalized/qa/score-samples", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  const mode = normalizedRouteMode(config.dataMode);
  if (config.dataMode === "mock") {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "Normalized TxLINE routes require live or auto mode.")
    };
  }

  const query = request.query as {
    competitionId?: string;
    startEpochDay?: string;
    asOf?: string;
    fixtureId?: string;
    limit?: string;
    includeRaw?: string;
  };
  const competitionId = query.competitionId ?? config.defaultCompetitionId;
  const startEpochDay = Number(query.startEpochDay ?? config.defaultStartEpochDay);
  const rawAsOf = query.asOf;
  const fixtureId = query.fixtureId === undefined ? undefined : parseFixtureId(query.fixtureId);
  const includeRaw = query.includeRaw === "true";

  if (!competitionId || !Number.isFinite(startEpochDay) || !rawAsOf) {
    return {
      data: null,
      meta: normalizedTxlineMeta(
        mode,
        "error",
        "competitionId, startEpochDay, and asOf are required."
      )
    };
  }

  if (query.fixtureId !== undefined && fixtureId === null) {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "fixtureId must be a valid fixture id.")
    };
  }

  const asOf = normalizeAsOfToEpochMs(rawAsOf);
  if (asOf === null) {
    return {
      data: null,
      meta: normalizedTxlineMeta(
        mode,
        "error",
        "asOf must be a valid ISO date string or epoch milliseconds."
      )
    };
  }

  const parsedLimit = query.limit === undefined ? 10 : Number(query.limit);
  if (fixtureId === undefined && (!Number.isInteger(parsedLimit) || parsedLimit <= 0)) {
    return {
      data: null,
      meta: normalizedTxlineMeta(mode, "error", "limit must be a positive integer.")
    };
  }

  const limit = fixtureId === undefined ? Math.min(parsedLimit, 15) : 1;

  try {
    const client = createTxlineLiveClient() as ReturnType<typeof createTxlineLiveClient> & {
      getScoreSnapshot(params: { fixtureId: string; asOf: string }): Promise<unknown>;
    };
    const rawFixtures = await client.getFixtureSnapshot({ competitionId, startEpochDay });
    let fixtures: unknown[] = [];
    if (Array.isArray(rawFixtures)) {
      if (fixtureId === undefined) {
        fixtures = rawFixtures.slice(0, limit);
      } else {
        const targetFixture = rawFixtures.find((candidate) =>
          isRecord(candidate) && parseFixtureId(candidate.FixtureId) === fixtureId
        );
        if (targetFixture === undefined) {
          reply.code(404);
          return {
            data: null,
            meta: normalizedTxlineMeta(mode, "error", "Fixture not found.")
          };
        }
        fixtures = [targetFixture];
      }
    } else if (fixtureId !== undefined) {
      reply.code(404);
      return {
        data: null,
        meta: normalizedTxlineMeta(mode, "error", "Fixture not found.")
      };
    }

    const items: Array<Record<string, unknown>> = [];
    let foundGoalScores = 0;
    let hadFixtureError = false;

    for (const rawFixture of fixtures) {
      const normalizedFixture = normalizeTxlineFixture(rawFixture, { includeRaw: false });
      const baseItem = {
        fixture_id: normalizedFixture?.fixture_id ?? "unknown",
        competition: normalizedFixture?.competition ?? "unknown",
        home_team: normalizedFixture?.home_team ?? "unknown",
        away_team: normalizedFixture?.away_team ?? "unknown",
        start_time_utc: normalizedFixture?.start_time_utc ?? null
      };

      if (normalizedFixture === null || !isRecord(rawFixture)) {
        items.push({
          ...baseItem,
          has_score_snapshot: false,
          has_goal_score: false,
          score: { home: null, away: null },
          selected_seq: null,
          selected_ts: null,
          action: null,
          note: "no_score_snapshot"
        });
        continue;
      }

      try {
        const rawScores = await client.getScoreSnapshot({
          fixtureId: normalizedFixture.fixture_id,
          asOf
        });
        const selectedScore = selectLatestTxlineScore(rawScores, normalizedFixture.fixture_id);
        const score = selectedScore === null
          ? { home: null, away: null }
          : normalizeTxlineScore(selectedScore, rawFixture.Participant1IsHome);
        const qa = buildScoreQaSummary(rawFixture, rawScores, normalizedFixture.fixture_id);
        if (qa.has_goal_score) foundGoalScores += 1;

        items.push({
          ...baseItem,
          has_score_snapshot: qa.has_score_snapshot,
          has_goal_score: qa.has_goal_score,
          score,
          selected_seq: qa.selected_seq,
          selected_ts: qa.selected_ts,
          action: qa.action,
          note: qa.note,
          ...(includeRaw ? { raw: { fixture: rawFixture, score: selectedScore } } : {})
        });
      } catch (error) {
        hadFixtureError = true;
        items.push({
          ...baseItem,
          has_score_snapshot: false,
          has_goal_score: false,
          score: { home: null, away: null },
          selected_seq: null,
          selected_ts: null,
          action: null,
          note: "score_fetch_failed",
          error: safeTxlineError(error),
          ...(includeRaw ? { raw: { fixture: rawFixture } } : {})
        });
      }
    }

    return {
      data: {
        checked: items.length,
        found_goal_scores: foundGoalScores,
        items
      },
      meta: normalizedTxlineMeta(mode, hadFixtureError ? "degraded" : "live")
    };
  } catch (error) {
    return normalizedTxlineError(mode, error);
  }
});

app.get("/api/matches", async () => {
  const config = getTxlineConfigFromEnv();
  return config.dataMode === "live"
    ? publicLiveNormalizationUnavailable()
    : response(readMock("matches.json"));
});
app.get("/api/matches/live", async () => response(readMock("matches.json")));
app.get("/api/matches/:fixtureId", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  if (config.dataMode === "live") return publicLiveNormalizationUnavailable();
  const { fixtureId } = request.params as { fixtureId: string };
  const matchState = readMock<MatchState>("match-state.json");

  if (matchState.fixture_id !== fixtureId) {
    reply.code(404);
    return notFoundResponse("Fixture not found");
  }

  return response(matchState);
});
app.get("/api/matches/:fixtureId/raw", async () => response(readMock("raw-data.json")));
app.get("/api/matches/:fixtureId/timeline", async () => response(readMock("timeline.json")));
app.get("/api/matches/:fixtureId/odds", async () => response(readMock("odds.json")));
app.get("/api/matches/:fixtureId/signals", async () => response(readMock("signals.json")));
app.get("/api/matches/:fixtureId/scenarios", async () => response(readMock("scenarios.json")));
app.get("/api/matches/:fixtureId/recap", async () =>
  response({
    fixture_id: "mock-fixture",
    title: "Mock match recap",
    summary:
      "The agent identified aligned event and market movement signals. This is an informational market insight, not betting advice.",
    key_takeaway: "Replay mode is ready for demo without live match activity."
  })
);

app.get("/api/agent/health", async () =>
  response({
    agent: "SignalCore",
    status: "running_mock_mode",
    watched_matches: 1,
    mode: "devnet-first mock"
  })
);
app.get("/api/agent/signals", async () => response(readMock("signals.json")));
app.get("/api/agent/evaluation", async () => response(readMock("evaluation.json")));
app.get("/api/agent/learning-graph", async () => response(readMock("learning-graph.json")));

app.post("/api/replay/start", async () => response(readMock("replay-state.json"), "replay"));
app.get("/api/replay/:sessionId", async () => response(readMock("replay-state.json"), "replay"));

const watchlist: string[] = [];
app.get("/api/watchlist", async () => response({ items: watchlist }));
app.post("/api/watchlist", async (request) => {
  const body = request.body as { fixture_id?: string } | undefined;
  if (body?.fixture_id && !watchlist.includes(body.fixture_id)) watchlist.push(body.fixture_id);
  return response({ items: watchlist });
});

app.post("/api/telegram/webhook", async (request) => {
  app.log.info({ body: request.body }, "Telegram webhook received in mock mode");
  return response({ ok: true, mode: "mock" });
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
