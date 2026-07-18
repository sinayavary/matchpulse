import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFiniteGoalScore,
  normalizeTxlineFixture,
  normalizeProviderStatus,
  normalizeTxlineMatchPreview,
  normalizeTxlineScore,
  normalizeAsOfToEpochMs,
  parseEpochMsToIso,
  selectLatestTxlineScore
} from "./txline-normalizer.js";

const fixture = {
  FixtureId: 42,
  Competition: "Premier League",
  StartTime: 1_735_689_600_000,
  Participant1: "Alpha",
  Participant2: "Beta",
  Participant1IsHome: true,
  GameState: 7
};

const score = (fixtureId: number, seq: number | undefined, ts: number, p1: unknown, p2: unknown) => ({
  FixtureId: fixtureId,
  ...(seq === undefined ? {} : { Seq: seq }),
  Ts: ts,
  Score: {
    Participant1: { Total: { Goals: p1 } },
    Participant2: { Total: { Goals: p2 } }
  }
});

test("normalizes fixtures and preserves only confirmed values", () => {
  const normalized = normalizeTxlineFixture(fixture);
  assert.equal(normalized?.fixture_id, "42");
  assert.equal(normalized?.home_team, "Alpha");
  assert.equal(normalized?.away_team, "Beta");
  assert.equal(normalized?.start_time_utc, "2025-01-01T00:00:00.000Z");
  assert.equal(normalized?.raw_game_state, 7);
  assert.equal(normalized?.status, "UNKNOWN");
  assert.equal(normalized?.phase, "unknown");
  assert.equal(normalized?.provider_status, null);

  const reversed = normalizeTxlineFixture({ ...fixture, Participant1IsHome: false });
  assert.equal(reversed?.home_team, "Beta");
  assert.equal(reversed?.away_team, "Alpha");
});

test("normalizes real provider status fields without guessing from unrelated fields", () => {
  assert.deepEqual(normalizeProviderStatus("FT"), { provider_status: "FT", normalized_status: "finished" });
  assert.deepEqual(normalizeProviderStatus("first-half"), { provider_status: "first-half", normalized_status: "first half" });
  const scheduled = normalizeTxlineFixture({ ...fixture, Status: "Scheduled" });
  assert.equal(scheduled?.status, "scheduled");
  assert.equal(scheduled?.provider_status, "Scheduled");
  assert.equal(normalizeTxlineFixture({ ...fixture, GameState: 7 })?.status, "UNKNOWN");
});

test("rejects invalid fixture IDs and handles missing fixture fields", () => {
  assert.equal(normalizeTxlineFixture({ ...fixture, FixtureId: null }), null);
  const missing = normalizeTxlineFixture({
    ...fixture,
    Participant1: "",
    Participant2: null,
    StartTime: 1_700_000_000
  });
  assert.equal(missing?.home_team, "unknown");
  assert.equal(missing?.away_team, "unknown");
  assert.equal(missing?.start_time_utc, null);
});

test("selects only the matching fixture score by Seq and then Ts", () => {
  const seq1 = score(42, 1, 300, 1, 0);
  const seq2Old = score(42, 2, 100, 2, 0);
  const seq2New = score(42, 2, 200, 2, 1);
  const other = score(99, 100, 999, 9, 9);
  assert.equal(selectLatestTxlineScore([seq1, other, seq2Old, seq2New], "42"), seq2New);
  assert.equal(selectLatestTxlineScore([other], 42), null);
  assert.equal(selectLatestTxlineScore({}, 42), null);
});

test("uses Ts when Seq is missing", () => {
  const older = score(42, undefined, 100, 0, 0);
  const newer = score(42, undefined, 200, 1, 0);
  assert.equal(selectLatestTxlineScore([older, newer], 42), newer);
});

test("normalizes goals for both orientations without inventing zeroes", () => {
  const raw = score(42, 1, 100, 3, 2);
  assert.deepEqual(normalizeTxlineScore(raw, true), { home: 3, away: 2 });
  assert.deepEqual(normalizeTxlineScore(raw, false), { home: 2, away: 3 });
  assert.deepEqual(normalizeTxlineScore(score(42, 1, 100, undefined, -1), true), {
    home: null,
    away: null
  });
  assert.deepEqual(normalizeTxlineScore(score(42, 1, 100, "2", Number.NaN), true), {
    home: null,
    away: null
  });
  assert.deepEqual(normalizeTxlineScore(raw, undefined), { home: null, away: null });
});

test("detects whether a normalized score contains usable goal totals", () => {
  assert.equal(hasFiniteGoalScore({ home: 1, away: null }), true);
  assert.equal(hasFiniteGoalScore({ home: null, away: 0 }), true);
  assert.equal(hasFiniteGoalScore({ home: null, away: null }), false);
});

test("parses asOf values from ISO strings and epoch-millisecond strings", () => {
  assert.equal(parseEpochMsToIso("2025-01-01T00:00:00.000Z"), "2025-01-01T00:00:00.000Z");
  assert.equal(parseEpochMsToIso("1735689600000"), "2025-01-01T00:00:00.000Z");
  assert.equal(parseEpochMsToIso("not-a-date"), null);
});

test("normalizes QA asOf values to epoch-millisecond strings", () => {
  assert.equal(normalizeAsOfToEpochMs("1735689600000"), "1735689600000");
  assert.equal(normalizeAsOfToEpochMs("2025-01-01T00:00:00.000Z"), "1735689600000");
  assert.equal(normalizeAsOfToEpochMs("not-a-date"), null);
  assert.equal(normalizeAsOfToEpochMs("1735689600"), null);
});

test("combines the fixture with its latest score and leaves uncertain fields unknown", () => {
  const latest = score(42, 2, 200, 2, 1);
  const preview = normalizeTxlineMatchPreview(fixture, [score(42, 1, 100, 1, 0), latest]);
  assert.deepEqual(preview?.score, { home: 2, away: 1 });
  assert.equal(preview?.has_odds, null);
  assert.equal(preview?.latest_signal_type, null);
  assert.equal(preview?.market_mood, "unknown");
  assert.equal(preview?.momentum, null);
  assert.equal(preview?.phase, "unknown");
  assert.equal(preview?.last_event, null);
  assert.equal(preview?.is_live, null);
  assert.equal(preview?.debug, undefined);

  const withRaw = normalizeTxlineMatchPreview(fixture, [latest], { includeRaw: true });
  assert.deepEqual(withRaw?.debug?.raw, { fixture, score: latest });
});
