import assert from "node:assert/strict";
import { test } from "node:test";
import type { InternalIntelligenceContext } from "./internal-intelligence-context.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import {
  assertPredictionFeatureBundleValid,
  buildPredictionFeatureBundle,
  normalizePredictionPhase
} from "./prediction-feature-builder.js";

const generatedAt = "2026-07-10T12:00:00.000Z";
function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  return {
    fixture_id: "fixture-1", identity: { fixture_id: "fixture-1", competition: "League", home_team: "Home", away_team: "Away", start_time_utc: null, status: "live" },
    scoreboard: { available: true, home_score: 3, away_score: 1, phase: "live", last_data_received_at: "2026-07-10T11:30:00.000Z" },
    odds: { available: true, count: 4, markets: [
      { market_id: "1x2", market_name: "Result", selection_name: "Home", odds: 2, direction: "up", source_timestamp: null },
      { market_id: "1x2", market_name: "Result", selection_name: "Draw", odds: 3, direction: "down", source_timestamp: null },
      { market_id: "totals", market_name: "Totals", selection_name: "Over", odds: 2, direction: "stable", source_timestamp: null },
      { market_id: "totals", market_name: "Totals", selection_name: "Under", odds: 2, direction: "mystery", source_timestamp: null }
    ] },
    freshness: { built_at: generatedAt, latest_score_timestamp: "2026-07-10T11:30:00.000Z", latest_odds_timestamp: null, latest_data_timestamp: "2026-07-10T11:30:00.000Z" },
    quality: { status: "complete", has_fixture: true, has_scoreboard: true, has_odds: true, issues: [] },
    ...overrides
  };
}
function makeContext(): InternalIntelligenceContext {
  return {
    fixture_id: "fixture-1", status: "available", generated_at: generatedAt,
    data_readiness: { has_fixture: true, has_scoreboard: true, has_odds: true, has_events: true, has_event_impact: true, quality_status: "complete", quality_issues: [] },
    match_state: { phase: "live", home_score: 3, away_score: 1, last_data_received_at: "2026-07-10T11:30:00.000Z", freshness_label: "Stored scoreboard timestamp available" },
    odds_reliability: { status: "available", snapshot_count: 4, market_count: 2, provider_count: 2, latest_timestamp: generatedAt, limitations: [] },
    event_context: { event_count: 10, latest_event_timestamp: generatedAt, pressure_level: "high", pressure_label: "high", timeline_summary: { goals: 2, yellow_cards: 1, red_cards: 0, substitutions: 0, penalties: 0, var_events: 0, other_events: 0 } },
    event_impact: { impact_level: "medium", impact_label: "medium", key_event_count: 3, impact_summary: { goals: 2, cards: 1, red_cards: 0, penalties: 0, var_events: 0, substitutions: 0, pressure_level: "high" } },
    limitations: [], safe_scope_note: "safe"
  };
}

test("builds a complete bounded feature bundle without exposing source data", () => {
  const state = makeState(); const context = makeContext();
  const stateBefore = structuredClone(state); const contextBefore = structuredClone(context);
  const bundle = buildPredictionFeatureBundle({ state, context, minute: 46, generated_at: generatedAt });
  assert.equal(bundle.normalized_phase, "second_half");
  assert.deepEqual(bundle.input_summary, { fixture_id: "fixture-1", phase: "live", minute: 46, home_score: 3, away_score: 1, score_diff: 2, has_scoreboard: true, has_odds: true, odds_count: 4, data_quality: "complete", freshness_label: "fresh", market_reliability: "available", event_pressure: "high" });
  assert.equal(bundle.features.score_diff_norm, 0.4);
  assert.equal(bundle.features.home_score_norm, 0.3);
  assert.equal(bundle.features.away_score_norm, 0.1);
  assert.deepEqual([bundle.features.odds_up_share, bundle.features.odds_down_share, bundle.features.odds_stable_share, bundle.features.odds_unknown_direction_share], [0.25, 0.25, 0.25, 0.25]);
  assert.equal(bundle.features.event_count_norm, 0.1);
  assert.equal(bundle.features.key_event_count_norm, 0.15);
  assert.equal(bundle.features.coverage_score, 1);
  assert.deepEqual(state, stateBefore); assert.deepEqual(context, contextBefore);
  assert.doesNotThrow(() => assertPredictionFeatureBundleValid(bundle));
  assert.equal("state" in bundle, false); assert.equal("context" in bundle, false);
});

