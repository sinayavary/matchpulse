import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { LIVE_EVENT_TYPES, assertPublicLivePayload, buildDedupeKey, parseLiveCursor, publicPayloadHash, publishFixtureAgent, publishFixtureEvent, publishFixtureOdds, publishFixturePrediction, publishFixtureSnapshot, publishFixtureState, stableJson, toLiveEnvelope } from "./public-live-events.js";

test("public payload hashing is stable and dedupe includes source version", () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }));
  const hash = publicPayloadHash({ fixture_id: "f1", score: 1 });
  assert.equal(buildDedupeKey({ eventType: "fixture.state", fixtureId: "f1", sourceRecordId: "state", sourceVersion: "v1", payloadHash: hash }), buildDedupeKey({ eventType: "fixture.state", fixtureId: "f1", sourceRecordId: "state", sourceVersion: "v1", payloadHash: hash }));
  assert.notEqual(buildDedupeKey({ eventType: "fixture.state", fixtureId: "f1", sourceRecordId: "state", sourceVersion: "v2", payloadHash: hash }), buildDedupeKey({ eventType: "fixture.state", fixtureId: "f1", sourceRecordId: "state", sourceVersion: "v1", payloadHash: hash }));
});
test("cursor validation accepts only decimal non-negative strings", () => { assert.equal(parseLiveCursor("0"), 0n); assert.equal(parseLiveCursor("42"), 42n); assert.throws(() => parseLiveCursor("-1"), /invalid_live_cursor/); assert.throws(() => parseLiveCursor("1.0"), /invalid_live_cursor/); });
test("envelope serializes BigInt IDs and exposes only public DTO data", () => { const event = toLiveEnvelope({ id: 12n, eventType: "fixture.state", fixtureId: "f1", occurredAt: new Date("2026-07-19T12:00:00Z"), payload: { score: { home: 1, away: 0 } } }); assert.equal(event.id, "12"); assert.equal(event.schema_version, "matchpulse-live-v1"); assert.deepEqual(event.data, { score: { home: 1, away: 0 } }); assert.equal(LIVE_EVENT_TYPES.length, 7); });
test("public live payload validation rejects recursive private and raw fields", () => { assert.doesNotThrow(() => assertPublicLivePayload({ fixture_id: "f1", score: { home: 1, away: 0 } })); assert.throws(() => assertPublicLivePayload({ nested: { raw: { source: "provider" } } }), /invalid_public_live_payload/); assert.throws(() => assertPublicLivePayload({ authorization_token: "not-public" }), /invalid_public_live_payload/); });
test("publisher exposes all six public fixture event types", () => { const calls: string[] = []; const db = { publicLiveEvent: { findUnique: async () => null, upsert: async ({ data, create }: any) => { calls.push(create?.eventType ?? data?.eventType); return { id: 1n }; } } } as any; const input = { fixtureId: "f1", sourceRecordId: "source", sourceVersion: "v1", payload: { status: "live" } }; return Promise.all([publishFixtureSnapshot(db, input), publishFixtureState(db, input), publishFixtureEvent(db, input), publishFixtureOdds(db, input), publishFixtureAgent(db, input), publishFixturePrediction(db, input)]).then(() => assert.deepEqual(calls.sort(), ["fixture.agent", "fixture.event", "fixture.odds", "fixture.prediction", "fixture.snapshot", "fixture.state"])); });

test("BFF and Web helpers preserve streaming and bounded public inputs", async () => {
  const bff = await readFile(new URL("../../web/app/api/bff/public/[...segments]/route.ts", import.meta.url), "utf8");
  const web = await readFile(new URL("../../web/lib/public-api.ts", import.meta.url), "utf8");
  assert.match(bff, /new Response\(response\.body/);
  assert.match(bff, /"last-event-id"/);
  assert.match(bff, /\["cursor", "fixtureId", "types"\]/);
  assert.doesNotMatch(bff, /await response\.text\(\)[\s\S]*if \(live\)/);
  assert.match(web, /export function publicLiveUrl/);
  assert.match(web, /fixture\.prediction/);
});

test("worker role matrix is fail-closed", async () => {
  const example = await readFile(new URL("../../../.env.example", import.meta.url), "utf8");
  for (const name of ["MATCHPULSE_DATA_WORKER_ENABLED", "MATCHPULSE_AGENT_WORKER_ENABLED", "MATCHPULSE_EVALUATION_WORKER_ENABLED"]) assert.match(example, new RegExp(`${name}=false`));
  assert.match(example, /set exactly one of the three flags above/);
});

test("disposable PostgreSQL outbox is idempotent, ordered, and cleanup is bounded", { skip: !process.env.MATCHPULSE_LIVE_POSTGRES_URL }, async () => {
  const db = new PrismaClient({ datasourceUrl: process.env.MATCHPULSE_LIVE_POSTGRES_URL });
  const fixtureId = `live-test-${Date.now()}`;
  try {
    const input = { fixtureId, sourceRecordId: "state-1", sourceVersion: "v1", payload: { fixture_id: fixtureId, status: "live" } };
    const first = await publishFixtureState(db, input);
    const duplicate = await publishFixtureState(db, input);
    const second = await publishFixtureOdds(db, { ...input, sourceRecordId: "odds-1", payload: { fixture_id: fixtureId, markets: [] } });
    assert.equal(first.inserted, true);
    assert.equal(duplicate.inserted, false);
    assert.equal(duplicate.id, first.id);
    assert.ok(second.id > first.id);
    const rows = await db.publicLiveEvent.findMany({ where: { fixtureId }, orderBy: { id: "asc" } });
    assert.deepEqual(rows.map((row) => row.eventType), ["fixture.state", "fixture.odds"]);
    await db.publicLiveEvent.update({ where: { id: first.id }, data: { expiresAt: new Date(0) } });
    const { cleanupPublicLiveEvents } = await import("./public-live-events.js");
    assert.equal(await cleanupPublicLiveEvents(db, 1), 1);
    assert.equal(await db.publicLiveEvent.count({ where: { fixtureId } }), 1);
  } finally {
    await db.publicLiveEvent.deleteMany({ where: { fixtureId } });
    await db.$disconnect();
  }
});
