import assert from "node:assert/strict";
import test from "node:test";
import { buildEventImpactAssessment } from "./event-impact-foundation.js";
import { buildInternalIntelligenceContext } from "./internal-intelligence-context.js";
import { buildMatchEventContextFromRows } from "./match-event-context-builder.js";
import { buildCanonicalMatchState } from "./match-state-builder.js";
import { assessStoredOddsReliability } from "./odds-reliability-foundation.js";

const fixtureId = "17952170";
const referenceTime = new Date("2026-07-09T12:00:00.000Z");

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    externalSeq: "1", eventType: "goal", eventMinute: 12, teamSide: "home", title: "Goal",
    description: null, sourceTimestamp: new Date("2026-07-09T11:30:00.000Z"),
    createdAt: new Date("2026-07-09T11:30:00.000Z"), ...overrides
  };
}

function context(options: { empty?: boolean; partial?: boolean; events?: ReturnType<typeof eventRow>[] } = {}) {
  const rows = options.events ?? [];
  const matchState = buildCanonicalMatchState({
    fixtureId,
    fixture: options.empty ? null : {
      fixtureId, competition: "International", homeTeam: "Home", awayTeam: "Away",
      startTimeUtc: referenceTime, status: "live"
    },
    scoreboard: options.empty || options.partial ? null : {
      homeScore: 1, awayScore: 0, phase: "live", lastDataReceivedAt: referenceTime
    },
    odds: options.empty || options.partial ? [] : [{
      marketId: "match_result", marketName: "Match Result", selectionName: "Home",
      odds: 2, direction: "flat", sourceTimestamp: referenceTime
    }],
    builtAt: referenceTime
  });
  const eventContext = buildMatchEventContextFromRows(fixtureId, rows);
  return buildInternalIntelligenceContext({
    fixtureId,
    matchState,
    oddsReliability: assessStoredOddsReliability({
      fixture_id: fixtureId,
      odds_rows: options.empty || options.partial ? [] : Array.from({ length: 10 }, (_, index) => ({
        market_id: `market-${(index % 5) + 1}`, source_timestamp: referenceTime, provider_id: "stored"
      })),
      reference_time: referenceTime
    }),
    eventContext,
    eventImpact: buildEventImpactAssessment(eventContext),
    now: () => referenceTime
  });
}

test("builds an empty context safely", () => {
  const result = context({ empty: true });
  assert.equal(result.status, "empty");
  assert.equal(result.data_readiness.quality_status, "empty");
});

test("builds a partial context when only match state is partial", () => {
  const result = context({ partial: true });
  assert.equal(result.status, "partial");
  assert.equal(result.data_readiness.has_fixture, true);
  assert.equal(result.data_readiness.has_scoreboard, false);
});

test("builds an available context when complete match state and stored inputs exist", () => {
  const result = context({ events: [eventRow()] });
  assert.equal(result.status, "available");
  assert.equal(result.data_readiness.quality_status, "complete");
});

test("maps odds reliability counts and event pressure and impact summaries", () => {
  const result = context({ events: [eventRow({ eventType: "red_card" }), eventRow({ externalSeq: "2", eventType: "yellow_card" })] });
  assert.deepEqual(result.odds_reliability, {
    status: "available", snapshot_count: 10, market_count: 5, provider_count: 1,
    latest_timestamp: "2026-07-09T12:00:00.000Z",
    limitations: ["Limited source diversity; this does not represent broad bookmaker consensus."]
  });
  assert.equal(result.event_context.pressure_level, "high");
  assert.deepEqual(result.event_context.timeline_summary, {
    goals: 0, yellow_cards: 1, red_cards: 1, substitutions: 0, penalties: 0, var_events: 0, other_events: 0
  });
  assert.deepEqual(result.event_impact.impact_summary, {
    goals: 0, cards: 2, red_cards: 1, penalties: 0, var_events: 0, substitutions: 0, pressure_level: "high"
  });
});

test("injected now makes generated_at deterministic and pure composition needs no database", () => {
  assert.equal(context().generated_at, "2026-07-09T12:00:00.000Z");
});

test("output contains no forbidden keys", () => {
  const forbidden = new Set(["raw", "raw_payload", "debug", "debug_lineage", "formula", "signals", "state", "insight", "probability", "prediction", "confidence", "winner", "recommended_bet", "expected_value", "ev", "edge", "wager", "stake", "profit", "payout", "wallet", "deposit"]);
  const keys: string[] = [];
  const visit = (value: unknown) => {
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key.toLowerCase());
      visit(nested);
    }
  };
  visit(context({ events: [eventRow()] }));
  assert.deepEqual(keys.filter((key) => forbidden.has(key)), []);
});
