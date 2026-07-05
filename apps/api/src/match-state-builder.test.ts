import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalMatchState,
  normalizeMatchStateOptions
} from "./match-state-builder.js";

const fixture = {
  fixtureId: "17952170",
  competition: "International",
  homeTeam: "Slovenia",
  awayTeam: "Cyprus",
  startTimeUtc: new Date("2025-06-01T18:00:00.000Z"),
  status: "finished"
};
const scoreboard = {
  homeScore: 1,
  awayScore: 1,
  phase: "finished",
  lastDataReceivedAt: new Date("2025-06-01T20:00:00.000Z")
};
const odds = [{
  marketId: "match_result",
  marketName: "Match Result",
  selectionName: "Home",
  odds: 2.25,
  direction: "flat",
  sourceTimestamp: new Date("2025-06-01T19:30:00.000Z"),
  raw: { must_not_leak: true }
}];

function build(overrides: Partial<Parameters<typeof buildCanonicalMatchState>[0]> = {}) {
  return buildCanonicalMatchState({
    fixtureId: "17952170",
    fixture,
    scoreboard,
    odds,
    builtAt: new Date("2025-06-01T20:01:00.000Z"),
    ...overrides
  });
}

test("builds complete state from fixture, scoreboard, and odds", () => {
  const state = build();
  assert.equal(state.quality.status, "complete");
  assert.equal(state.scoreboard.available, true);
  assert.equal(state.odds.available, true);
  assert.equal(state.odds.count, 1);
});

test("builds partial state when fixture exists without scoreboard or odds", () => {
  const state = build({ scoreboard: null, odds: [] });
  assert.equal(state.quality.status, "partial");
  assert.deepEqual(state.quality.issues, ["scoreboard_missing", "odds_missing"]);
});

test("builds partial state when odds exist without fixture", () => {
  const state = build({ fixture: null, scoreboard: null });
  assert.equal(state.quality.status, "partial");
  assert.equal(state.quality.has_odds, true);
  assert.ok(state.quality.issues.includes("fixture_missing"));
});

test("builds empty state when no persisted data exists", () => {
  const state = build({ fixture: null, scoreboard: null, odds: [] });
  assert.equal(state.quality.status, "empty");
  assert.ok(state.quality.issues.includes("no_persisted_data"));
});

test("includeOdds=false omits odds markets", () => {
  const state = build({ includeOdds: false });
  assert.equal(state.odds.available, false);
  assert.equal(state.odds.count, 0);
  assert.deepEqual(state.odds.markets, []);
});

test("normalizes odds limit with a maximum of 50", () => {
  assert.equal(normalizeMatchStateOptions({ oddsLimit: 500 }).oddsLimit, 50);
  assert.equal(normalizeMatchStateOptions().oddsLimit, 20);
});

test("freshness chooses the latest score or odds timestamp", () => {
  const state = build({
    odds: [{ ...odds[0], sourceTimestamp: new Date("2025-06-01T20:30:00.000Z") }]
  });
  assert.equal(state.freshness.latest_data_timestamp, "2025-06-01T20:30:00.000Z");
});

test("does not include raw payloads or analysis and wagering fields", () => {
  const serialized = JSON.stringify(build());
  for (const forbidden of [
    "must_not_leak", "raw", "signal", "confidence", "probability",
    "recommendation", "betting", "wagering"
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});

test("quality issues describe each missing part", () => {
  const state = build({ fixture: null, scoreboard: null, odds: [] });
  assert.deepEqual(state.quality.issues, [
    "fixture_missing",
    "scoreboard_missing",
    "odds_missing",
    "no_persisted_data"
  ]);
});
