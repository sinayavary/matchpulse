import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleIsLive, lifecycleIsRecentlyFinished, lifecycleIsUpcoming, resolveMatchLifecycle } from "./match-lifecycle.js";

const now = new Date("2026-07-18T12:00:00.000Z");
const future = "2026-07-18T14:00:00.000Z";
const past = "2026-07-18T11:00:00.000Z";

test("provider terminal status wins over stale phase and kickoff heuristic", () => {
  const result = resolveMatchLifecycle({ providerStatus: "FT", persistedPhase: "live", startTimeUtc: future, now });
  assert.equal(result.lifecycle, "finished");
  assert.equal(result.source, "provider_terminal");
  assert.equal(result.is_terminal, true);
});

test("provider live statuses map to canonical phases", () => {
  assert.equal(resolveMatchLifecycle({ providerStatus: "1H", startTimeUtc: future, now }).lifecycle, "live_first_half");
  assert.equal(resolveMatchLifecycle({ providerStatus: "HT", startTimeUtc: future, now }).lifecycle, "halftime");
  assert.equal(resolveMatchLifecycle({ providerStatus: "2H", startTimeUtc: future, now }).lifecycle, "live_second_half");
  assert.equal(resolveMatchLifecycle({ providerStatus: "ET", startTimeUtc: future, now }).lifecycle, "extra_time");
  assert.equal(resolveMatchLifecycle({ providerStatus: "PEN", startTimeUtc: future, now }).lifecycle, "penalties");
});

test("future kickoff is scheduled and capture lead is prematch", () => {
  assert.equal(resolveMatchLifecycle({ startTimeUtc: future, now }).lifecycle, "scheduled");
  assert.equal(resolveMatchLifecycle({ startTimeUtc: "2026-07-18T12:30:00.000Z", now }).lifecycle, "prematch");
});

test("past kickoff without final evidence never becomes upcoming", () => {
  const result = resolveMatchLifecycle({ startTimeUtc: past, now, hasScoreOrEventEvidence: true });
  assert.equal(result.lifecycle, "unknown_in_progress");
  assert.equal(lifecycleIsUpcoming(result), false);
  assert.equal(lifecycleIsLive(result), true);
});

test("capture tail without terminal confirmation becomes finished_unconfirmed", () => {
  const result = resolveMatchLifecycle({ startTimeUtc: "2026-07-18T07:00:00.000Z", now, captureTailMinutes: 180 });
  assert.equal(result.lifecycle, "finished_unconfirmed");
  assert.equal(lifecycleIsRecentlyFinished(result), true);
  assert.equal(result.is_active, false);
  assert.equal(result.is_terminal, true);
});

test("persisted phase is used only when provider status is absent", () => {
  assert.equal(resolveMatchLifecycle({ providerStatus: "UNKNOWN", persistedPhase: "halftime", startTimeUtc: future, now }).lifecycle, "halftime");
  assert.equal(resolveMatchLifecycle({ persistedPhase: "postponed", startTimeUtc: future, now }).lifecycle, "postponed");
});

test("terminal provider states are excluded from live and upcoming", () => {
  for (const providerStatus of ["postponed", "cancelled", "abandoned", "finished"]) {
    const result = resolveMatchLifecycle({ providerStatus, startTimeUtc: future, now });
    assert.equal(lifecycleIsLive(result), false);
    assert.equal(lifecycleIsUpcoming(result), false);
  }
});

test("missing start time is explicit unknown evidence", () => {
  const result = resolveMatchLifecycle({ providerStatus: "UNKNOWN", now });
  assert.equal(result.lifecycle, "unknown_in_progress");
  assert.equal(result.reason_code, "missing_start_time");
});

test("timezone boundaries are evaluated as instants", () => {
  const result = resolveMatchLifecycle({ startTimeUtc: "2026-07-18T14:00:00+02:00", now });
  assert.equal(result.lifecycle, "unknown_in_progress");
});
