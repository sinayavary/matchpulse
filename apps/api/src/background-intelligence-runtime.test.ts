import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalMatchState } from "./match-state-builder.js";
import { runBackgroundIntelligenceCycle } from "./background-intelligence-runtime.js";
import type { ProductAgentV1Response } from "./product-agent-v1.js";

function state(fixtureId: string) {
  return buildCanonicalMatchState({
    fixtureId,
    fixture: { fixtureId, competition: "430", homeTeam: "Home", awayTeam: "Away", startTimeUtc: new Date("2026-07-18T12:00:00Z"), status: "1H" },
    scoreboard: { homeScore: 1, awayScore: 0, phase: "1H", lastDataReceivedAt: new Date("2026-07-18T12:00:00Z") },
    odds: [],
    builtAt: new Date("2026-07-18T12:01:00Z")
  });
}

function agent(fixtureId: string): ProductAgentV1Response {
  return {
    data: {
      fixture_id: fixtureId,
      agent_version: "product-agent-v1" as const,
      status: "partial" as const,
      headline: "safe",
      summary: "safe",
      readiness: { display_ready: true, has_fixture: true, has_scoreboard: true, has_odds: false, is_stale: false },
      data_quality: { level: "partial" as const, issues: ["odds_missing"] },
      freshness: { freshness_label: "fresh" as const, latest_data_timestamp: "2026-07-18T12:00:00Z", note: "fresh" },
      signal_brief: { total: 0, critical: 0, warning: 0, info: 0, top_signals: [] },
      decision_context: {
        attention_level: "low",
        readiness_level: "limited",
        market_reliability_level: "unavailable",
        event_pressure_level: "none",
        operator_guidance: [],
        limitations: ["odds_missing"]
      },
      user_facing_notes: [],
      safe_scope_note: "safe"
    },
    meta: { status: "degraded" as const, source: "product-agent" as const, mode: "internal" as const }
  };
}

test("runs Agent and Prediction automatically per fixture and persists once", async () => {
  const calls: string[] = [];
  const result = await runBackgroundIntelligenceCycle({
    listFixtureIds: async () => ["fixture-a"],
    getState: async () => state("fixture-a"),
    runAgent: async (fixtureId) => { calls.push(`agent:${fixtureId}`); return agent(fixtureId); },
    persistPrediction: async (_input, _result, bundle) => { calls.push(`prediction:${String(bundle.fixture_id)}`); },
    now: () => new Date("2026-07-18T12:01:00Z")
  });
  assert.equal(result.status, "ok");
  assert.equal(result.agent_succeeded, 1);
  assert.equal(result.prediction_persisted, 1);
  assert.deepEqual(calls, ["agent:fixture-a", "prediction:fixture-a"]);
});

test("same input hash is deduplicated without duplicate persistence", async () => {
  let writes = 0;
  const dependencies = {
    listFixtureIds: async () => ["fixture-dedupe"],
    getState: async () => state("fixture-dedupe"),
    runAgent: async (fixtureId: string) => agent(fixtureId),
    persistPrediction: async () => { writes += 1; },
    now: () => new Date("2026-07-18T12:01:00Z")
  };
  const first = await runBackgroundIntelligenceCycle(dependencies);
  const second = await runBackgroundIntelligenceCycle(dependencies);
  assert.equal(first.prediction_persisted, 1);
  assert.equal(second.prediction_deduplicated, 1);
  assert.equal(writes, 1);
});

test("one fixture failure does not stop other fixtures", async () => {
  const result = await runBackgroundIntelligenceCycle({
    listFixtureIds: async () => ["bad", "good"],
    getState: async (fixtureId) => { if (fixtureId === "bad") throw new Error("upstream"); return state(fixtureId); },
    runAgent: async (fixtureId) => agent(fixtureId),
    persistPrediction: async () => undefined,
    now: () => new Date("2026-07-18T12:01:00Z")
  });
  assert.equal(result.status, "partial");
  assert.equal(result.failed, 1);
  assert.equal(result.agent_succeeded, 1);
  assert.equal(result.fixtures.find((item) => item.fixture_id === "good")?.status, "ok");
});
