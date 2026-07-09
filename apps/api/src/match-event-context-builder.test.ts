import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMatchEventContextFromRows,
  getDbBackedMatchEventContext,
  type MatchEventContext
} from "./match-event-context-builder.js";

const fixtureId = "17952170";

type RowInput = {
  externalSeq?: string;
  eventType?: string;
  eventMinute?: number | null;
  teamSide?: string;
  title?: string;
  description?: string | null;
  sourceTimestamp?: Date | null;
  createdAt?: Date;
};

function row(overrides: RowInput = {}) {
  return {
    externalSeq: "1",
    eventType: "goal",
    eventMinute: 12,
    teamSide: "home",
    title: "Goal",
    description: "Scored from open play",
    sourceTimestamp: new Date("2026-06-12T01:00:00.000Z"),
    createdAt: new Date("2026-06-12T01:00:00.000Z"),
    ...overrides
  };
}

function collectForbiddenKeys(context: MatchEventContext): string[] {
  const serialized = JSON.stringify(context).toLowerCase();
  return [
    "raw",
    "raw_payload",
    "pressure_score",
    "prediction",
    "probability",
    "confidence",
    "winner",
    "expected_value",
    "edge",
    "recommended_bet",
    "wager",
    "stake",
    "profit",
    "payout",
    "wallet",
    "deposit"
  ].filter((key) => serialized.includes(key));
}

test("empty event list returns empty status and none pressure", () => {
  const context = buildMatchEventContextFromRows(fixtureId, []);
  assert.equal(context.status, "empty");
  assert.equal(context.pressure_context.level, "none");
  assert.equal(context.event_count, 0);
  assert.deepEqual(context.recent_events, []);
});

test("counts timeline summary correctly", () => {
  const context = buildMatchEventContextFromRows(fixtureId, [
    row({ eventType: "goal", externalSeq: "g1" }),
    row({ eventType: "yellow_card", externalSeq: "y1" }),
    row({ eventType: "red_card", externalSeq: "r1" }),
    row({ eventType: "substitution", externalSeq: "s1" }),
    row({ eventType: "penalty", externalSeq: "p1" }),
    row({ eventType: "var", externalSeq: "v1" }),
    row({ eventType: "throw_in", externalSeq: "o1" })
  ]);

  assert.equal(context.event_count, 7);
  assert.deepEqual(context.timeline_summary, {
    goals: 1,
    yellow_cards: 1,
    red_cards: 1,
    substitutions: 1,
    penalties: 1,
    var_events: 1,
    other_events: 1
  });
});

test("recent events are capped by recentLimit", () => {
  const rows = Array.from({ length: 5 }, (_, index) =>
    row({
      externalSeq: String(index + 1),
      eventType: index === 0 ? "goal" : "substitution",
      sourceTimestamp: new Date(`2026-06-12T00:${String(59 - index).padStart(2, "0")}:00.000Z`),
      createdAt: new Date(`2026-06-12T00:${String(59 - index).padStart(2, "0")}:30.000Z`)
    })
  );
  const context = buildMatchEventContextFromRows(fixtureId, rows, { recentLimit: 2 });

  assert.equal(context.recent_events.length, 2);
  assert.deepEqual(context.recent_events.map((event) => event.external_seq), ["1", "2"]);
});

test("recentLimit caps at 25", () => {
  const rows = Array.from({ length: 30 }, (_, index) =>
    row({
      externalSeq: String(index + 1),
      eventType: "substitution",
      sourceTimestamp: new Date(`2026-06-12T00:${String(59 - index).padStart(2, "0")}:00.000Z`),
      createdAt: new Date(`2026-06-12T00:${String(59 - index).padStart(2, "0")}:30.000Z`)
    })
  );
  const context = buildMatchEventContextFromRows(fixtureId, rows, { recentLimit: 250 });

  assert.equal(context.recent_events.length, 25);
});

test("red card produces high pressure context", () => {
  const context = buildMatchEventContextFromRows(fixtureId, [
    row({ eventType: "red_card", externalSeq: "r1" }),
    row({ eventType: "yellow_card", externalSeq: "y1", sourceTimestamp: new Date("2026-06-12T00:59:00.000Z"), createdAt: new Date("2026-06-12T00:59:30.000Z") })
  ]);

  assert.equal(context.pressure_context.level, "high");
  assert.ok(context.pressure_context.cues.some((cue) => cue.includes("Red card")));
});

test("recent goal penalty and card cluster produces medium or high pressure", () => {
  const context = buildMatchEventContextFromRows(fixtureId, [
    row({ eventType: "goal", externalSeq: "g1" }),
    row({ eventType: "penalty", externalSeq: "p1", sourceTimestamp: new Date("2026-06-12T00:59:30.000Z"), createdAt: new Date("2026-06-12T00:59:35.000Z") }),
    row({ eventType: "yellow_card", externalSeq: "y1", sourceTimestamp: new Date("2026-06-12T00:59:45.000Z"), createdAt: new Date("2026-06-12T00:59:50.000Z") })
  ]);

  assert.ok(["medium", "high"].includes(context.pressure_context.level));
  assert.ok(context.pressure_context.cues.length > 0);
});

test("no raw payload is selected or returned", async () => {
  const captured: unknown[] = [];
  const fakeDb = {
    matchEvent: {
      findMany: async (args: unknown) => {
        captured.push(args);
        return [
          row({
            externalSeq: "1",
            eventType: "goal",
            sourceTimestamp: new Date("2026-06-12T01:00:00.000Z"),
            createdAt: new Date("2026-06-12T01:00:30.000Z")
          })
        ];
      }
    }
  };

  const previous = (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma;
  (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma = fakeDb;
  try {
    const context = await getDbBackedMatchEventContext(fixtureId, { recentLimit: 3 });
    assert.equal(context.status, "available");
    assert.equal(captured.length, 1);
    const [query] = captured as Array<{
      select: Record<string, unknown>;
      where: { fixtureId: string };
      orderBy: unknown;
      take: number;
    }>;
    assert.equal(query.where.fixtureId, fixtureId);
    assert.equal("raw" in query.select, false);
    assert.equal((query.select as Record<string, unknown>).raw, undefined);
    assert.deepEqual(collectForbiddenKeys(context), []);
  } finally {
    (globalThis as { matchpulsePrisma?: unknown }).matchpulsePrisma = previous;
  }
});

test("output contains no forbidden keys", () => {
  const context = buildMatchEventContextFromRows(fixtureId, [
    row({ eventType: "goal", externalSeq: "g1" }),
    row({ eventType: "yellow_card", externalSeq: "y1" })
  ]);

  assert.deepEqual(collectForbiddenKeys(context), []);
});
