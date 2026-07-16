import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { buildPredictionEngineFeatures } from "./prediction-engine-features.js";
import { orchestratePrediction } from "./prediction-runtime-orchestrator.js";
import { createPredictionRuntimePersistence } from "./prediction-runtime-storage.js";

const enabled = process.env.MATCHPULSE_LOCAL_INTEGRATION === "1";
const prisma = new PrismaClient();

function bundle(asOf: string) {
  return { feature_version: "prediction-features-v1", fixture_id: "local-runtime-fixture", generated_at: asOf, normalized_phase: "second_half", input_summary: { fixture_id: "local-runtime-fixture", phase: "second_half", minute: 60, home_score: 1, away_score: 0, score_diff: 1, has_scoreboard: true, has_odds: false, odds_count: 0, data_quality: "partial", freshness_label: "fresh", market_reliability: "unavailable", event_pressure: "none" }, features: { phase_progress: 0.5, phase_known: 1, minute_progress: 0.5, minute_known: 1, score_known: 1, home_score_norm: 0.1, away_score_norm: 0, score_diff_norm: 0.2, total_goals_norm: 0.1, scoreboard_available: 1, odds_available: 0, odds_count_norm: 0, market_count_norm: 0, provider_count_norm: 0, odds_up_share: 0, odds_down_share: 0, odds_stable_share: 0, odds_unknown_direction_share: 0, odds_movement_share: 0, market_reliability_score: 0, event_pressure_score: 0, event_impact_score: 0, event_count_norm: 0, key_event_count_norm: 0, freshness_known: 1, freshness_score: 1, data_age_norm: 0, data_quality_score: 0.5, coverage_score: 0.2 }, diagnostics: { missing_inputs: [], limitations: [] } };
}

test("local runtime persists and reads linked snapshots", { skip: !enabled }, async () => {
  const asOf = "2026-01-01T12:00:00.000Z"; const features = buildPredictionEngineFeatures({ fixture_id: "local-runtime-fixture", as_of: asOf, normalized_phase: "second_half", minute: 60, home_score: 1, away_score: 0, sequence: 1 }); const input = { fixture_id: "local-runtime-fixture", as_of: asOf, sequence: 1, trigger: "manual" as const, features }; const featureBundle = bundle(asOf); const persist = createPredictionRuntimePersistence(prisma as any);
  let snapshotId: string | null = null;
  try {
    const result = await orchestratePrediction(input, { persist: (value) => persist(input, value, featureBundle) });
    snapshotId = result.snapshot.identity.snapshot_id;
    const featureId = `feature-snapshot-v1:${features.fixture_id}:${features.feature_hash}`;
    const feature = await prisma.predictionFeatureSnapshot.findUnique({ where: { snapshotId: featureId } }); const snapshot = await prisma.predictionSnapshotRecord.findUnique({ where: { snapshotId: result.snapshot.identity.snapshot_id } });
    assert.equal(result.persisted, true); assert.equal(feature?.featureVersion, "prediction-features-v1"); assert.equal(snapshot?.featureSnapshotId, featureId);
  } finally {
    if (snapshotId !== null) await prisma.predictionSnapshotRecord.deleteMany({ where: { snapshotId } });
    await prisma.predictionSnapshotRecord.deleteMany({ where: { fixtureId: "local-runtime-fixture" } }); await prisma.predictionFeatureSnapshot.deleteMany({ where: { fixtureId: "local-runtime-fixture" } });
    await prisma.$disconnect();
  }
});

if (!enabled) await prisma.$disconnect();
