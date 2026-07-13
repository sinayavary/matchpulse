import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompetitionPredictionPath,
  buildCompetitionReplayPath,
  fetchCompetitionPrediction,
  fetchCompetitionReplayCheckpoint,
  shouldUseReplayFallback,
  type CompetitionPredictionResponse,
} from "./competition-api.js";

function responseBody(data: CompetitionPredictionResponse["data"]): CompetitionPredictionResponse {
  return {
    data,
    market_analysis: {
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
      summary: "Market intelligence is unavailable.",
      limitations: ["No market evidence is available."],
      last_update: null,
      safety_note: "Informational market intelligence only.",
    },
    meta: {
      status: data === null ? "no_data" : "live",
      source: "competition-prediction",
      mode: "public",
    },
  };
}

test("competition client builds encoded versioned paths", () => {
  assert.equal(
    buildCompetitionPredictionPath(" fixture/one "),
    "/api/public/v1/matches/fixture%2Fone/prediction",
  );
  assert.equal(buildCompetitionReplayPath(), "/api/public/v1/competition/replay");
  assert.equal(
    buildCompetitionReplayPath("pressure shift"),
    "/api/public/v1/competition/replay/pressure%20shift",
  );
});

test("competition client requests live and replay responses without caching", async () => {
  const calls: Array<{ url: string; cache: RequestCache | undefined }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), cache: init?.cache });
    return new Response(JSON.stringify(responseBody(null)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const live = await fetchCompetitionPrediction("fixture-1", fetchImpl);
  const replay = await fetchCompetitionReplayCheckpoint("opening-balance", fetchImpl);
  assert.equal(live.ok, true);
  assert.equal(replay.ok, true);
  assert.equal(calls[0]?.url.endsWith("/api/public/v1/matches/fixture-1/prediction"), true);
  assert.equal(calls[1]?.url.endsWith("/api/public/v1/competition/replay/opening-balance"), true);
  assert.deepEqual(calls.map((call) => call.cache), ["no-store", "no-store"]);
});

test("competition client marks no-data live response for deterministic replay fallback", async () => {
  const result = await fetchCompetitionPrediction(
    "fixture-1",
    async () => new Response(JSON.stringify(responseBody(null)), { status: 200 }),
  );
  assert.equal(shouldUseReplayFallback(result), true);
});

test("competition client returns a bounded failure without exposing fetch errors", async () => {
  const result = await fetchCompetitionReplayCheckpoint("opening-balance", async () => {
    throw new Error("private upstream endpoint and token");
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.equal(result.value, null);
  assert.equal(result.error_message, "Competition data is currently unavailable.");
  assert.equal(JSON.stringify(result).includes("private upstream"), false);
});
