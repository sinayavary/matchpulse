import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompetitionPredictionService,
  createDeterministicCompetitionReplayProvider,
  type CompetitionPredictionRuntimeInput,
} from "./competition-prediction-service.js";
import { buildEventImpactAssessment } from "./event-impact-foundation.js";
import {
  buildInternalOddsIntelligenceContext,
  type InternalOddsIntelligenceContext,
  type OddsComponentScores,
  type OddsMarketIntelligence,
} from "./odds-intelligence-contract.js";

const GENERATED_AT = "2026-07-13T12:00:00.000Z";

function components(score = 0.9): OddsComponentScores {
  return {
    structural_validity: score,
    freshness: score,
    market_completeness: score,
    provider_quality: score,
    provider_consensus: score,
    dispersion_quality: score,
    movement_integrity: score,
    event_consistency: score,
    historical_support: score,
    overall_reliability: score,
  };
}

function market(input: {
  key: string;
  type: OddsMarketIntelligence["market_type"];
  selections: OddsMarketIntelligence["selections"];
  latest_timestamp?: string;
}): OddsMarketIntelligence {
  return {
    market_key: input.key,
    market_type: input.type,
    line: null,
    complete: true,
    usable: true,
    selection_count: input.selections.length,
    provider_count: 2,
    snapshot_count: 6,
    overround: 0.04,
    provider_dispersion: 0.01,
    volatility_score: 0.2,
    selections: input.selections,
    component_scores: components(),
    reliability_level: "reliable",
    reliability_score: 0.9,
    recommended_model_weight: 0.12,
    issues: [],
    limitations: [],
    latest_timestamp: input.latest_timestamp ?? "2026-07-13T11:59:30.000Z",
  };
}

function oddsContext(
  options: {
    generatedAt?: string;
    resultLatestTimestamp?: string;
    nextGoalLatestTimestamp?: string;
  } = {},
): InternalOddsIntelligenceContext {
  const resultMarket = market({
    key: "match_result_1x2|period:full_time",
    type: "match_result_1x2",
    latest_timestamp: options.resultLatestTimestamp,
    selections: [
      {
        selection: "home",
        line: null,
        fair_probability: 0.46,
        consensus_probability: 0.46,
        probability_change_1m: 0.01,
        probability_change_5m: 0.03,
        movement_velocity: 0.01,
        movement_acceleration: 0,
      },
      {
        selection: "draw",
        line: null,
        fair_probability: 0.3,
        consensus_probability: 0.3,
        probability_change_1m: -0.005,
        probability_change_5m: -0.01,
        movement_velocity: -0.005,
        movement_acceleration: 0,
      },
      {
        selection: "away",
        line: null,
        fair_probability: 0.24,
        consensus_probability: 0.24,
        probability_change_1m: -0.005,
        probability_change_5m: -0.02,
        movement_velocity: -0.005,
        movement_acceleration: 0,
      },
    ],
  });
  const nextGoalMarket = market({
    key: "next_goal|period:full_time",
    type: "next_goal",
    latest_timestamp: options.nextGoalLatestTimestamp,
    selections: [
      {
        selection: "home",
        line: null,
        fair_probability: 0.4,
        consensus_probability: 0.4,
        probability_change_1m: 0.01,
        probability_change_5m: 0.02,
        movement_velocity: 0.01,
        movement_acceleration: 0,
      },
      {
        selection: "none",
        line: null,
        fair_probability: 0.25,
        consensus_probability: 0.25,
        probability_change_1m: 0,
        probability_change_5m: 0,
        movement_velocity: 0,
        movement_acceleration: 0,
      },
      {
        selection: "away",
        line: null,
        fair_probability: 0.35,
        consensus_probability: 0.35,
        probability_change_1m: -0.01,
        probability_change_5m: -0.02,
        movement_velocity: -0.01,
        movement_acceleration: 0,
      },
    ],
  });
  return buildInternalOddsIntelligenceContext({
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: "odds-assessment-v1:competition-runtime-test",
    fixture_id: "fixture-1",
    generated_at: options.generatedAt ?? GENERATED_AT,
    status: "reliable",
    usable_for_model: true,
    overall_reliability_score: 0.9,
    recommended_market_model_weight: 0.12,
    market_count: 2,
    usable_market_count: 2,
    provider_count: 2,
    snapshot_count: 12,
    consensus_score: 0.9,
    freshness_score: 0.9,
    volatility_score: 0.2,
    anomaly_score: 0,
    primary_match_result_market: resultMarket,
    markets: [resultMarket, nextGoalMarket],
    issues: [],
    limitations: [],
  });
}

