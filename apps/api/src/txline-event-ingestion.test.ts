import assert from "node:assert/strict";
import test from "node:test";
import {
  ingestTxlineMatchEvents,
  mapNormalizedEventToMatchEventUpsert,
  normalizeTxlineEvent,
  type MatchEventUpsert
} from "./txline-event-ingestion.js";

const fixtureId = "17952170";
const sample = { EventType: "Goal", Minute: 23, TeamSide: "Home", Title: "Goal", Ts: 1781226000000, Seq: 7 };

test("normalizes valid PascalCase TxLINE events safely", () => {
  const result = normalizeTxlineEvent(fixtureId, sample);
  assert.equal(result.skipReason, null);
  assert.deepEqual(result.event && {
    fixtureId: result.event.fixtureId, externalSeq: result.event.externalSeq,
    eventType: result.event.eventType, eventMinute: result.event.eventMinute,
    teamSide: result.event.teamSide, title: result.event.title
  }, { fixtureId, externalSeq: "7", eventType: "goal", eventMinute: 23, teamSide: "home", title: "Goal" });
});

test("skips malformed events and preserves missing optional fields", () => {
  assert.deepEqual(normalizeTxlineEvent(fixtureId, null), { event: null, skipReason: "not_an_object" });
  const event = normalizeTxlineEvent(fixtureId, { type: "yellow card" }).event;
  assert.equal(event?.eventMinute, null);
  assert.equal(event?.sourceTimestamp, null);
  assert.equal(event?.teamSide, "unknown");
  assert.equal(event?.eventType, "yellow_card");
});

test("creates a deterministic fallback sequence when provider sequence is missing", () => {
  const event = normalizeTxlineEvent(fixtureId, { type: "VAR", minute: 50, side: "away" }).event!;
  const first = mapNormalizedEventToMatchEventUpsert(event, 3);
  const second = mapNormalizedEventToMatchEventUpsert(event, 3);
  assert.equal(first.create.externalSeq, "fallback:var:50:away:no-ts:3");
  assert.equal(first.create.externalSeq, second.create.externalSeq);
});

test("ingests with fixture and sequence upserts, deduping repeated input", async () => {
  const writes: MatchEventUpsert[] = [];
  const seen = new Set<string>();
  const result = await ingestTxlineMatchEvents({
    fixtureId,
    rawEvents: [sample, sample, null, { Type: "Substitution" }],
    db: { matchEvent: { upsert: async (write) => { writes.push(write); seen.add(write.create.externalSeq!); } } }
  });
  assert.equal(seen.size, 2);
  assert.equal(writes[0]?.where.fixtureId_externalSeq.fixtureId, fixtureId);
  assert.deepEqual(result, {
    fixture_id: fixtureId, fetched_count: 4, mapped_count: 3, upserted_count: 3,
    skipped_count: 1, failed_count: 0, latest_event_timestamp: "2026-06-12T01:00:00.000Z"
  });
});

test("records write failures without stopping later events", async () => {
  let calls = 0;
  const result = await ingestTxlineMatchEvents({
    fixtureId, rawEvents: [sample, { ...sample, Seq: 8 }],
    db: { matchEvent: { upsert: async () => { calls += 1; if (calls === 1) throw new Error("write failed"); } } }
  });
  assert.equal(result.failed_count, 1);
  assert.equal(result.upserted_count, 1);
});
