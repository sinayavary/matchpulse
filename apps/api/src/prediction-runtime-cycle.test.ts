import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { runPredictionRuntimeCycle } from "./prediction-runtime-cycle.js";

function input(sequence: number) { const features = buildPredictionEngineFeatures({ fixture_id: "f", as_of: "2026-01-01T12:00:00Z", normalized_phase: "second_half", minute: 60, home_score: 1, away_score: 0, sequence }); return { fixture_id: "f", as_of: "2026-01-01T12:00:00Z", sequence, trigger: "timer" as const, features, feature_bundle: {} }; }

test("runtime cycle returns safe counts and keeps persistence errors bounded", async () => {
  const calls: string[] = []; const result = await runPredictionRuntimeCycle([input(1), input(2), input(3)], { concurrency: 2, persist: async (request) => { calls.push(String(request.sequence)); if (request.sequence === 2) throw new Error("storage failure"); } });
  assert.equal(result.status, "partial"); assert.equal(result.requested, 3); assert.equal(result.persisted, 2); assert.equal(result.failed, 1); assert.equal(calls.length, 3);
});

test("repeated cycle input is skipped by the shared dedupe set", async () => { const seen = new Set<string>(); let writes = 0; const first = await runPredictionRuntimeCycle([input(1)], { seen, persist: async () => { writes++; } }); const second = await runPredictionRuntimeCycle([input(1)], { seen, persist: async () => { writes++; } }); assert.equal(first.persisted, 1); assert.equal(second.skipped, 1); assert.equal(writes, 1); });
