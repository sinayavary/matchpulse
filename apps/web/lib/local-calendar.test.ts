import assert from "node:assert/strict";
import test from "node:test";
import { customLocalDateUtcRange, localCalendarDayKey, localCalendarDayLabel, localDayUtcRange } from "./local-calendar.js";

test("local calendar grouping keeps UTC instants and browser-local days separate", () => {
  const now = new Date("2026-07-18T23:30:00.000Z");
  const match = "2026-07-19T00:15:00.000Z";
  assert.equal(localCalendarDayKey(match, "Pacific/Kiritimati"), "2026-07-19");
  assert.equal(localCalendarDayLabel(match, now, "Pacific/Kiritimati"), "Today");
  assert.equal(localCalendarDayLabel("2026-07-19T12:00:00.000Z", now, "America/New_York"), "Tomorrow");
  assert.equal(localCalendarDayLabel("2026-07-19T12:00:00.000Z", now, "Etc/GMT+12"), "Tomorrow");
});

test("today and tomorrow become exact UTC instants at UTC+14 and UTC-12", () => {
  const now = new Date("2026-07-18T23:30:00.000Z");
  assert.deepEqual(localDayUtcRange(now, 0, "Pacific/Kiritimati"), { from: "2026-07-18T10:00:00.000Z", to: "2026-07-19T10:00:00.000Z" });
  assert.deepEqual(localDayUtcRange(now, 1, "Pacific/Kiritimati"), { from: "2026-07-19T10:00:00.000Z", to: "2026-07-20T10:00:00.000Z" });
  assert.deepEqual(localDayUtcRange(now, 0, "Etc/GMT+12"), { from: "2026-07-18T12:00:00.000Z", to: "2026-07-19T12:00:00.000Z" });
});

test("custom local dates preserve DST-short and DST-long days", () => {
  const spring = customLocalDateUtcRange("2026-03-08", "America/New_York");
  const autumn = customLocalDateUtcRange("2026-11-01", "America/New_York");
  assert.equal(Date.parse(spring!.to) - Date.parse(spring!.from), 23 * 60 * 60_000);
  assert.equal(Date.parse(autumn!.to) - Date.parse(autumn!.from), 25 * 60 * 60_000);
});

test("local calendar labels survive DST transition", () => {
  const now = new Date("2026-03-08T06:30:00.000Z");
  assert.equal(localCalendarDayLabel("2026-03-09T06:00:00.000Z", now, "America/New_York"), "Tomorrow");
});
