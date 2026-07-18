import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTxlineFixture } from "./txline-normalizer.js";
import {
  ingestTxlineFixtureDiscoveryWindow,
  ingestTxlineFixtures,
  buildFixtureCatalogReconciliationReport,
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

test("fixture discovery window covers configured backfill and future horizon with isolated day failures", async () => {
  const requestedDays: number[] = [];
  const result = await ingestTxlineFixtureDiscoveryWindow({
    competitionId: "430",
    now: new Date("2026-07-18T12:00:00.000Z"),
    backfillDays: 1,
    futureDays: 14,
    retries: 0,
    fetchFixtures: async ({ startEpochDay }) => {
      requestedDays.push(startEpochDay);
      if (startEpochDay % 2 === 0) throw new Error("simulated upstream day failure");
      return [];
    },
    wait: async () => undefined
  });
  assert.equal(result.days, 16);
  assert.equal(result.coverage.requested_epoch_days.length, 16);
  assert.equal(result.coverage.successful_epoch_days.length + result.coverage.failed_epoch_days.length, 16);
  assert.deepEqual(requestedDays, result.coverage.requested_epoch_days);
  assert.equal(result.coverage.future_horizon_days, 14);
  assert.deepEqual(result.coverage.attempted_epoch_days, result.coverage.requested_epoch_days);
});

test("fixture discovery retries a rate-limited day with Retry-After and continues the window", async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await ingestTxlineFixtureDiscoveryWindow({
    competitionId: "430",
    now: new Date("2026-07-18T12:00:00.000Z"),
    backfillDays: 0,
    futureDays: 0,
    fetchFixtures: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("rate limited"), { status: 429, headers: { "Retry-After": "2" } });
      return [];
    },
    wait: async (ms) => { waits.push(ms); },
    jitter: () => 0
  });
  assert.equal(calls, 2);
  assert.equal(result.coverage.retry_count, 1);
  assert.deepEqual(result.coverage.rate_limited_epoch_days, [20652]);
  assert.ok(waits.some((ms) => ms >= 2_000));
});

test("catalog reconciliation is dry-run, deterministic, and never deletes source rows", () => {
  const report = buildFixtureCatalogReconciliationReport([
    { fixtureId: "a", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:00:00.000Z"), status: "UNKNOWN" },
    { fixtureId: "b", competition: "Cup", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:02:00.000Z"), status: "UNKNOWN" },
    { fixtureId: "c", competition: "Cup", homeTeam: null, awayTeam: "D", startTimeUtc: null, status: null }
  ], { now: new Date("2026-07-18T16:00:00.000Z") });
  assert.equal(report.dry_run, true);
  assert.equal(report.rows_scanned, 3);
  assert.equal(report.duplicate_candidate_groups, 1);
  assert.equal(report.high_confidence_duplicates, 1);
  assert.equal(report.source_rows_deleted, 0);
});
