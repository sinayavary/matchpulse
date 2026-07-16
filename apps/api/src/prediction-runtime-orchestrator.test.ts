import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { orchestratePrediction, orchestratePredictionBatch, shouldRunPrediction } from "./prediction-runtime-orchestrator.js";

function request(sequence = 1) { const features = buildPredictionEngineFeatures({ fixture_id: "f", as_of: "2026-01-01T12:00:00Z", normalized_phase: "second_half", minute: 60, home_score: 1, away_score: 0, sequence }); return { fixture_id: "f", as_of: "2026-01-01T12:00:00Z", sequence, trigger: "score_change" as const, features }; }

test("orchestrator applies as-of boundary, deduplication, and persistence once", async () => {
  const seen = new Set<string>(); let writes = 0; const persist = async () => { writes++; }; const input = request();
  assert.equal(shouldRunPrediction(input, seen), true); const first = await orchestratePrediction(input, { seen, persist }); const second = await orchestratePrediction(input, { seen, persist });
  assert.equal(first.persisted, true); assert.equal(second.persisted, false); assert.equal(writes, 1); assert.equal(first.snapshot.identity.as_of, "2026-01-01T12:00:00.000Z");
});

test("batch orchestration bounds concurrency and preserves order", async () => {
  let active = 0; let peak = 0; const writes: string[] = []; const inputs = [request(1), request(2), request(3), request(4)];
  const results = await orchestratePredictionBatch(inputs, { concurrency: 2, persist: async ({ dedupe_key }) => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; writes.push(dedupe_key); } });
  assert.equal(results.length, 4); assert.equal(peak, 2); assert.equal(writes.length, 4); assert.equal(results[0]?.snapshot.identity.sequence, 1);
});
