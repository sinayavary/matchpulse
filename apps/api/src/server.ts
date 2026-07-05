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
import { checkDbHealth } from "./db-health.js";
import { getDbClient } from "./db.js";
import { verifyDemoSeed } from "./db-seed-verification.js";
import {
  ingestTxlineFixtures,
  summarizeFixtureIngestion
} from "./txline-fixture-ingestion.js";
import {
  ingestTxlineScoreSnapshot,
  summarizeScoreIngestion
} from "./txline-score-ingestion.js";
import {
  getDbOddsSnapshotsByFixtureId,
  ingestTxlineOddsSnapshot
} from "./txline-odds-ingestion.js";
import {
  buildReplayState,
  createReplaySession,
  getReplaySession,
  ReplaySessionValidationError
} from "./replay-sessions.js";

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

app.get("/api/internal/db/status", async () => {
  const health = await checkDbHealth();

  return {
    data: health,
    meta: {
      status: health.connected ? "live" : health.configured ? "degraded" : "no_data",
      source: "database"
    }
  };
});

app.get("/api/internal/db/demo-seed/status", async () => verifyDemoSeed());

app.get("/api/internal/db/fixtures/:fixtureId", async (request) => {
  const { fixtureId } = request.params as { fixtureId: string };
  if (!process.env.DATABASE_URL) {
    return {
      data: { found: false, fixture: null },
      meta: { status: "no_data" as const, source: "database" as const }
    };
  }

  try {
    const fixture = await getDbClient().fixture.findUnique({
      where: { fixtureId },
      select: {
        fixtureId: true,
        competition: true,
        homeTeam: true,
        awayTeam: true,
        startTimeUtc: true,
        status: true
      }
    });

    return {
      data: {
        found: fixture !== null,
        fixture: fixture === null ? null : {
          fixture_id: fixture.fixtureId,
          competition: fixture.competition,
          home_team: fixture.homeTeam,
          away_team: fixture.awayTeam,
          start_time_utc: fixture.startTimeUtc?.toISOString() ?? null,
          status: fixture.status
        }
      },
      meta: {
        status: fixture === null ? "no_data" as const : "live" as const,
        source: "database" as const
      }
    };
  } catch {
    return {
      data: { found: false, fixture: null },
      meta: { status: "degraded" as const, source: "database" as const }
    };
  }
});

app.get("/api/internal/db/match-states/:fixtureId", async (request) => {
  const { fixtureId } = request.params as { fixtureId: string };
  if (!process.env.DATABASE_URL) {
    return {
      data: { found: false, match_state: null },
      meta: { status: "no_data" as const, source: "database" as const }
    };
  }

  try {
    const matchState = await getDbClient().matchState.findUnique({
      where: { fixtureId },
      select: {
        fixtureId: true,
        homeScore: true,
        awayScore: true,
        phase: true,
        marketMood: true,
        lastDataReceivedAt: true
      }
    });
    return {
      data: {
        found: matchState !== null,
        match_state: matchState === null ? null : {
          fixture_id: matchState.fixtureId,
          home_score: matchState.homeScore,
          away_score: matchState.awayScore,
          phase: matchState.phase,
          market_mood: matchState.marketMood,
          last_data_received_at: matchState.lastDataReceivedAt?.toISOString() ?? null
        }
      },
      meta: {
        status: matchState === null ? "no_data" as const : "live" as const,
        source: "database" as const
      }
    };
  } catch {
    return {
      data: { found: false, match_state: null },
      meta: { status: "degraded" as const, source: "database" as const }
    };
  }
});

