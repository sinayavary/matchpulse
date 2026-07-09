import assert from "node:assert/strict";
import test from "node:test";
import { buildEventImpactAssessment, getDbBackedEventImpactAssessment, type EventImpactAssessment } from "./event-impact-foundation.js";
import { buildMatchEventContextFromRows } from "./match-event-context-builder.js";

const fixtureId = "17952170";

function row(overrides: Record<string, unknown> = {}) {
  return {
    externalSeq: "1", eventType: "goal", eventMinute: 12, teamSide: "home", title: "Goal",
    description: null, sourceTimestamp: new Date("2026-06-12T01:00:00.000Z"),
    createdAt: new Date("2026-06-12T01:00:00.000Z"), ...overrides
  };
}

function assessment(rows: ReturnType<typeof row>[], options: { keyEventLimit?: number } = {}) {
  return buildEventImpactAssessment(buildMatchEventContextFromRows(fixtureId, rows), options);
}

function forbiddenKeys(value: EventImpactAssessment): string[] {
  const forbidden = new Set(["raw", "raw_payload", "debug", "formula", "probability", "prediction", "confidence", "winner", "recommended_bet", "expected_value", "edge", "wager", "stake", "profit", "payout", "wallet", "deposit"]);
  const found: string[] = [];
  const visit = (candidate: unknown) => {
    if (candidate === null || typeof candidate !== "object") return;
    for (const [key, nested] of Object.entries(candidate)) {
      if (forbidden.has(key.toLowerCase())) found.push(key);
      visit(nested);
    }
  };
  visit(value);
  return found;
}

test("empty context has no impact or key events", () => {
  const result = assessment([]);
  assert.equal(result.impact_level, "none");
  assert.deepEqual(result.key_impact_events, []);
});

for (const [eventType, name] of [["goal", "goal"], ["red_card", "red card"], ["penalty", "penalty"]] as const) {
  test(`${name} produces high impact`, () => {
    const result = assessment([row({ eventType })]);
    assert.equal(result.impact_level, "high");
    assert.equal(result.key_impact_events[0].impact_weight, "high");
  });
}

test("VAR and multiple cards produce medium impact without high-impact events", () => {
  assert.equal(assessment([row({ eventType: "var" })]).impact_level, "medium");
  assert.equal(assessment([row({ eventType: "yellow_card" }), row({ eventType: "yellow_card", externalSeq: "2" })]).impact_level, "medium");
});

test("substitution-only context produces low impact", () => {
  assert.equal(assessment([row({ eventType: "substitution" })]).impact_level, "low");
});

test("key event limit defaults to five and caps at ten", () => {
  const rows = Array.from({ length: 12 }, (_, index) => row({ eventType: "substitution", externalSeq: String(index + 1) }));
  assert.equal(assessment(rows).key_impact_events.length, 5);
  assert.equal(assessment(rows, { keyEventLimit: 50 }).key_impact_events.length, 10);
});

test("pressure level is a bounded fallback", () => {
  const context = buildMatchEventContextFromRows(fixtureId, [row({ eventType: "throw_in" })]);
  context.pressure_context.level = "high";
  assert.equal(buildEventImpactAssessment(context).impact_level, "high");
});

test("output contains no forbidden keys and pure builder needs no database", () => {
  assert.deepEqual(forbiddenKeys(assessment([row({ eventType: "goal" })])), []);
});

test("DB-backed composition uses the existing context query", async () => {
  const previous = (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma;
  (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma = {
    matchEvent: { findMany: async () => [row({ eventType: "var" })] }
  };
  try {
    const result = await getDbBackedEventImpactAssessment(fixtureId);
    assert.equal(result.impact_level, "medium");
  } finally {
    (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma = previous;
  }
});
