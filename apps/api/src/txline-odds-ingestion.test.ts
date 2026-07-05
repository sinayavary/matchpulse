import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOddsMarketId,
  ingestTxlineOddsSnapshot,
  mapTxlineOddsSnapshotToOddsRows
} from "./txline-odds-ingestion.js";

const fixtureId = "17952170";
const sample = {
  fixtureId: 17952170,
  messageId: "msg-1",
  ts: 1780596263367,
  bookmaker: "ExampleBook",
  bookmakerId: 12,
  superOddsType: "MATCH_WINNER",
  marketPeriod: "FULL_TIME",
  marketParameters: { line: "main" },
  priceNames: ["Home", "Draw", "Away"],
  prices: [2.1, 3.2, 2.8]
};

test("buildOddsMarketId returns a stable non-empty market id", () => {
  const first = buildOddsMarketId(sample);
  const second = buildOddsMarketId({
    ...sample,
    marketParameters: { z: 1, line: "main" }
  });
  const reordered = buildOddsMarketId({
    ...sample,
    marketParameters: { line: "main", z: 1 }
  });

  assert.notEqual(first, "");
  assert.match(first, /MATCH_WINNER/);
  assert.match(first, /FULL_TIME/);
  assert.match(first, /12/);
  assert.equal(second, reordered);
});

test("buildOddsMarketId returns unknown for an empty record", () => {
  assert.equal(buildOddsMarketId({}), "unknown");
});

test("maps each valid price conservatively", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([sample], { fixtureId });

  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows.map((row) => row.selectionName), ["Home", "Draw", "Away"]);
  assert.deepEqual(result.rows.map((row) => row.odds), [2.1, 3.2, 2.8]);
  for (const row of result.rows) {
    assert.equal(row.fixtureId, fixtureId);
    assert.equal(row.direction, "flat");
    assert.equal(row.previousOdds, null);
    assert.equal(row.changePercent, null);
    assert.ok(row.sourceTimestamp instanceof Date);
    assert.equal(Number.isFinite(row.sourceTimestamp.getTime()), true);
  }
});

test("skips non-finite and non-numeric prices", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([
    { ...sample, prices: [2.1, null, "bad", Infinity] }
  ], { fixtureId });

  assert.deepEqual(result.rows.map((row) => row.odds), [2.1]);
  assert.equal(result.skipped_count, 3);
});

test("uses indexed fallback names when price names are missing or short", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([
    { ...sample, priceNames: ["Home"], prices: [2.1, 3.2, 2.8] }
  ], { fixtureId });

  assert.deepEqual(result.rows.map((row) => row.selectionName), [
    "Home", "selection_1", "selection_2"
  ]);
});

test("omits raw data by default and when includeRaw is false", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([sample], {
    fixtureId,
    includeRaw: false
  });

  assert.equal(Object.hasOwn(result.rows[0], "raw"), false);
});

test("includes raw data only when requested", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([sample], {
    fixtureId,
    includeRaw: true
  });

  assert.equal(result.rows[0]?.raw, sample);
});

test("maps an invalid timestamp to null", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([
    { ...sample, ts: "invalid" }
  ], { fixtureId });

  assert.equal(result.rows[0]?.sourceTimestamp, null);
});

test("returns no rows and no skips for an empty snapshot", () => {
  assert.deepEqual(mapTxlineOddsSnapshotToOddsRows([], { fixtureId }), {
    rows: [],
    skipped_count: 0
  });
});

test("does not generate movement, confidence, or signal fields", () => {
  const result = mapTxlineOddsSnapshotToOddsRows([sample], { fixtureId });
  const row = result.rows[0] as unknown as Record<string, unknown>;

  assert.equal(Object.hasOwn(row, "movement"), false);
  assert.equal(Object.hasOwn(row, "confidence"), false);
  assert.equal(Object.hasOwn(row, "signal"), false);
});

test("summarizes mocked fetching, mapping, writes, skips, and failures", async () => {
  const result = await ingestTxlineOddsSnapshot(
    { fixtureId, asOf: sample.ts },
    {
      fetchOdds: async () => [
        { ...sample, prices: [2.1, "bad", 2.8] }
      ],
      writeOddsSnapshot: async (write) => {
        if (write.create.selectionName === "Away") throw new Error("mock write failure");
      }
    }
  );

  assert.deepEqual(result.result, {
    fetched_count: 1,
    mapped_count: 2,
    upserted_count: 1,
    skipped_count: 1,
    failed_count: 1
  });
  assert.equal(result.odds_snapshots.length, 1);
});