app.get("/api/internal/db/odds-snapshots/:fixtureId", async (request) => {
  const { fixtureId } = request.params as { fixtureId: string };
  if (!process.env.DATABASE_URL) {
    return {
      data: { found: false, count: 0, odds_snapshots: [] },
      meta: { status: "no_data" as const, source: "database" as const }
    };
  }

  try {
    const data = await getDbOddsSnapshotsByFixtureId(fixtureId);
    return {
      data,
      meta: {
        status: data.found ? "live" as const : "no_data" as const,
        source: "database" as const
      }
    };
  } catch {
    return {
      data: { found: false, count: 0, odds_snapshots: [] },
      meta: { status: "degraded" as const, source: "database" as const }
    };
  }
});

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

app.post("/api/internal/txline/ingest/fixtures", async (request) => {
  const config = getTxlineConfigFromEnv();
  const body = request.body as {
    competitionId?: unknown;
    startEpochDay?: unknown;
    includeRaw?: unknown;
  } | undefined;
  const competitionId = typeof body?.competitionId === "string"
    ? body.competitionId.trim()
    : typeof body?.competitionId === "number" && Number.isFinite(body.competitionId)
      ? String(body.competitionId)
      : "";
  const startEpochDay = typeof body?.startEpochDay === "number"
    ? body.startEpochDay
    : Number.NaN;
  const includeRaw = body?.includeRaw === true;
  const requested = {
    competition_id: competitionId,
    start_epoch_day: startEpochDay
  };
  const emptyResult = {
    fetched_count: 0,
    normalized_count: 0,
    upserted_count: 0,
    skipped_count: 0,
    failed_count: 0
  };

  if (!competitionId || !Number.isInteger(startEpochDay) || startEpochDay < 0) {
    return {
      data: { requested, result: emptyResult, fixtures: [] },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: "competitionId and startEpochDay are required."
      }
    };
  }

  if (config.dataMode === "mock" || !process.env.DATABASE_URL) {
    return {
      data: { requested, result: emptyResult, fixtures: [] },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: config.dataMode === "mock"
          ? "Fixture ingestion requires live or auto TxLINE mode."
          : "Database is not configured."
      }
    };
  }

  try {
    const ingestion = await ingestTxlineFixtures({
      competitionId,
      startEpochDay,
      includeRaw
    });
    return {
      data: {
        requested,
        result: summarizeFixtureIngestion(ingestion),
        fixtures: ingestion.fixtures
      },
      meta: {
        status: ingestion.failedCount > 0 ? "degraded" as const : "live" as const,
        source: "database" as const,
        mode: "internal" as const
      }
    };
  } catch (error) {
    return {
      data: { requested, result: emptyResult, fixtures: [] },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: safeTxlineError(error).message
      }
    };
  }
});

app.post("/api/internal/txline/ingest/score", async (request) => {
  const config = getTxlineConfigFromEnv();
  const body = request.body as {
    fixtureId?: unknown;
    asOf?: unknown;
    includeRaw?: unknown;
  } | undefined;
  const fixtureId = typeof body?.fixtureId === "string" ? body.fixtureId.trim() : "";
  const rawAsOf = body?.asOf ?? Date.now();
  const normalizedAsOf = normalizeAsOfToEpochMs(String(rawAsOf));
  const asOf = normalizedAsOf === null ? Number.NaN : Number(normalizedAsOf);
  const requested = {
    fixture_id: fixtureId,
    as_of: Number.isFinite(asOf) ? asOf : null
  };
  const emptyResult = {
    fetched_count: 0,
    selected_seq: null,
    selected_ts: null,
    action: null,
    score_available: false,
    upserted: false
  };

  if (!fixtureId || !Number.isFinite(asOf)) {
    return {
      data: { requested, result: emptyResult, match_state: null },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: "fixtureId is required and asOf must be epoch milliseconds or an ISO date string."
      }
    };
  }
  if (config.dataMode === "mock" || !process.env.DATABASE_URL) {
    return {
      data: { requested, result: emptyResult, match_state: null },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: config.dataMode === "mock"
          ? "Score ingestion requires live or auto TxLINE mode."
          : "Database is not configured."
      }
    };
  }

  try {
    const ingestion = await ingestTxlineScoreSnapshot({
      fixtureId,
      asOf,
      includeRaw: body?.includeRaw === true
    });
    return {
      data: {
        requested,
        result: summarizeScoreIngestion(ingestion),
        match_state: ingestion.matchState
      },
      meta: {
        status: ingestion.upserted ? "live" as const : "degraded" as const,
        source: "database" as const,
        mode: "internal" as const
      }
    };
  } catch (error) {
    return {
      data: { requested, result: emptyResult, match_state: null },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: safeTxlineError(error).message
      }
    };
  }
});

