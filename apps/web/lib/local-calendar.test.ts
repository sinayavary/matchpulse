import assert from "node:assert/strict";
import test from "node:test";
import { localCalendarDayKey, localCalendarDayLabel } from "./local-calendar.js";

test("local calendar grouping keeps UTC instants and browser-local days separate", () => {
  const now = new Date("2026-07-18T23:30:00.000Z");
  const match = "2026-07-19T00:15:00.000Z";
  assert.equal(localCalendarDayKey(match, "Pacific/Kiritimati"), "2026-07-19");
  assert.equal(localCalendarDayLabel(match, now, "Pacific/Kiritimati"), "Today");
  assert.equal(localCalendarDayLabel("2026-07-19T12:00:00.000Z", now, "America/New_York"), "Tomorrow");
  assert.equal(localCalendarDayLabel("2026-07-19T12:00:00.000Z", now, "Etc/GMT+12"), "Tomorrow");
});

test("local calendar labels survive DST transition", () => {
  const now = new Date("2026-03-08T06:30:00.000Z");
  assert.equal(localCalendarDayLabel("2026-03-09T06:00:00.000Z", now, "America/New_York"), "Tomorrow");
});
