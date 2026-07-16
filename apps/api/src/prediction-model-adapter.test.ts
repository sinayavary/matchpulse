import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { runPredictionModelAdapter } from "./prediction-model-adapter.js";

function input() { const features = buildPredictionEngineFeatures({ fixture_id: "adapter-fixture", as_of: "2026-01-01T12:00:00.000Z", normalized_phase: "second_half", minute: 60, home_score: 1, away_score: 0 }); return { features, trigger: "manual" as const }; }

test("adapter uses deterministic baseline when private model is unavailable", async () => { const result = await runPredictionModelAdapter(input()); assert.equal(result.status, "deterministic_fallback"); assert.equal(result.snapshot.identity.fixture_id, "adapter-fixture"); });
test("adapter applies only a validated private outcome and degrades safely", async () => {
  const applied = await runPredictionModelAdapter(input(), async () => ({ final_outcome: { home: 0.6, draw: 0.2, away: 0.2 } }));
  assert.equal(applied.status, "private_model_applied"); assert.deepEqual(applied.snapshot.model_output.final_outcome, { home: 0.6, draw: 0.2, away: 0.2 });
  const degraded = await runPredictionModelAdapter(input(), async () => ({ final_outcome: { home: 0.9, draw: 0.9, away: 0 } })); assert.equal(degraded.status, "private_model_degraded");
});
