import test from "node:test";
import assert from "node:assert/strict";
import { buildOddsReaderQuery, readOddsSnapshots } from "./odds-persistence-reader.js";
import { createTimelineState, reduceTimeline } from "./timeline-reducer.js";
import { persistTimelineState } from "./timeline-persistence.js";

test("odds reader uses bounded stable ordering and converts Decimal-like values", async () => {
  let query: unknown; const db = { oddsSnapshot: { findMany: async (args: unknown) => { query = args; return [{ id: "1", fixtureId: "f", marketId: "m", marketName: null, selectionName: "home", odds: { toNumber: () => 2.5 }, previousOdds: null, changePercent: null, direction: "flat", sourceTimestamp: null, createdAt: new Date("2026-01-01T00:00:00Z") }]; } } };
  const rows = await readOddsSnapshots(db, { fixtureId: "f", limit: 999 }); assert.equal(rows[0]?.odds, 2.5); assert.equal((query as { take: number }).take, 500); assert.deepEqual(buildOddsReaderQuery("f").orderBy, [{ sourceTimestamp: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
});

test("timeline reducer is monotonic, deduplicates, and reports gaps", () => {
  const e = (id: string, sequence: number) => ({ event_id: id, stream_kind: "scores" as const, fixture_id: "f", sequence, provider_timestamp: "2026-01-01T00:00:00Z", payload: {} });
  let state = reduceTimeline(createTimelineState(), e("a", 1)); state = reduceTimeline(state, e("a", 1)); state = reduceTimeline(state, e("c", 3)); state = reduceTimeline(state, e("b", 2));
  assert.equal(state.events.length, 2); assert.equal(state.duplicate_count, 2); assert.equal(state.gap_count, 1); assert.equal(state.checkpoint?.sequence, 3);
});

test("timeline persistence writes events and checkpoint in one transaction", async () => {
  const calls: unknown[] = []; let db: any; db = { $transaction: async (operation: (tx: any) => Promise<void>) => operation(db), canonicalTimelineEvent: { upsert: async (args: unknown) => { calls.push(args); } }, txlineStreamCheckpoint: { upsert: async (args: unknown) => { calls.push(args); } } };
  const state = reduceTimeline(createTimelineState(), { event_id: "a", stream_kind: "scores", fixture_id: "f", sequence: 1, provider_timestamp: "2026-01-01T00:00:00Z", payload: { score: 1 } });
  await persistTimelineState(db, state); assert.equal(calls.length, 2); assert.equal((calls[0] as { where: { streamKind_fixtureId_eventId: unknown } }).where.streamKind_fixtureId_eventId !== undefined, true);
});
