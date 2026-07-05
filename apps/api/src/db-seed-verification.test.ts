import assert from "node:assert/strict";
import test from "node:test";
import { verifyDemoSeed } from "./db-seed-verification.js";

test("returns no_data without database configuration", async () => {
  const result = await verifyDemoSeed({ databaseUrl: null });

  assert.equal(result.meta.status, "no_data");
  assert.equal(result.data.fixture_found, false);
  assert.equal(result.data.match_state_found, false);
});

test("returns safe seeded fixture and match state data", async () => {
  const result = await verifyDemoSeed({
    databaseUrl: "configured",
    findFixture: async () => ({
      fixtureId: "17952170",
      competition: "Friendlies",
      homeTeam: "Slovenia",
      awayTeam: "Cyprus",
      startTimeUtc: new Date("2026-06-04T16:00:00.000Z"),
      status: "UNKNOWN",
      matchState: {
        fixtureId: "17952170",
        homeScore: 1,
        awayScore: 1,
        phase: "unknown",
        marketMood: "unknown"
      }
    })
  });

  assert.equal(result.meta.status, "live");
  assert.equal(result.data.fixture?.home_team, "Slovenia");
  assert.equal(result.data.match_state?.home_score, 1);
  assert.equal(result.data.match_state?.away_score, 1);
});

test("returns degraded without leaking a database error", async () => {
  const result = await verifyDemoSeed({
    databaseUrl: "configured",
    findFixture: async () => {
      throw new Error("sensitive connection details");
    }
  });

  assert.deepEqual(result, {
    data: {
      fixture_found: false,
      match_state_found: false,
      fixture: null,
      match_state: null
    },
    meta: { status: "degraded", source: "database" }
  });
});
