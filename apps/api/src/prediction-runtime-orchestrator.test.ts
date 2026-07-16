import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { orchestratePrediction, orchestratePredictionBatch, shouldRunPrediction } from "./prediction-runtime-orchestrator.js";
import { buildRuntimeFeatureSnapshotId, createPredictionRuntimePersistence } from "./prediction-runtime-storage.js";

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

test("runtime storage adapter persists feature reference before prediction", async () => {
  const input = request(); const calls: string[] = []; const storage = { savePredictionFeatureSnapshot: async (value: unknown) => { calls.push(`feature:${(value as { snapshot_id: string }).snapshot_id}`); }, saveFinalPredictionSnapshot: async (value: unknown) => { calls.push(`prediction:${(value as { feature_snapshot_id: string }).feature_snapshot_id}`); } };
  const bundle = { feature_version: "prediction-features-v1", fixture_id: "f", generated_at: input.as_of, normalized_phase: "second_half", input_summary: { fixture_id: "f", phase: "second_half", minute: 60, home_score: 1, away_score: 0, score_diff: 1, has_scoreboard: true, has_odds: false, odds_count: 0, data_quality: "partial", freshness_label: "fresh", market_reliability: "unavailable", event_pressure: "none" }, features: { phase_progress: 0.5, phase_known: 1, minute_progress: 0.5, minute_known: 1, score_known: 1, home_score_norm: 0.1, away_score_norm: 0, score_diff_norm: 0.2, total_goals_norm: 0.1, scoreboard_available: 1, odds_available: 0, odds_count_norm: 0, market_count_norm: 0, provider_count_norm: 0, odds_up_share: 0, odds_down_share: 0, odds_stable_share: 0, odds_unknown_direction_share: 0, odds_movement_share: 0, market_reliability_score: 0, event_pressure_score: 0, event_impact_score: 0, event_count_norm: 0, key_event_count_norm: 0, freshness_known: 1, freshness_score: 1, data_age_norm: 0, data_quality_score: 0.5, coverage_score: 0.2 }, diagnostics: { missing_inputs: [], limitations: [] } };
  const persist = createPredictionRuntimePersistence(undefined, storage);
  const result = await orchestratePrediction(input, { persist: (value) => persist(input, value, bundle) });
  assert.equal(result.persisted, true); assert.deepEqual(calls, [`feature:${buildRuntimeFeatureSnapshotId(input.features)}`, `prediction:${buildRuntimeFeatureSnapshotId(input.features)}`]);
});
