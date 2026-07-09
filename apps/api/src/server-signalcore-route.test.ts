import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerInternalSignalCoreRoute } from "./server-signalcore-route.js";
import type {
  SignalCoreV0Options,
  SignalCoreV0Response,
  SignalCoreV0Signal
} from "./signalcore-v0.js";

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
    "recommendation",
    "recommended_bet",
    "bet",
    "wager",
    "stake",
    "expected_value",
    "edge",
    "prediction",
    "winner"
  ]) {
    if (keys.has(key)) return true;
  }
  return false;
}

function makeSignalCoreResponse(includePressureSignal: boolean): SignalCoreV0Response {
  const signals: SignalCoreV0Signal[] = includePressureSignal
    ? [{
        type: "PRESSURE_HINT_AVAILABLE",
        severity: "info",
        title: "Pressure hint available",
        message: "Rule-based pressure hint is available from stored score data.",
        details: {
          fixture_id: "17952170",
          pressure_kind: "rule_based_pressure_hint",
          pressure_level: "medium",
          pressure_score: 4,
          source: "stored_scores_snapshot",
          adapter_status: "available",
          evidence_count: 2,
          evaluated_records: 10,
          usable_records: 8,
          latest_seq: 12,
          latest_ts: 1720170960000,
          limitations: []
        }
      }]
    : [];

  return {
    data: {
      fixture_id: "17952170",
      summary: {
        status: includePressureSignal ? "ready" : "empty",
        signal_count: signals.length,
        critical_count: 0,
        warning_count: 0,
        info_count: signals.length,
        has_fixture: true,
        has_scoreboard: true,
        has_odds: true,
        latest_data_timestamp: "2026-07-05T11:56:00.000Z"
      },
      signals
    },
    meta: {
      status: "live",
      source: "signalcore",
      mode: "internal"
    }
  };
}

test("internal signalcore route works without pressure", async () => {
  const app = Fastify();
  registerInternalSignalCoreRoute(app, {
    getSignalCoreV0ForFixture: async () => makeSignalCoreResponse(false)
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/internal/signalcore/matches/17952170?includePressure=false"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.source, "signalcore");
  assert.equal(body.meta.mode, "internal");
  assert.equal(body.data.signals.some((signal: { type: string }) => signal.type === "PRESSURE_HINT_AVAILABLE"), false);
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});

test("internal signalcore route accepts pressure params", async () => {
  const app = Fastify();
  let seenOptions: SignalCoreV0Options | null = null;
  registerInternalSignalCoreRoute(app, {
    getSignalCoreV0ForFixture: async (_fixtureId, options) => {
      seenOptions = options ?? null;
      return makeSignalCoreResponse(true);
    }
  });

  const response = await app.inject({
    method: "GET",
    url:
      "/api/internal/signalcore/matches/17952170?includePressure=true&pressureWindowSize=10&pressureMaxEvidence=8&pressureMaxPayloadAgeMinutes=10080"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.source, "signalcore");
  assert.equal(body.meta.mode, "internal");
  if (seenOptions === null) {
    throw new Error("Expected the route to forward signalcore options");
  }
  const capturedOptions = seenOptions as SignalCoreV0Options;
  assert.equal(capturedOptions.includeState, undefined);
  assert.equal(capturedOptions.includePressure, true);
  assert.equal(capturedOptions.oddsLimit, undefined);
  assert.equal(capturedOptions.staleAfterMinutes, undefined);
  assert.equal(capturedOptions.pressureWindowSize, 10);
  assert.equal(capturedOptions.pressureMaxEvidence, 8);
  assert.equal(capturedOptions.pressureMaxPayloadAgeMinutes, 10080);
  const pressureSignal = body.data.signals.find(
    (signal: { type: string }) => signal.type === "PRESSURE_HINT_AVAILABLE"
  );
  assert.equal(Boolean(pressureSignal), true);
  if (pressureSignal !== undefined) {
    assert.equal(pressureSignal.details.fixture_id, "17952170");
    assert.equal(pressureSignal.details.pressure_kind, "rule_based_pressure_hint");
    assert.equal(pressureSignal.details.source, "stored_scores_snapshot");
  }
  assert.equal(hasForbiddenKeys(body), false);
  await app.close();
});

test("invalid pressure numeric params do not crash", async () => {
  const app = Fastify();
  let seenOptions: SignalCoreV0Options | null = null;
  registerInternalSignalCoreRoute(app, {
    getSignalCoreV0ForFixture: async (_fixtureId, options) => {
      seenOptions = options ?? null;
      return makeSignalCoreResponse(true);
    }
  });

  const response = await app.inject({
    method: "GET",
    url:
      "/api/internal/signalcore/matches/17952170?includePressure=true&pressureWindowSize=abc&pressureMaxEvidence=abc&pressureMaxPayloadAgeMinutes=abc"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(typeof body, "object");
  assert.equal(body.meta.source, "signalcore");
  assert.equal(body.meta.mode, "internal");
  if (seenOptions === null) {
    throw new Error("Expected the route to forward signalcore options");
  }
  const capturedOptions = seenOptions as SignalCoreV0Options;
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
