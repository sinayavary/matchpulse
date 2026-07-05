import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTxlineFixture } from "./txline-normalizer.js";
import {
  ingestTxlineFixtures,
  mapNormalizedFixtureToFixtureUpsert,
  summarizeFixtureIngestion,
  type FixtureUpsert
} from "./txline-fixture-ingestion.js";

function rawFixture(overrides: Record<string, unknown> = {}) {
  return {
    FixtureId: 17952170,
    Competition: "Friendlies",
    Participant1: "Slovenia",
    Participant2: "Cyprus",
    Participant1IsHome: true,
    StartTime: 1_780_000_000_000,
    ...overrides
  };
}

test("maps a normalized fixture to a Prisma upsert with a string fixture id", () => {
  const raw = rawFixture();
  const normalized = normalizeTxlineFixture(raw);
  assert.notEqual(normalized, null);

  const upsert = mapNormalizedFixtureToFixtureUpsert(normalized!, raw);

  assert.notEqual(upsert, null);
  assert.equal(upsert!.where.fixtureId, "17952170");
  assert.equal(upsert!.create.fixtureId, "17952170");
  assert.equal(upsert!.create.sport, "soccer");
  assert.ok(upsert!.create.startTimeUtc instanceof Date);
});

test("stores a missing start time as null", () => {
  const raw = rawFixture({ StartTime: undefined });
  const normalized = normalizeTxlineFixture(raw);
  assert.notEqual(normalized, null);

  const upsert = mapNormalizedFixtureToFixtureUpsert(normalized!, raw);

  assert.equal(upsert!.create.startTimeUtc, null);
});

test("preserves unknown stage and status without inventing values", () => {
  const raw = rawFixture();
  const normalized = normalizeTxlineFixture(raw);
  assert.notEqual(normalized, null);

  const upsert = mapNormalizedFixtureToFixtureUpsert(normalized!, raw);

  assert.equal(upsert!.create.stage, null);
  assert.equal(upsert!.create.status, "UNKNOWN");
});

test("rejects normalized fixtures whose home and away orientation is not reliable", () => {
  const raw = rawFixture({ Participant1IsHome: undefined });
  const normalized = normalizeTxlineFixture(raw);
  assert.notEqual(normalized, null);

  assert.equal(mapNormalizedFixtureToFixtureUpsert(normalized!, raw), null);
});

test("does not include raw payload when includeRaw is false", () => {
  const raw = rawFixture();
  const normalized = normalizeTxlineFixture(raw);
  const upsert = mapNormalizedFixtureToFixtureUpsert(normalized!, raw, false);

  assert.equal(Object.prototype.hasOwnProperty.call(upsert!.create, "raw"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(upsert!.update, "raw"), false);
});

test("includes a JSON-safe raw payload only when requested", () => {
  const raw = rawFixture();
  const normalized = normalizeTxlineFixture(raw);
  const upsert = mapNormalizedFixtureToFixtureUpsert(normalized!, raw, true);

  assert.deepEqual(upsert!.create.raw, raw);
  assert.deepEqual(upsert!.update.raw, raw);
});

test("skips invalid fixtures and reports complete ingestion counts", async () => {
  const successful = rawFixture();
  const invalidId = rawFixture({ FixtureId: null });
  const unreliableTeams = rawFixture({ FixtureId: 2, Participant1IsHome: undefined });
  const failing = rawFixture({ FixtureId: 3 });
  const upserts: FixtureUpsert[] = [];

  const result = await ingestTxlineFixtures({
    competitionId: "430",
    startEpochDay: 20608,
    fetchFixtures: async () => [successful, invalidId, unreliableTeams, failing],
    upsertFixture: async (upsert) => {
      upserts.push(upsert);
      if (upsert.where.fixtureId === "3") throw new Error("mock db failure");
    }
  });

  assert.deepEqual(summarizeFixtureIngestion(result), {
    fetched_count: 4,
    normalized_count: 3,
    upserted_count: 1,
    skipped_count: 2,
    failed_count: 1
  });
  assert.equal(upserts.length, 2);
  assert.deepEqual(result.fixtures.map((fixture) => fixture.fixture_id), ["17952170"]);
});
