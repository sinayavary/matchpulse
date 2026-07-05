import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOddsAsOfCandidates,
  discoverTxlineOddsAvailability,
  TxlineOddsDiscoveryError
} from "./txline-odds-discovery.js";

const START_TIME = "2026-07-05T18:00:00.000Z";

test("buildOddsAsOfCandidates returns the fixed eight candidates", () => {
  assert.equal(buildOddsAsOfCandidates(START_TIME).length, 8);
});

test("buildOddsAsOfCandidates bases each offset on the fixture start", () => {
  const start = Date.parse(START_TIME);
  assert.deepEqual(buildOddsAsOfCandidates(START_TIME), [
    start - 7 * 24 * 60 * 60 * 1_000,
    start - 3 * 24 * 60 * 60 * 1_000,
    start - 48 * 60 * 60 * 1_000,
    start - 24 * 60 * 60 * 1_000,
    start - 12 * 60 * 60 * 1_000,
    start - 6 * 60 * 60 * 1_000,
    start - 60 * 60 * 1_000,
    start
  ]);
});

test("buildOddsAsOfCandidates rejects invalid start times", () => {
  assert.deepEqual(buildOddsAsOfCandidates("not-a-date"), []);
  assert.deepEqual(buildOddsAsOfCandidates(null), []);
});

test("discovery caps the fixture scan at 50", async () => {
  const fixtures = Array.from({ length: 51 }, (_, index) => ({ index }));
  let oddsFetches = 0;
  const result = await discoverTxlineOddsAvailability(
    { competitionId: 72, startEpochDay: 20624, limit: 999 },
    {
      fetchFixtures: async () => fixtures,
      normalizeFixture: (rawFixture) => {
        const fixture = rawFixture as { index: number };
        return {
          fixture_id: String(fixture.index),
          home_team: "Home",
          away_team: "Away",
          start_time_utc: START_TIME
        };
      },
      fetchOdds: async () => {
        oddsFetches += 1;
        return [];
      },
      wait: async () => undefined
    }
  );

  assert.equal(result.checked_fixtures, 50);
  assert.equal(result.checked_candidates, 400);
  assert.equal(oddsFetches, 400);
});

test("discovery can return the found=false result shape", async () => {
  const result = await discoverTxlineOddsAvailability(
    { competitionId: 72, startEpochDay: 20624 },
    {
      fetchFixtures: async () => [],
      fetchOdds: async () => [],
      wait: async () => undefined
    }
  );

  assert.deepEqual(result, {
    found: false,
    competition_id: 72,
    start_epoch_day: 20624,
    checked_fixtures: 0,
    checked_candidates: 0,
    candidate: null
  });
});

test("discovery continues candidate errors and reports a safe degraded result", async () => {
  let oddsFetches = 0;
  await assert.rejects(
    discoverTxlineOddsAvailability(
      { competitionId: 72, startEpochDay: 20624, limit: 1 },
      {
        fetchFixtures: async () => [{}],
        normalizeFixture: () => ({
          fixture_id: "fixture-1",
          home_team: "Home",
          away_team: "Away",
          start_time_utc: START_TIME
        }),
        fetchOdds: async () => {
          oddsFetches += 1;
          throw new Error("raw upstream detail that must not escape");
        },
        wait: async () => undefined
      }
    ),
    (error: unknown) => {
      assert.ok(error instanceof TxlineOddsDiscoveryError);
      assert.equal(error.result.checked_candidates, 8);
      assert.equal(error.message.includes("raw upstream detail"), false);
      return true;
    }
  );
  assert.equal(oddsFetches, 8);
});

test("found samples are safe mapped rows and discovery performs no DB write", async () => {
  let dbWrites = 0;
  const unusedDbWriter = async () => {
    dbWrites += 1;
  };
  void unusedDbWriter;
  const result = await discoverTxlineOddsAvailability(
    { competitionId: 72, startEpochDay: 20624, includeSamples: true },
    {
      fetchFixtures: async () => [{ fixture: "raw" }],
      normalizeFixture: () => ({
        fixture_id: "fixture-1",
        home_team: "Home",
        away_team: "Away",
        start_time_utc: START_TIME
      }),
      fetchOdds: async () => [{
        messageId: "message-1",
        bookmakerId: "bookmaker-1",
        superOddsType: "match_winner",
        marketPeriod: "full_time",
        prices: [1.8, 2.1],
        priceNames: ["Home", "Away"],
        ts: Date.parse(START_TIME),
        rawPayload: { token: "must-not-escape" }
      }],
      wait: async () => undefined
    }
  );

  assert.equal(result.found, true);
  assert.equal(dbWrites, 0);
  assert.ok(result.candidate);
  assert.equal(result.candidate.mapped_count, 2);
  assert.equal(result.candidate.sample.length, 2);
  assert.deepEqual(Object.keys(result.candidate.sample[0]).sort(), [
    "direction",
    "market_id",
    "market_name",
    "odds",
    "selection_name",
    "source_timestamp"
  ]);

  const serialized = JSON.stringify(result);
  for (const forbiddenField of [
    "rawPayload",
    "token",
    "confidence",
    "movement",
    "signalCore",
    "signal_core"
  ]) {
    assert.equal(serialized.includes(forbiddenField), false);
  }
});
