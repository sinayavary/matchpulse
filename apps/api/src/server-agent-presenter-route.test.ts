import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerInternalAgentPresenterRoute } from "./server-agent-presenter-route.js";
import type { AgentPresenterOptions, AgentPresenterResponse } from "./agent-presenter-v0.js";

const ALLOWED_PRESSURE_HINT_KEYS = [
  "evidence_count",
  "label",
  "level",
  "limitations",
  "safe_scope_note",
  "source"
];

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

function hasForbiddenKeys(value: unknown): boolean {
  const keys = new Set(collectKeys(value));
  for (const key of [
    "confidence",
    "probability",
    "prediction",
    "recommendation",
    "recommended_bet",
    "bet",
    "wager",
    "stake",
    "expected_value",
    "edge",
    "winner",
    "profit",
    "payout",
    "wallet",
    "deposit",
    "pressure_score",
    "adapter_status",
    "debug_lineage",
    "raw_payload",
    "primary_side",
    "formula"
  ]) {
    if (keys.has(key)) return true;
  }
  return false;
}

function makePresenterResponse(includePressureHint: boolean): AgentPresenterResponse {
  return {
    data: {
      fixture_id: "17952170",
      agent_version: "presenter-v0",
      brief: {
        status_label: "ready",
        headline: "Match data is ready for safe display.",
        overview: "Fixture, scoreboard, and odds data are available for safe display.",
        available_data: ["Fixture identity is available."],
        missing_data: [],
        freshness_note: "Latest persisted data is within the freshness window.",
        quality_notes: [],
        safe_scope_note:
          "This brief only describes data availability, freshness, and quality for safe display."
      },
      signal_summary: {
        status: "ready",
        signal_count: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        has_fixture: true,
        has_scoreboard: true,
        has_odds: true,
        latest_data_timestamp: "2026-07-05T12:15:00.000Z"
      },
      signals: [],
      ...(includePressureHint
        ? {
            pressure_hint: {
              label: "Medium pressure hint" as const,
              level: "medium" as const,
              source: "stored_scores_snapshot" as const,
              evidence_count: 4,
              limitations: [],
              safe_scope_note:
                "This pressure hint is rule-based and based on available stored score data. It is not a prediction, probability, or betting recommendation."
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

test("internal agent presenter route works without pressure", async () => {
  const app = Fastify();
  registerInternalAgentPresenterRoute(app, {
    getAgentPresenterBriefForFixture: async () => makePresenterResponse(false)
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/internal/agent/matches/17952170/brief?includePressure=false"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.source, "agent-presenter");
  assert.equal(body.meta.mode, "internal");
  assert.equal("pressure_hint" in body.data, false);
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});

test("internal agent presenter route accepts pressure params and forwards options", async () => {
  const app = Fastify();
  let seenOptions: AgentPresenterOptions | null = null;
  registerInternalAgentPresenterRoute(app, {
    getAgentPresenterBriefForFixture: async (_fixtureId, options) => {
      seenOptions = options ?? null;
      return makePresenterResponse(true);
    }
  });

  const response = await app.inject({
    method: "GET",
    url:
      "/api/internal/agent/matches/17952170/brief?includePressure=true&pressureWindowSize=10&pressureMaxEvidence=8&pressureMaxPayloadAgeMinutes=10080&format=full"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.source, "agent-presenter");
  assert.equal(body.meta.mode, "internal");
  if (seenOptions === null) {
    throw new Error("Expected the route to forward agent presenter options");
  }
  const capturedOptions = seenOptions as AgentPresenterOptions;
  assert.equal(capturedOptions.includeState, undefined);
  assert.equal(capturedOptions.includePressure, true);
  assert.equal(capturedOptions.oddsLimit, undefined);
  assert.equal(capturedOptions.staleAfterMinutes, undefined);
  assert.equal(capturedOptions.pressureWindowSize, 10);
  assert.equal(capturedOptions.pressureMaxEvidence, 8);
  assert.equal(capturedOptions.pressureMaxPayloadAgeMinutes, 10080);
  assert.equal(capturedOptions.format, "full");
  assert.deepEqual(body.data.pressure_hint, makePresenterResponse(true).data.pressure_hint);
  assert.deepEqual(Object.keys(body.data.pressure_hint).sort(), ALLOWED_PRESSURE_HINT_KEYS);
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});

test("invalid pressure numeric params do not crash", async () => {
  const app = Fastify();
  let seenOptions: AgentPresenterOptions | null = null;
  registerInternalAgentPresenterRoute(app, {
    getAgentPresenterBriefForFixture: async (_fixtureId, options) => {
      seenOptions = options ?? null;
      return makePresenterResponse(true);
    }
  });

  const response = await app.inject({
    method: "GET",
    url:
      "/api/internal/agent/matches/17952170/brief?includePressure=true&pressureWindowSize=abc&pressureMaxEvidence=abc&pressureMaxPayloadAgeMinutes=abc"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(typeof body, "object");
  assert.equal(body.meta.source, "agent-presenter");
  assert.equal(body.meta.mode, "internal");
  if (seenOptions === null) {
    throw new Error("Expected the route to forward agent presenter options");
  }
  const capturedOptions = seenOptions as AgentPresenterOptions;
  assert.equal(capturedOptions.includeState, undefined);
  assert.equal(capturedOptions.includePressure, true);
  assert.equal(capturedOptions.oddsLimit, undefined);
  assert.equal(capturedOptions.staleAfterMinutes, undefined);
  assert.equal(Number.isNaN(capturedOptions.pressureWindowSize ?? Number.NaN), true);
  assert.equal(Number.isNaN(capturedOptions.pressureMaxEvidence ?? Number.NaN), true);
  assert.equal(Number.isNaN(capturedOptions.pressureMaxPayloadAgeMinutes ?? Number.NaN), true);
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});

test("default route stays compact", async () => {
  const app = Fastify();
  let seenOptions: AgentPresenterOptions | null = null;
  registerInternalAgentPresenterRoute(app, {
    getAgentPresenterBriefForFixture: async (_fixtureId, options) => {
      seenOptions = options ?? null;
      return makePresenterResponse(false);
    }
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/internal/agent/matches/17952170/brief"
  });

  assert.equal(response.statusCode, 200);
  if (seenOptions === null) {
    throw new Error("Expected the route to forward agent presenter options");
  }
  const capturedOptions = seenOptions as AgentPresenterOptions;
  assert.equal(capturedOptions.includePressure, undefined);
  assert.equal(capturedOptions.format, "compact");
  await app.close();
});

test("forbidden key scan passes on response JSON property keys", async () => {
  const app = Fastify();
  registerInternalAgentPresenterRoute(app, {
    getAgentPresenterBriefForFixture: async () => makePresenterResponse(true)
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/internal/agent/matches/17952170/brief?includePressure=true"
  });

  const body = response.json();
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});