app.post("/api/internal/txline/ingest/odds", async (request, reply) => {
  const config = getTxlineConfigFromEnv();
  const body = request.body as {
    fixtureId?: unknown;
    asOf?: unknown;
    includeRaw?: unknown;
  } | undefined;
  const fixtureId = typeof body?.fixtureId === "string" ? body.fixtureId.trim() : "";
  const rawAsOf = body?.asOf ?? Date.now();
  const asOf = normalizeAsOfToEpochMs(String(rawAsOf));
  const requested = {
    fixture_id: fixtureId,
    as_of: asOf ?? String(rawAsOf)
  };
  const emptyResult = {
    fetched_count: 0,
    mapped_count: 0,
    upserted_count: 0,
    skipped_count: 0,
    failed_count: 0
  };

  if (!fixtureId || asOf === null) {
    reply.code(400);
    return {
      data: { requested, result: emptyResult, odds_snapshots: [] },
      meta: {
        status: "error" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: "fixtureId is required and asOf must be epoch milliseconds or an ISO date string."
      }
    };
  }

  if (config.dataMode === "mock" || !process.env.DATABASE_URL) {
    return {
      data: { requested, result: emptyResult, odds_snapshots: [] },
      meta: {
        status: config.dataMode === "mock" ? "error" as const : "no_data" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: config.dataMode === "mock"
          ? "Odds ingestion requires live or auto TxLINE mode."
          : "Database is not configured."
      }
    };
  }

  try {
    const ingestion = await ingestTxlineOddsSnapshot({
      fixtureId,
      asOf,
      includeRaw: body?.includeRaw === true
    });
    const hasFailures = ingestion.result.failed_count > 0;
    return {
      data: ingestion,
      meta: {
        status: hasFailures
          ? "degraded" as const
          : ingestion.result.fetched_count === 0
            ? "no_data" as const
            : "live" as const,
        source: "database" as const,
        mode: "internal" as const
      }
    };
  } catch (error) {
    return {
      data: { requested, result: emptyResult, odds_snapshots: [] },
      meta: {
        status: "degraded" as const,
        source: "database" as const,
        mode: "internal" as const,
        message: safeTxlineError(error).message
      }
    };
  }
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

const replayMeta = {
  status: "replay" as const,
  source: "replay" as const,
  mode: "demo" as const
};

app.post("/api/replay/start", async (request, reply) => {
  const body = request.body as { seed?: string; speed?: unknown } | undefined;

  try {
    const { session, timeline } = createReplaySession(body);
    const state = buildReplayState(session, timeline);

    return {
      data: {
        session,
        replay: {
          fixture_id: state.fixture_id,
          current_event: state.current_event,
          timeline_count: state.timeline_count,
          summary: state.summary
        }
      },
      meta: replayMeta
    };
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      reply.code(400);
      return {
        data: null,
        meta: { ...replayMeta, error: error.code, message: error.message }
      };
    }

    throw error;
  }
});

app.get("/api/replay/:sessionId", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const replay = getReplaySession(sessionId);

  if (replay === null) {
    reply.code(404);
    return {
      data: null,
      meta: { ...replayMeta, error: "session_not_found", message: "Replay session not found." }
    };
  }

  return {
    data: {
      session: replay.session,
      state: buildReplayState(replay.session, replay.timeline)
    },
    meta: replayMeta
  };
});

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