test("normalizes phases and resolves generic live phase only with an explicit minute", () => {
  assert.equal(normalizePredictionPhase("1H", null, null), "first_half");
  assert.equal(normalizePredictionPhase("second-half", null, null), "second_half");
  assert.equal(normalizePredictionPhase("ht", null, null), "halftime");
  assert.equal(normalizePredictionPhase("extra-time", null, null), "extra_time");
  assert.equal(normalizePredictionPhase("finished", null, null), "finished");
  assert.equal(normalizePredictionPhase("scheduled", null, null), "pre_match");
  assert.equal(normalizePredictionPhase("live", null, 45), "first_half");
  assert.equal(normalizePredictionPhase("live", null, 46), "second_half");
  assert.equal(normalizePredictionPhase("live", null, null), "unknown");
});

test("handles minute, score, freshness, quality, and missing data conservatively", () => {
  const bundle = buildPredictionFeatureBundle({ state: makeState({ scoreboard: { ...makeState().scoreboard, home_score: -1, away_score: null, phase: "unknown" }, quality: { ...makeState().quality, status: "partial" } }), generated_at: generatedAt, minute: 999 });
  assert.equal(bundle.input_summary.minute, 120);
  assert.equal(bundle.features.minute_known, 1);
  assert.equal(bundle.features.score_known, 0);
  assert.equal(bundle.features.data_quality_score, 0.5);
  assert.equal(bundle.features.freshness_score, 5 / 6);
  assert.equal(bundle.features.freshness_known, 1);
  assert.ok(bundle.diagnostics.missing_inputs.includes("internal_context_missing"));
  const noMinute = buildPredictionFeatureBundle({ state: makeState(), generated_at: generatedAt });
  assert.equal(noMinute.input_summary.minute, null);
  assert.equal(noMinute.normalized_phase, "unknown");
  assert.equal(noMinute.features.minute_known, 0);
});

test("uses stale and future timestamps safely", () => {
  const stale = buildPredictionFeatureBundle({ state: makeState({ freshness: { ...makeState().freshness, latest_data_timestamp: "2026-07-10T00:00:00.000Z" } }), generated_at: generatedAt, stale_after_minutes: 60 });
  assert.equal(stale.features.freshness_score, 0); assert.equal(stale.input_summary.freshness_label, "stale");
  const future = buildPredictionFeatureBundle({ state: makeState({ freshness: { ...makeState().freshness, latest_data_timestamp: "2026-07-11T00:00:00.000Z" } }), generated_at: generatedAt });
  assert.equal(future.features.freshness_score, 1); assert.equal(future.features.data_age_norm, 0);
});

test("rejects invalid timestamps, fixture mismatches, and forbidden keys", () => {
  assert.throws(() => buildPredictionFeatureBundle({ state: makeState(), generated_at: "nope" }), TypeError);
  assert.throws(() => buildPredictionFeatureBundle({ state: makeState(), context: { ...makeContext(), fixture_id: "other" }, generated_at: generatedAt }), TypeError);
  for (const key of ["raw_payload", "model_weights", "recommended_bet"]) assert.throws(() => assertPredictionFeatureBundleValid({ feature_version: "prediction-features-v1", fixture_id: "x", generated_at: generatedAt, input_summary: { fixture_id: "x" }, features: {}, [key]: true }));
  assert.doesNotThrow(() => assertPredictionFeatureBundleValid({ feature_version: "prediction-features-v1", fixture_id: "x", generated_at: generatedAt, input_summary: { fixture_id: "x" }, features: { probability: 0.5, prediction: 0.5, confidence: 0.5 } }));
});
