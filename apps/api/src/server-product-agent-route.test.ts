import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerInternalProductAgentRoute } from "./server-product-agent-route.js";
import type { ProductAgentV1Response } from "./product-agent-v1.js";

const TOKEN = "route-test-secret";

function safeResponse(): ProductAgentV1Response {
  return {
    data: {
      agent_version: "product-agent-v1",
      fixture_id: "fixture-1",
      status: "ready",
      headline: "Match data is ready.",
      summary: "Fixture data is available for internal review.",
      readiness: { display_ready: true, has_fixture: true, has_scoreboard: true, has_odds: true, is_stale: false },
      data_quality: { level: "complete", issues: [] },
      freshness: { latest_data_timestamp: "2026-07-10T10:00:00.000Z", freshness_label: "fresh", note: "Data is fresh." },
      signal_brief: { total: 0, critical: 0, warning: 0, info: 0, top_signals: [] },
      decision_context: {
        attention_level: "none",
        readiness_level: "ready",
        market_reliability_level: "available",
        event_pressure_level: "none",
        operator_guidance: [],
        limitations: []
      },
      user_facing_notes: [],
      safe_scope_note: "Data availability and quality only."
    },
    meta: { status: "live", source: "product-agent", mode: "internal" }
  };
}

function createApp(
  getProductAgentV1ForFixture?: (fixtureId: string, options?: Record<string, unknown>) => Promise<ProductAgentV1Response>,
  env: Record<string, string | undefined> = { MATCHPULSE_INTERNAL_TOKEN: TOKEN }
) {
  const app = Fastify();
  registerInternalProductAgentRoute(app, {
    env,
    getProductAgentV1ForFixture: getProductAgentV1ForFixture as never
  });
  return app;
}

test("missing internal auth configuration is a safe 503", async () => {
  const app = createApp(undefined, {});
  const response = await app.inject({ method: "GET", url: "/api/internal/product-agent/matches/fixture-1/insight" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { data: null, meta: { status: "degraded", source: "product-agent", mode: "internal", message: "Internal auth is not configured." } });
  await app.close();
});

test("missing, wrong, and malformed credentials are rejected without secrets", async () => {
  for (const headers of [{}, { "x-matchpulse-internal-token": "wrong" }, { authorization: "Basic abc" }]) {
    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/api/internal/product-agent/matches/fixture-1/insight", headers });
    assert.equal(response.statusCode, 401);
    const body = response.body.toLowerCase();
    assert.equal(body.includes(TOKEN), false);
    assert.equal(body.includes("expected"), false);
    assert.equal(body.includes("provided"), false);
    await app.close();
  }
});

test("valid header auth supports defaults, bounded query values, and bearer auth", async () => {
  let seen: { fixtureId: string; options?: Record<string, unknown> } | undefined;
  const app = createApp(async (fixtureId, options) => {
    seen = { fixtureId, options };
    return safeResponse();
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/internal/product-agent/matches/fixture-1/insight?staleAfterMinutes=0&oddsLimit=999&includeEventImpact=false&includeOddsReliability=false",
    headers: { "x-matchpulse-internal-token": TOKEN }
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(seen, {
    fixtureId: "fixture-1",
    options: { staleAfterMinutes: 1, oddsLimit: 50, includeEventImpact: false, includeOddsReliability: false }
  });
  assert.equal(response.json().meta.mode, "internal");
  await app.close();

  const bearerApp = createApp(async () => safeResponse());
  const bearerResponse = await bearerApp.inject({
    method: "GET",
    url: "/api/internal/product-agent/matches/fixture-1/insight",
    headers: { authorization: `Bearer ${TOKEN}` }
  });
  assert.equal(bearerResponse.statusCode, 200);
  await bearerApp.close();
});

test("defaults are forwarded and unknown query parameters are rejected", async () => {
  let options: Record<string, unknown> | undefined;
  const app = createApp(async (_fixtureId, received) => {
    options = received;
    return safeResponse();
  });
  const ok = await app.inject({ method: "GET", url: "/api/internal/product-agent/matches/fixture-1", headers: { "x-matchpulse-internal-token": TOKEN } });
  assert.equal(ok.statusCode, 404);
  const response = await app.inject({ method: "GET", url: "/api/internal/product-agent/matches/fixture-1/insight?unexpected=true", headers: { "x-matchpulse-internal-token": TOKEN } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.includes("unexpected"), false);
  assert.deepEqual(options, undefined);
  await app.close();
});

test("Product Agent failures and unsafe output are bounded safe 503 responses", async () => {
  for (const getProductAgentV1ForFixture of [
    async () => { throw new Error("secret stack details"); },
    async () => ({ ...safeResponse(), data: { ...safeResponse().data, raw: "SignalCore output" } } as never),
    async () => ({ ...safeResponse(), data: { ...safeResponse().data, internal_context: {} } } as never)
  ]) {
    const app = createApp(getProductAgentV1ForFixture);
    const response = await app.inject({ method: "GET", url: "/api/internal/product-agent/matches/fixture-1/insight", headers: { "x-matchpulse-internal-token": TOKEN } });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json().data, null);
    assert.equal(response.body.includes("secret stack details"), false);
    await app.close();
  }
});
