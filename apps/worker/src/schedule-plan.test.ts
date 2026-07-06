import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStaticSchedulePlan,
  DEFAULT_ODDS_LIMIT,
  MAX_ODDS_LIMIT,
  getPrimaryDemoScheduleJob,
  SchedulePlanError,
  STATIC_DEMO_SCHEDULE_JOBS,
  validateScheduleJob
} from "./schedule-plan.js";

test("static schedule plan includes known demo fixture 17952170", () => {
  const plan = buildStaticSchedulePlan();
  const primary = plan.find((job) => job.fixtureId === "17952170");

  assert.ok(primary);
  assert.equal(primary?.competitionId, 430);
  assert.equal(primary?.startEpochDay, 20608);
  assert.equal(primary?.includeFixture, true);
  assert.equal(primary?.includeScore, true);
  assert.equal(primary?.includeOdds, true);
  assert.equal(primary?.oddsLimit, DEFAULT_ODDS_LIMIT);
});

test("static schedule plan may include known demo fixture 17588223 if configured", () => {
  const plan = buildStaticSchedulePlan();
  const secondary = plan.find((job) => job.fixtureId === "17588223");

  assert.ok(secondary);
  assert.equal(secondary?.competitionId, 430);
  assert.equal(secondary?.oddsLimit, DEFAULT_ODDS_LIMIT);
});

test("getPrimaryDemoScheduleJob returns fixture 17952170", () => {
  assert.equal(getPrimaryDemoScheduleJob().fixtureId, "17952170");
});

test("static plan does not fetch live data or write DB during build", () => {
  const before = STATIC_DEMO_SCHEDULE_JOBS.length;
  const plan = buildStaticSchedulePlan();

  assert.equal(plan.length, before);
  assert.equal(STATIC_DEMO_SCHEDULE_JOBS.length, before);
});

test("oddsLimit defaults to 20 when omitted", () => {
  const job = validateScheduleJob({
    fixtureId: "17952170",
    competitionId: 430,
    startEpochDay: 20608
  });

  assert.equal(job.oddsLimit, DEFAULT_ODDS_LIMIT);
});

test("oddsLimit caps at 50", () => {
  const job = validateScheduleJob({
    fixtureId: "17952170",
    competitionId: 430,
    startEpochDay: 20608,
    oddsLimit: 500
  });

  assert.equal(job.oddsLimit, MAX_ODDS_LIMIT);
});

test("schedule job without fixtureId is rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      competitionId: 430,
      startEpochDay: 20608
    }),
    SchedulePlanError
  );
});

test("schedule job with empty fixtureId is rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "   ",
      competitionId: 430,
      startEpochDay: 20608
    }),
    SchedulePlanError
  );
});

test("invalid competitionId is rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: -1,
      startEpochDay: 20608
    }),
    SchedulePlanError
  );

  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: Number.NaN,
      startEpochDay: 20608
    }),
    SchedulePlanError
  );
});

test("invalid startEpochDay is rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: 0
    }),
    SchedulePlanError
  );

  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: Number.POSITIVE_INFINITY
    }),
    SchedulePlanError
  );
});

test("include flags must be boolean", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: 20608,
      includeFixture: "yes"
    }),
    SchedulePlanError
  );
});

test("secret-like schedule fields are rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: 20608,
      privateKey: "abc"
    }),
    SchedulePlanError
  );

  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: 20608,
      nested: { DATABASE_URL: "postgres://example" }
    }),
    SchedulePlanError
  );
});

test("unknown fields on a schedule job are rejected", () => {
  assert.throws(
    () => validateScheduleJob({
      fixtureId: "17952170",
      competitionId: 430,
      startEpochDay: 20608,
      surprise: true
    }),
    SchedulePlanError
  );
});

test("non-object job input is rejected", () => {
  assert.throws(() => validateScheduleJob(null), SchedulePlanError);
  assert.throws(() => validateScheduleJob("nope"), SchedulePlanError);
});
