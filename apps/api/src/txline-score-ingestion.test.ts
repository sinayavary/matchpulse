import assert from "node:assert/strict";
import test from "node:test";
import {
  ingestTxlineScoreSnapshot,
  mapNormalizedScoreToMatchStateUpsert,
  summarizeScoreIngestion,
  type MatchStateUpsert
} from "./txline-score-ingestion.js";

const receivedAt = new Date("2026-06-04T16:44:23.367Z");

test("maps a normalized score to a MatchState upsert without changing fixtureId", () => {
  const upsert = mapNormalizedScoreToMatchStateUpsert({
    fixtureId: "17952170",
    score: { home: 1, away: 1 },
    receivedAt
  });

  assert.equal(upsert.where.fixtureId, "17952170");
  assert.equal(upsert.create.fixtureId, "17952170");
  assert.equal(upsert.create.homeScore, 1);
  assert.equal(upsert.create.awayScore, 1);
  assert.equal(upsert.create.phase, "unknown");
  assert.equal(upsert.create.marketMood, "unknown");
  assert.equal(upsert.create.momentumSide, "unknown");
  assert.equal("rawScore" in upsert.create, false);
});

test("unknown and missing goals remain null rather than becoming zero", () => {
  const upsert = mapNormalizedScoreToMatchStateUpsert({
    fixtureId: "17952170",
    score: { home: null, away: null },
    receivedAt
  });

  assert.equal(upsert.create.homeScore, null);
  assert.equal(upsert.create.awayScore, null);
  assert.equal(upsert.update.homeScore, null);
  assert.equal(upsert.update.awayScore, null);
});

test("raw score is only included when requested", () => {
  const rawScore = { FixtureId: 17952170, Score: { safe: true } };
  const excluded = mapNormalizedScoreToMatchStateUpsert({
    fixtureId: "17952170",
    score: { home: 1, away: 1 },
    receivedAt,
    rawScore,
    includeRaw: false
  });
  const included = mapNormalizedScoreToMatchStateUpsert({
    fixtureId: "17952170",
    score: { home: 1, away: 1 },
    receivedAt,
    rawScore,
    includeRaw: true
  });

  assert.equal("rawScore" in excluded.create, false);
  assert.deepEqual(included.create.rawScore, rawScore);
});

test("ingests, selects, normalizes, and summarizes the latest score", async () => {
  let captured!: MatchStateUpsert;
  const result = await ingestTxlineScoreSnapshot({
    fixtureId: "17952170",
    asOf: receivedAt.getTime(),
    fetchScores: async () => [
      { FixtureId: 17952170, Seq: 100, Ts: receivedAt.getTime() - 1, Score: {} },
      {
        FixtureId: 17952170,
        Seq: 960,
        Ts: receivedAt.getTime(),
        Action: "game_finalised",
        Score: {
          Participant1: { Total: { Goals: 1 } },
          Participant2: { Total: { Goals: 1 } }
        }
      }
    ],
    readParticipant1IsHome: async () => true,
    upsertMatchState: async (upsert) => {
      captured = upsert;
      return {
        fixtureId: "17952170",
        homeScore: 1,
        awayScore: 1,
        phase: "unknown",
        marketMood: "unknown",
        lastDataReceivedAt: receivedAt
      };
    }
  });

  assert.equal(captured.where.fixtureId, "17952170");
  assert.deepEqual(summarizeScoreIngestion(result), {
    fetched_count: 2,
    selected_seq: 960,
    selected_ts: receivedAt.getTime(),
    action: "game_finalised",
    score_available: true,
    upserted: true
  });
});

test("an invalid or empty snapshot returns a safe result without an upsert", async () => {
  let upserted = false;
  const result = await ingestTxlineScoreSnapshot({
    fixtureId: "17952170",
    asOf: receivedAt.getTime(),
    fetchScores: async () => ({ unexpected: "shape" }),
    readParticipant1IsHome: async () => true,
    upsertMatchState: async () => {
      upserted = true;
      throw new Error("must not run");
    }
  });

  assert.equal(upserted, false);
  assert.deepEqual(summarizeScoreIngestion(result), {
    fetched_count: 0,
    selected_seq: null,
    selected_ts: null,
    action: null,
    score_available: false,
    upserted: false
  });
  assert.equal(result.matchState, null);
});

test("an unoriented asymmetric score is not guessed", async () => {
  let captured!: MatchStateUpsert;
  await ingestTxlineScoreSnapshot({
    fixtureId: "17952170",
    asOf: receivedAt.getTime(),
    fetchScores: async () => [{
      FixtureId: 17952170,
      Score: {
        Participant1: { Total: { Goals: 2 } },
        Participant2: { Total: {} }
      }
    }],
    readParticipant1IsHome: async () => null,
    upsertMatchState: async (upsert) => {
      captured = upsert;
      return {
        fixtureId: "17952170",
        homeScore: null,
        awayScore: null,
        phase: "unknown",
        marketMood: "unknown",
        lastDataReceivedAt: receivedAt
      };
    }
  });

  assert.equal(captured.create.homeScore, null);
  assert.equal(captured.create.awayScore, null);
});
