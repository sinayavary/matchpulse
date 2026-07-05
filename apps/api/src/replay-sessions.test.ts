import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplayState,
  createReplaySession,
  getReplaySession,
  ReplaySessionValidationError
} from "./replay-sessions.js";

test("creates a session with the default demo seed", () => {
  const { session, timeline } = createReplaySession();

  assert.equal(session.seed, "slovenia-cyprus-2026-friendly");
  assert.equal(session.fixture_id, "17952170");
  assert.equal(session.status, "running");
  assert.equal(session.speed, 1);
  assert.ok(timeline.length > 0);
});

test("accepts each supported replay speed", () => {
  for (const speed of [1, 2, 5]) {
    assert.equal(createReplaySession({ speed }).session.speed, speed);
  }
});

test("rejects an invalid replay speed", () => {
  assert.throws(
    () => createReplaySession({ speed: 3 }),
    (error) => error instanceof ReplaySessionValidationError && error.code === "invalid_speed"
  );
});

test("creates unique session IDs", () => {
  const first = createReplaySession().session.session_id;
  const second = createReplaySession().session.session_id;

  assert.notEqual(first, second);
});

test("gets an existing session", () => {
  const created = createReplaySession();

  assert.deepEqual(getReplaySession(created.session.session_id), created);
});

test("returns null for a missing session", () => {
  assert.equal(getReplaySession("missing-session"), null);
});

test("starts at index zero with zero progress and the known final score", () => {
  const { session, timeline } = createReplaySession();
  const state = buildReplayState(session, timeline);

  assert.equal(session.current_index, 0);
  assert.equal(state.current_index, 0);
  assert.equal(state.progress_percent, 0);
  assert.deepEqual(state.summary.final_score, { home: 1, away: 1 });
});

test("does not include raw replay payloads by default", () => {
  const { session, timeline } = createReplaySession();
  const state = buildReplayState(session, timeline);

  assert.equal(state.current_event?.debug, undefined);
  assert.equal(JSON.stringify(state).includes('"raw"'), false);
});
