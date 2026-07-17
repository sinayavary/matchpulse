import assert from "node:assert/strict";
import test from "node:test";
import { cadenceForPhase, parseCompetitionConfig, pollPhase, withProviderRetry } from "./automatic-data-runtime.js";

test("production competition configuration fails closed", () => {
  assert.deepEqual(parseCompetitionConfig("430:20608,431:20609"), [{ competitionId: "430", startEpochDay: 20608 }, { competitionId: "431", startEpochDay: 20609 }]);
  assert.deepEqual(parseCompetitionConfig(""), []);
  assert.throws(() => parseCompetitionConfig("demo"));
});

test("adaptive cadence follows upcoming, prematch, live and postmatch windows", () => {
  const config = { leadMinutes: 60, tailMinutes: 180, upcomingMs: 300000, prematchMs: 30000, liveMs: 15000, postmatchMs: 30000 };
  const now = new Date("2026-07-18T12:00:00Z");
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T14:00:00Z"), "scheduled", now, config), config), 300000);
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T12:30:00Z"), "scheduled", now, config), config), 30000);
  assert.equal(cadenceForPhase("live", config), 15000);
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T11:00:00Z"), "finished", now, config), config), Infinity);
});

test("provider retry honors retry count without fabricating a result", async () => {
  let calls = 0;
  const result = await withProviderRetry(async () => { calls += 1; if (calls < 3) throw new Error("temporary"); return "ok"; }, { sleep: async () => undefined });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});
