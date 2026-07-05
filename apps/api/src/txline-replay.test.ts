import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTxlineReplaySummary,
  buildTxlineReplayTimeline,
  detectScoreChange,
  getScoreFromRecord,
  normalizeReplayEvent
} from "./txline-replay.js";

function scoreRecord({
  fixtureId = 42,
  seq,
  ts,
  p1Goals,
  p2Goals,
  action = "score_update",
  clockSeconds,
  includeScore = true
}: {
  fixtureId?: number;
  seq?: number;
  ts?: number;
  p1Goals?: unknown;
  p2Goals?: unknown;
  action?: string;
  clockSeconds?: number;
  includeScore?: boolean;
}) {
  return {
    FixtureId: fixtureId,
    ...(seq === undefined ? {} : { Seq: seq }),
    ...(ts === undefined ? {} : { Ts: ts }),
    ...(action.length === 0 ? {} : { Action: action }),
    ...(clockSeconds === undefined ? {} : { ClockSeconds: clockSeconds }),
    ...(includeScore
      ? {
          Score: {
            Participant1: { Total: { Goals: p1Goals } },
            Participant2: { Total: { Goals: p2Goals } }
          }
        }
      : {})
  };
}

test("sorts replay events by Seq ascending and then Ts ascending", () => {
  const timeline = buildTxlineReplayTimeline(
    [
      scoreRecord({ seq: 5, ts: 300, p1Goals: 1, p2Goals: 0, action: "late" }),
      scoreRecord({ seq: 1, ts: 200, p1Goals: 0, p2Goals: 0, action: "first" }),
      scoreRecord({ seq: 5, ts: 100, p1Goals: 1, p2Goals: 1, action: "middle" }),
      scoreRecord({ ts: 50, p1Goals: 2, p2Goals: 1, action: "no_seq" })
    ],
    { participant1IsHome: true }
  );

  assert.deepEqual(timeline.map((event) => event.action), ["first", "middle", "late", "no_seq"]);
});

test("filters replay events by fixtureId", () => {
  const timeline = buildTxlineReplayTimeline(
    [
      scoreRecord({ fixtureId: 42, seq: 1, ts: 100, p1Goals: 0, p2Goals: 0 }),
      scoreRecord({ fixtureId: 99, seq: 2, ts: 200, p1Goals: 9, p2Goals: 9 })
    ],
    { fixtureId: "42", participant1IsHome: true }
  );

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0]?.seq, 1);
});

test("preserves null scores instead of inventing zeroes", () => {
  const timeline = buildTxlineReplayTimeline(
    [scoreRecord({ seq: 1, ts: 100, p1Goals: undefined, p2Goals: null })],
    { participant1IsHome: true }
  );

  assert.deepEqual(timeline[0]?.score, { home: null, away: null });
  assert.equal(timeline[0]?.note, "score_snapshot_without_goals");
});

test("detects score change when goals first appear or later change", () => {
  const timeline = buildTxlineReplayTimeline(
    [
      scoreRecord({ seq: 1, ts: 100, p1Goals: undefined, p2Goals: undefined }),
      scoreRecord({ seq: 2, ts: 200, p1Goals: 1, p2Goals: undefined }),
      scoreRecord({ seq: 3, ts: 300, p1Goals: 1, p2Goals: 1 })
    ],
    { participant1IsHome: true }
  );

  assert.equal(timeline[0]?.score_changed, false);
  assert.equal(timeline[1]?.score_changed, true);
  assert.equal(timeline[2]?.score_changed, true);
});

test("does not mark repeated identical score snapshots as changed", () => {
  const timeline = buildTxlineReplayTimeline(
    [
      scoreRecord({ seq: 1, ts: 100, p1Goals: 1, p2Goals: 0 }),
      scoreRecord({ seq: 2, ts: 200, p1Goals: 1, p2Goals: 0 })
    ],
    { participant1IsHome: true }
  );

  assert.equal(timeline[0]?.score_changed, true);
  assert.equal(timeline[1]?.score_changed, false);
});

test("summary final_score uses the latest known goals across the timeline", () => {
  const timeline = buildTxlineReplayTimeline(
    [
      scoreRecord({ seq: 1, ts: 100, p1Goals: 1, p2Goals: undefined, action: "home_goal" }),
      scoreRecord({ seq: 2, ts: 200, p1Goals: 1, p2Goals: 1, action: "away_goal" }),
      scoreRecord({ seq: 3, ts: 300, p1Goals: undefined, p2Goals: 1, action: "game_finalised" })
    ],
    { participant1IsHome: true }
  );
  const summary = buildTxlineReplaySummary(timeline);

  assert.deepEqual(summary.final_score, { home: 1, away: 1 });
  assert.equal(summary.first_seq, 1);
  assert.equal(summary.last_seq, 3);
  assert.equal(summary.score_change_events, 2);
  assert.deepEqual(summary.actions_seen, ["home_goal", "away_goal", "game_finalised"]);
});

test("keeps raw payloads out by default and exposes them only when includeRaw is true", () => {
  const raw = scoreRecord({ seq: 1, ts: 100, p1Goals: 0, p2Goals: 0 });
  const withoutRaw = normalizeReplayEvent(raw, { participant1IsHome: true });
  const withRaw = normalizeReplayEvent(raw, { participant1IsHome: true, includeRaw: true });

  assert.equal(withoutRaw?.debug, undefined);
  assert.deepEqual(withRaw?.debug?.raw, raw);
});

test("exposes normalized score orientation and conservative clock parsing", () => {
  const raw = scoreRecord({ seq: 1, ts: 100, p1Goals: 2, p2Goals: 1, clockSeconds: 540 });
  const score = getScoreFromRecord(raw, false);
  const event = normalizeReplayEvent(raw, { participant1IsHome: false });

  assert.deepEqual(score, { home: 1, away: 2 });
  assert.equal(event?.clock_seconds, 540);
});

test("detectScoreChange only reacts to current known goal values", () => {
  assert.equal(
    detectScoreChange({ home: 1, away: 1 }, { home: null, away: 1 }),
    false
  );
  assert.equal(
    detectScoreChange({ home: null, away: null }, { home: 0, away: null }),
    true
  );
});
