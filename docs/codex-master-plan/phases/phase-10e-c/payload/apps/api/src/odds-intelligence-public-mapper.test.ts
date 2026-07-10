import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_MARKET_SAFETY_NOTE,
  type InternalOddsIntelligenceContext,
} from "./odds-intelligence-contract.js";
import { assessOddsIntelligence } from "./odds-intelligence-assessment.js";
import { mapInternalOddsIntelligenceToPublic } from "./odds-intelligence-public-mapper.js";
import type { NormalizedStoredOddsObservation } from "./odds-market-normalization.js";

const BASE = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (minute: number) => new Date(BASE + minute * 60_000).toISOString();
function rows(minute = 10): NormalizedStoredOddsObservation[] {
  const common = {
    fixture_id: "fixture-1", provider_key: "A", market_key: "match_result_1x2|period:0",
    market_type: "match_result_1x2" as const, line: null, previous_decimal_odds: null,
    change_percent: null, direction: "flat", source_timestamp: iso(minute), created_at: iso(minute),
  };
  return [
    { ...common, external_seq: "h", selection: "home", decimal_odds: 2 },
    { ...common, external_seq: "d", selection: "draw", decimal_odds: 4 },
    { ...common, external_seq: "a", selection: "away", decimal_odds: 4 },
  ];
}
function internal(observations = rows()): InternalOddsIntelligenceContext {
  return assessOddsIntelligence({
    fixture_id: "fixture-1",
    generated_at: iso(10),
    observations,
    event_consistency: [{ market_key: "match_result_1x2|period:0", score: 1, critical: false }],
  });
}

test("public mapper preserves fixture and generated timestamp", () => {
  const source = internal();
  const output = mapInternalOddsIntelligenceToPublic(source);
  assert.equal(output.fixture_id, source.fixture_id);
  assert.equal(output.generated_at, source.generated_at);
});

test("public mapper uses the exact safety note", () => {
  assert.equal(mapInternalOddsIntelligenceToPublic(internal()).safety_note, PUBLIC_MARKET_SAFETY_NOTE);
});

test("single provider maps to single coverage", () => {
  assert.equal(mapInternalOddsIntelligenceToPublic(internal()).provider_coverage, "single");
});

test("zero providers map to none coverage", () => {
  const output = mapInternalOddsIntelligenceToPublic(assessOddsIntelligence({ fixture_id: "fixture-1", generated_at: iso(10), observations: [] }));
  assert.equal(output.provider_coverage, "none");
});

test("unavailable context maps to unavailable public state", () => {
  const output = mapInternalOddsIntelligenceToPublic(assessOddsIntelligence({ fixture_id: "fixture-1", generated_at: iso(10), observations: [] }));
  assert.equal(output.availability, "unavailable");
  assert.equal(output.reliability, "unavailable");
  assert.equal(output.freshness, "unknown");
  assert.equal(output.volatility, "none");
});

test("invalid context maps to low reliability and unavailable", () => {
  const invalid = rows().map((row) => ({ ...row, fixture_id: "other" }));
  const output = mapInternalOddsIntelligenceToPublic(assessOddsIntelligence({ fixture_id: "fixture-1", generated_at: iso(10), observations: invalid }));
  assert.equal(output.availability, "unavailable");
  assert.equal(output.reliability, "low");
});

test("limited context maps to limited availability", () => {
  const output = mapInternalOddsIntelligenceToPublic(internal());
  assert.equal(output.availability, "limited");
  assert.equal(output.reliability, "limited");
});

test("freshness score maps to fresh", () => {
  assert.equal(mapInternalOddsIntelligenceToPublic(internal()).freshness, "fresh");
});

test("aging score maps to aging", () => {
  const context = assessOddsIntelligence({
    fixture_id: "fixture-1", generated_at: iso(14), observations: rows(10),
    event_consistency: [{ market_key: "match_result_1x2|period:0", score: 1, critical: false }],
  });
  assert.equal(mapInternalOddsIntelligenceToPublic(context).freshness, "aging");
});

test("hard stale score maps to stale", () => {
  const context = assessOddsIntelligence({
    fixture_id: "fixture-1", generated_at: iso(41), observations: rows(10),
    event_consistency: [{ market_key: "match_result_1x2|period:0", score: 1, critical: false }],
  });
  assert.equal(mapInternalOddsIntelligenceToPublic(context).freshness, "stale");
});

test("provider agreement mapping uses consensus score", () => {
  const context = internal();
  const output = mapInternalOddsIntelligenceToPublic(context);
  assert.ok(["mixed", "strong"].includes(output.provider_agreement));
});

test("no providers map to unknown agreement", () => {
  const context = assessOddsIntelligence({ fixture_id: "fixture-1", generated_at: iso(10), observations: [] });
  assert.equal(mapInternalOddsIntelligenceToPublic(context).provider_agreement, "unknown");
});

test("last update is the latest market timestamp", () => {
  assert.equal(mapInternalOddsIntelligenceToPublic(internal()).last_update, iso(10));
});

test("public mapper does not mutate internal context", () => {
  const source = internal();
  const before = structuredClone(source);
  mapInternalOddsIntelligenceToPublic(source);
  assert.deepEqual(source, before);
});

test("public output omits internal numerical probability fields", () => {
  const output = mapInternalOddsIntelligenceToPublic(internal());
  const serialized = JSON.stringify(output);
  for (const forbidden of ["fair_probability", "consensus_probability", "recommended_model_weight", "component_scores", "assessment_id"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("public output omits raw provider identity", () => {
  const serialized = JSON.stringify(mapInternalOddsIntelligenceToPublic(internal()));
  assert.equal(serialized.includes("Provider-A"), false);
  assert.equal(serialized.includes('"provider_key"'), false);
});

test("public limitations are sorted and deduplicated", () => {
  const source = internal();
  source.limitations = ["Z", "A", "Z"];
  const output = mapInternalOddsIntelligenceToPublic(source);
  assert.deepEqual(output.limitations, ["A", "Z"]);
});

test("movement list contains at most three entries", () => {
  assert.ok(mapInternalOddsIntelligenceToPublic(internal()).notable_movements.length <= 3);
});

test("movement labels are public-readable", () => {
  const movements = mapInternalOddsIntelligenceToPublic(internal()).notable_movements;
  for (const movement of movements) {
    assert.ok(movement.market_label.length > 0);
    assert.ok(movement.selection_label.length > 0);
    assert.ok(movement.summary.length > 0);
  }
});

test("stable data maps to stable or unknown movement", () => {
  const movements = mapInternalOddsIntelligenceToPublic(internal()).notable_movements;
  assert.ok(movements.every((movement) => ["stable", "unknown"].includes(movement.direction)));
});

test("public summary contains no wagering instruction", () => {
  const summary = mapInternalOddsIntelligenceToPublic(internal()).summary.toLowerCase();
  for (const word of ["stake", "payout", "profit", "recommended bet"]) {
    assert.equal(summary.includes(word), false);
  }
});

test("public output is deterministic", () => {
  const source = internal();
  assert.deepEqual(mapInternalOddsIntelligenceToPublic(source), mapInternalOddsIntelligenceToPublic(source));
});
