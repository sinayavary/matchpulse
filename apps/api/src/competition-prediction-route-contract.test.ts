import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompetitionPredictionSnapshot,
  type CompetitionPredictionInput,
} from "./competition-model-profile.js";
import {
  assertCompetitionPredictionInternalRoutePayloadSafe,
  assertCompetitionPredictionPublicRoutePayloadSafe,
  normalizeCompetitionPredictionRouteQuery,
  toCompetitionPredictionInternalRouteResponse,
  toCompetitionPredictionPublicRouteResponse,
} from "./competition-prediction-route-contract.js";
import type { CompetitionPredictionRuntimeResult } from "./competition-prediction-service.js";
import {
  buildPublicMarketIntelligence,
  PUBLIC_MARKET_SAFETY_NOTE,
} from "./odds-intelligence-contract.js";

function input(): CompetitionPredictionInput {
  return {
    fixture_id: "fixture-1",
    as_of: "2026-07-13T11:59:30.000Z",
    generated_at: "2026-07-13T12:00:00.000Z",
    sequence: null,
    trigger: "manual",
    feature_reference: {
      feature_version: "competition-runtime-input-v1",
      feature_hash: "hash",
      feature_count: 10,
    },
    phase: "H2",
    normalized_phase: "second_half",
    minute: 67,
    home_score: 1,
    away_score: 1,
    freshness_score: 1,
    market: {
      available: false,
      usable_for_model: false,
      assessment_id: "unavailable-assessment",
      reliability_score: 0,
      approved_model_weight_cap: 0,
      final_outcome: null,
      next_goal: null,
      direction: "unknown",
      limitations: ["Market evidence is unavailable."],
    },
    events: {
      available: false,
      home_pressure: 0,
      away_pressure: 0,
      home_impact: 0,
      away_impact: 0,
      limitations: ["Event evidence is unavailable."],
    },
  };
}

function result(): CompetitionPredictionRuntimeResult {
  return {
    fixture_id: "fixture-1",
    status: "degraded",
    source: "database",
    mode: "request_time",
    snapshot: buildCompetitionPredictionSnapshot(input()),
    market_analysis: buildPublicMarketIntelligence({
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: "fixture-1",
      generated_at: "2026-07-13T12:00:00.000Z",
      availability: "unavailable",
      reliability: "unavailable",
      freshness: "unknown",
      provider_coverage: "none",
      provider_agreement: "unknown",
      volatility: "none",
      market_count: 0,
      usable_market_count: 0,
      provider_count: 0,
      notable_movements: [],
      summary: "Market intelligence is unavailable because no usable odds data is present.",
      limitations: ["No market evidence is available."],
      last_update: null,
      safety_note: PUBLIC_MARKET_SAFETY_NOTE,
    }),
    limitations: [],
  };
}

test("route query contract accepts no parameters and rejects every unknown key", () => {
  assert.deepEqual(normalizeCompetitionPredictionRouteQuery({}), {});
  assert.throws(
    () => normalizeCompetitionPredictionRouteQuery({ unexpected: true }),
    /Unknown Competition Prediction route query parameter/,
  );
});

test("internal route response preserves validated snapshot but excludes raw payload fields", () => {
  const response = toCompetitionPredictionInternalRouteResponse(result());
  assert.equal(response.data?.identity.fixture_id, "fixture-1");
  assert.equal(response.market_analysis.fixture_id, "fixture-1");
  assert.equal(response.meta.mode, "internal");
  assertCompetitionPredictionInternalRoutePayloadSafe(response);
  assert.throws(
    () => assertCompetitionPredictionInternalRoutePayloadSafe({
      ...response,
      provider_payload: { secret: true },
    }),
    /Forbidden internal competition prediction field/,
  );
});

test("public route response removes internal references recursively", () => {
  const response = toCompetitionPredictionPublicRouteResponse(result());
  const text = JSON.stringify(response);
  assert.equal(text.includes("specialist_contributions"), false);
  assert.equal(text.includes("feature_reference"), false);
  assert.equal(text.includes("odds_intelligence_reference"), false);
  assertCompetitionPredictionPublicRoutePayloadSafe(response);
});

test("route contract rejects prediction and market analysis fixture mismatch", () => {
  const runtime = result();
  const internal = toCompetitionPredictionInternalRouteResponse(runtime);
  internal.market_analysis.fixture_id = "fixture-2";
  assert.throws(
    () => assertCompetitionPredictionInternalRoutePayloadSafe(internal),
    /fixture IDs must match/,
  );

  const publicResponse = toCompetitionPredictionPublicRouteResponse(runtime);
  publicResponse.market_analysis.fixture_id = "fixture-2";
  assert.throws(
    () => assertCompetitionPredictionPublicRoutePayloadSafe(publicResponse),
    /fixture IDs must match/,
  );
});
