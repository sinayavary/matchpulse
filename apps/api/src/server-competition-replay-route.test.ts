import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerCompetitionPredictionRoutes } from "./server-competition-prediction-route.js";

function createApp() {
  const app = Fastify();
  registerCompetitionPredictionRoutes(app, {
    env: { MATCHPULSE_INTERNAL_TOKEN: "unused-replay-token" },
  });
  return app;
}

test("public replay index lists deterministic checkpoints without authentication", async () => {
  const app = createApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/public/v1/competition/replay",
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.mode, "replay");
  assert.deepEqual(
    body.data.map((checkpoint: { checkpoint_id: string }) => checkpoint.checkpoint_id),
    ["opening-balance", "pressure-shift", "terminal-home"],
  );
  await app.close();
});

test("public replay detail keeps prediction and market analysis separately labeled", async () => {
  const app = createApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/public/v1/competition/replay/pressure-shift",
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.mode, "replay");
  assert.equal(body.data.fixture_id, "competition-replay-demo");
  assert.equal(body.market_analysis.fixture_id, "competition-replay-demo");
  assert.equal(body.market_analysis.freshness, "aging");
  assert.equal(body.market_analysis.volatility, "high");
  assert.equal("market_analysis" in body.data, false);
  for (const forbidden of [
    "specialist_contributions",
    "feature_reference",
    "odds_intelligence_reference",
    "assessment_id",
    "approved_model_weight_cap",
    "replay-private-shift",
    "provider_payload",
  ]) {
    assert.equal(response.body.includes(forbidden), false, forbidden);
  }
  await app.close();
});

test("terminal replay checkpoint returns bounded terminal probabilities", async () => {
  const app = createApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/public/v1/competition/replay/terminal-home",
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.match_state.normalized_phase, "finished");
  assert.deepEqual(body.data.final_outcome, { home: 1, draw: 0, away: 0 });
  assert.equal(body.data.next_goal.none, 1);
  assert.equal(body.market_analysis.freshness, "stale");
  assert.equal(body.market_analysis.usable_market_count, 0);
  await app.close();
});

test("missing replay checkpoint returns sanitized no-data boundary", async () => {
  const app = createApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/public/v1/competition/replay/private-provider-checkpoint",
  });
  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.data, null);
  assert.equal(body.meta.mode, "replay");
  assert.equal(body.market_analysis.availability, "unavailable");
  assert.equal(response.body.includes("private-provider-checkpoint"), false);
  await app.close();
});

test("replay routes reject unknown query parameters without echoing them", async () => {
  for (const url of [
    "/api/public/v1/competition/replay?privateDebug=true",
    "/api/public/v1/competition/replay/opening-balance?privateDebug=true",
  ]) {
    const app = createApp();
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.includes("privateDebug"), false);
    await app.close();
  }
});
