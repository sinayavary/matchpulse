import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { readMock, response, notFoundResponse } from "./mock-store.js";
import type { MatchState } from "@matchpulse/shared";
import {
  getTxlineConfigFromEnv,
  toTxlineStatusData
} from "@matchpulse/txline-client";

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
      mode: txlineConfig.network
    }
  };
});

app.get("/api/matches", async () => response(readMock("matches.json")));
app.get("/api/matches/live", async () => response(readMock("matches.json")));
app.get("/api/matches/:fixtureId", async (request, reply) => {
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
