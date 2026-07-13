import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CompetitionPredictionPanel from "./CompetitionPredictionPanel.js";
import type { CompetitionPredictionResponse } from "../../lib/competition-api.js";

function sampleResponse(): CompetitionPredictionResponse {
  return {
    data: {
      prediction_version: "competition-public-prediction-v1",
      fixture_id: "competition-replay-demo",
      as_of: "2026-07-13T12:49:00.000Z",
      generated_at: "2026-07-13T12:49:00.000Z",
      model_profile: "competition_baseline_v1",
      match_state: {
        phase: "H2",
        normalized_phase: "second_half",
        minute: 67,
        home_score: 1,
        away_score: 1,
      },
      final_outcome: { home: 0.3, draw: 0.34, away: 0.36 },
      next_goal: { home: 0.29, none: 0.24, away: 0.47 },
      goal_horizon: { next_5m: 0.1, next_10m: 0.2, next_15m: 0.3 },
      final_score: {
        outcomes: [{ home_score: 1, away_score: 2, probability: 0.31 }],
        other_probability: 0.69,
      },
      current_result_survival: { current_result_holds: 0.44, current_result_changes: 0.56 },
      momentum_shift: { home_strengthens: 0.18, neutral: 0.34, away_strengthens: 0.48 },
      confidence: { level: "medium", score: 0.61, reasons: ["Current score data is available."] },
      risk: { level: "medium", reasons: ["Some supporting match data is aging."] },
      explanation: {
        summary: "MatchPulse combines the current state with bounded event and market support.",
        main_factors: ["The recorded score is 1-1 at minute 67."],
        limitations: ["The competition baseline is not production calibrated."],
      },
      data_quality: {
        level: "partial",
        coverage_score: 0.76,
        freshness: "aging",
        has_scoreboard: true,
        has_minute: true,
        has_odds: true,
        has_reliable_odds: true,
        has_events: true,
      },
      safety_note: "Informational sports analytics only.",
    },
    market_analysis: {
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: "competition-replay-demo",
      generated_at: "2026-07-13T12:49:00.000Z",
      availability: "limited",
      reliability: "limited",
      freshness: "aging",
      provider_coverage: "limited",
      provider_agreement: "mixed",
      volatility: "high",
      market_count: 7,
      usable_market_count: 5,
      provider_count: 3,
      notable_movements: [{
        market_label: "Next goal",
        selection_label: "Away",
        direction: "up",
        strength: "high",
        summary: "Away next-goal support increased during the latest replay window.",
      }],
      summary: "Market evidence remains usable but is aging, mixed, and volatile.",
      limitations: ["Recent provider agreement is mixed."],
      last_update: "2026-07-13T12:46:00.000Z",
      safety_note: "Informational market intelligence only.",
    },
    meta: {
      status: "replay",
      source: "competition-prediction",
      mode: "replay",
    },
  };
}

test("competition panel renders every required prediction family", () => {
  const html = renderToStaticMarkup(
    <CompetitionPredictionPanel
      response={sampleResponse()}
      mode_label="deterministic replay"
      checkpoint_label="Pressure shift"
    />,
  );
  for (const text of [
    "MatchPulse prediction",
    "Final outcome probabilities",
    "Next goal probabilities",
    "Goal horizon",
    "Final-score scenarios",
    "Current-result survival",
    "Momentum shift",
    "Confidence",
    "Risk",
    "Data quality",
    "Explanation",
    "Limitations and risk notes",
  ]) {
    assert.equal(html.includes(text), true, text);
  }
});

test("competition panel renders a distinct complete market analysis section", () => {
  const html = renderToStaticMarkup(
    <CompetitionPredictionPanel response={sampleResponse()} mode_label="deterministic replay" />,
  );
  const predictionIndex = html.indexOf("MatchPulse prediction");
  const marketIndex = html.indexOf("Market / odds analysis");
  assert.ok(predictionIndex >= 0);
  assert.ok(marketIndex > predictionIndex);
  for (const text of [
    "Availability",
    "Reliability",
    "Freshness",
    "Coverage",
    "Agreement",
    "Volatility",
    "Markets observed",
    "Usable markets",
    "Provider count",
    "Notable movements",
    "Market summary",
    "Market limitations",
    "Last market update",
  ]) {
    assert.equal(html.includes(text), true, text);
  }
});

test("competition panel keeps replay fallback and unavailable states explicit", () => {
  const response = sampleResponse();
  response.data = null;
  response.meta.status = "no_data";
  response.meta.message = "No bounded competition prediction is available.";
  response.market_analysis.availability = "unavailable";
  const html = renderToStaticMarkup(
    <CompetitionPredictionPanel
      response={response}
      mode_label="deterministic replay"
      fallback_reason="Stored live data was unavailable, so the approved replay checkpoint is shown."
    />,
  );
  assert.equal(html.includes("Replay fallback active."), true);
  assert.equal(html.includes("Prediction unavailable"), true);
  assert.equal(html.includes("Market / odds analysis"), true);
  assert.equal(html.includes("unavailable"), true);
});

test("competition panel never renders protected structured fields or prescriptive product language", () => {
  const html = renderToStaticMarkup(
    <CompetitionPredictionPanel response={sampleResponse()} mode_label="deterministic replay" />,
  );
  for (const forbidden of [
    "specialist_contributions",
    "feature_reference",
    "odds_intelligence_reference",
    "assessment_id",
    "fair_probability",
    "consensus_probability",
    "recommended_bet",
    "stake",
    "payout",
    "profit",
    "wallet",
  ]) {
    assert.equal(html.toLowerCase().includes(forbidden), false, forbidden);
  }
});