function runtimeInput(
  options: { stale?: boolean; staleOdds?: boolean } = {},
): CompetitionPredictionRuntimeInput {
  const latest = options.stale
    ? "2026-07-13T10:00:00.000Z"
    : "2026-07-13T11:59:30.000Z";
  const eventContext = {
    fixture_id: "fixture-1",
    status: "available" as const,
    event_count: 2,
    latest_event_timestamp: latest,
    timeline_summary: {
      goals: 0,
      yellow_cards: 1,
      red_cards: 0,
      substitutions: 1,
      penalties: 0,
      var_events: 0,
      other_events: 0,
    },
    recent_events: [
      {
        external_seq: "event-2",
        event_type: "yellow_card",
        event_minute: 66,
        team_side: "away" as const,
        title: "Away card",
        description: null,
        source_timestamp: latest,
      },
      {
        external_seq: "event-1",
        event_type: "substitution",
        event_minute: 64,
        team_side: "home" as const,
        title: "Home substitution",
        description: null,
        source_timestamp: latest,
      },
    ],
    pressure_context: {
      level: "low" as const,
      label: "Low event activity",
      evidence_count: 2,
      cues: ["Recent match event activity found."],
      limitations: [],
      safe_scope_note: "Internal summary of stored match events only.",
    },
  };
  return {
    match_state: {
      fixture_id: "fixture-1",
      identity: {
        fixture_id: "fixture-1",
        competition: "Competition",
        home_team: "Home",
        away_team: "Away",
        start_time_utc: "2026-07-13T10:30:00.000Z",
        status: "LIVE",
      },
      scoreboard: {
        available: true,
        home_score: 1,
        away_score: 1,
        phase: "H2",
        last_data_received_at: latest,
      },
      odds: { available: false, count: 0, markets: [] },
      freshness: {
        built_at: GENERATED_AT,
        latest_score_timestamp: latest,
        latest_odds_timestamp: null,
        latest_data_timestamp: latest,
      },
      quality: {
        status: "complete",
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issues: ["odds_missing"],
      },
    },
    minute: 67,
    odds_intelligence: options.staleOdds
      ? oddsContext({
          generatedAt: "2026-07-13T10:00:00.000Z",
          resultLatestTimestamp: "2026-07-13T09:59:30.000Z",
          nextGoalLatestTimestamp: "2026-07-13T09:59:30.000Z",
        })
      : oddsContext(),
    event_context: eventContext,
    event_impact: buildEventImpactAssessment(eventContext),
    trigger: "manual",
  };
}

const fixedNow = () => new Date(GENERATED_AT);

test("stored runtime input produces complete prediction and mandatory market analysis", async () => {
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => runtimeInput(),
  });
  const result = await service("fixture-1");
  assert.equal(result.status, "live");
  assert.equal(result.source, "database");
  assert.equal(result.snapshot?.identity.fixture_id, "fixture-1");
  assert.equal(result.market_analysis.availability, "available");
  assert.ok(result.market_analysis.notable_movements.length > 0);
  assert.ok(result.snapshot?.model_output.final_score.outcomes.length);
});

test("missing database configuration returns bounded no_data without a fabricated snapshot", async () => {
  const service = createCompetitionPredictionService({ env: {}, now: fixedNow });
  const result = await service("fixture-1");
  assert.equal(result.status, "no_data");
  assert.equal(result.snapshot, null);
  assert.equal(result.market_analysis.availability, "unavailable");
  assert.ok(result.limitations.length > 0);
});

test("injected deterministic replay is used without database access", async () => {
  const replayProvider = createDeterministicCompetitionReplayProvider({
    "fixture-1": runtimeInput(),
  });
  const service = createCompetitionPredictionService({
    env: {},
    now: fixedNow,
    replayProvider,
  });
  const first = await service("fixture-1");
  const second = await service("fixture-1");
  assert.equal(first.status, "replay");
  assert.equal(first.mode, "replay");
  assert.deepEqual(first, second);
});

test("stored-data failures fall back to replay and never expose the thrown error", async () => {
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => {
      throw new Error("private database stack");
    },
    replayProvider: createDeterministicCompetitionReplayProvider({
      "fixture-1": runtimeInput(),
    }),
  });
  const result = await service("fixture-1");
  assert.equal(result.status, "replay");
  assert.equal(JSON.stringify(result).includes("private database stack"), false);
});

test("old supporting data is labeled stale", async () => {
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => runtimeInput({ stale: true }),
  });
  const result = await service("fixture-1");
  assert.equal(result.status, "stale");
  assert.equal(result.snapshot?.risk.reasons.includes("stale_data"), true);
});

test("persisted odds freshness is recalculated and stale market evidence is excluded", async () => {
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => runtimeInput({ staleOdds: true }),
  });
  const result = await service("fixture-1");
  assert.equal(result.status, "stale");
  assert.equal(result.snapshot?.data_coverage.has_odds, true);
  assert.equal(result.snapshot?.data_coverage.has_reliable_odds, false);
  assert.equal(result.snapshot?.odds_intelligence_reference.assigned_market_weight, 0);
  assert.equal(result.snapshot?.risk.reasons.includes("stale_data"), true);
  assert.equal(result.market_analysis.generated_at, GENERATED_AT);
  assert.equal(result.market_analysis.last_update, "2026-07-13T09:59:30.000Z");
  assert.equal(result.market_analysis.freshness, "stale");
  assert.equal(result.market_analysis.availability, "limited");
  assert.equal(result.market_analysis.reliability, "low");
  assert.equal(result.market_analysis.usable_market_count, 0);
  assert.equal(
    result.market_analysis.limitations.includes("Available market data is stale."),
    true,
  );
});

test("a fresh market cannot hide another usable market that is stale", async () => {
  const mixedFreshness = runtimeInput();
  mixedFreshness.odds_intelligence = oddsContext({
    generatedAt: "2026-07-13T11:50:00.000Z",
    resultLatestTimestamp: "2026-07-13T11:20:00.000Z",
    nextGoalLatestTimestamp: "2026-07-13T11:49:00.000Z",
  });
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => mixedFreshness,
  });
  const result = await service("fixture-1");
  assert.equal(result.status, "stale");
  assert.equal(result.snapshot?.data_coverage.has_reliable_odds, false);
  assert.equal(result.snapshot?.odds_intelligence_reference.assigned_market_weight, 0);
  assert.equal(result.market_analysis.freshness, "stale");
  assert.equal(result.market_analysis.last_update, "2026-07-13T11:49:00.000Z");
});

test("invalid fixture identity is rejected before any loader runs", async () => {
  let called = false;
  const service = createCompetitionPredictionService({
    env: { DATABASE_URL: "postgresql://offline-placeholder" },
    now: fixedNow,
    loadStoredInput: async () => {
      called = true;
      return runtimeInput();
    },
  });
  await assert.rejects(() => service("   "), /fixtureId is required/);
  assert.equal(called, false);
});
