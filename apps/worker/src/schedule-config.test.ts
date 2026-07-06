import assert from "node:assert/strict";
import test from "node:test";
import {
  isScheduleInvocation,
  parseScheduleConfig,
  ScheduleConfigError
} from "./schedule-config.js";

test("schedule mode is disabled by default when no schedule token is present", () => {
  assert.equal(isScheduleInvocation([]), false);
  assert.equal(isScheduleInvocation(["--fixtureId", "17952170"]), false);
});

test("schedule invocation is detected via positional subcommand", () => {
  assert.equal(isScheduleInvocation(["schedule", "--dry-run"]), true);
});

test("schedule invocation is detected via --schedule flag", () => {
  assert.equal(isScheduleInvocation(["--schedule", "--dry-run"]), true);
});

test("schedule dry-run config is disabled-by-default safe", () => {
  const config = parseScheduleConfig(["schedule", "--dry-run"]);

  assert.equal(config.mode, "schedule-dry-run");
  assert.equal(config.schedulerEnabled, false);
  assert.equal(config.loopEnabled, false);
  assert.equal(config.cronEnabled, false);
  assert.equal(config.redisEnabled, false);
  assert.equal(config.queueEnabled, false);
  assert.equal(config.dbWriteEnabled, false);
  assert.equal(config.txlineCallEnabled, false);
  assert.equal(config.cycleCount, 1);
  assert.match(config.runId, /^schedule-run-\d+$/);
});

test("schedule execute is rejected in this phase", () => {
  assert.throws(
    () => parseScheduleConfig(["schedule", "--execute"]),
    (error: unknown) => {
      assert.ok(error instanceof ScheduleConfigError);
      assert.match((error as Error).message, /scheduled execute mode is not enabled in this phase/i);
      return true;
    }
  );
});

test("schedule execute with confirmation is rejected in this phase", () => {
  assert.throws(
    () => parseScheduleConfig(["schedule", "--confirm-db-write"]),
    ScheduleConfigError
  );
});

test("schedule loop/interval is rejected in this phase", () => {
  for (const flag of ["--loop", "--interval", "--watch", "--daemon"]) {
    assert.throws(
      () => parseScheduleConfig(["schedule", flag]),
      ScheduleConfigError
    );
  }
});

test("schedule cron is rejected in this phase", () => {
  assert.throws(
    () => parseScheduleConfig(["schedule", "--cron"]),
    ScheduleConfigError
  );
});

test("schedule redis/queue backends are rejected in this phase", () => {
  for (const flag of ["--redis", "--queue", "--bullmq", "--upstash"]) {
    assert.throws(
      () => parseScheduleConfig(["schedule", flag]),
      ScheduleConfigError
    );
  }
});

test("schedule invocation without an explicit subcommand token is rejected", () => {
  assert.throws(
    () => parseScheduleConfig(["--dry-run"]),
    ScheduleConfigError
  );
});

test("schedule runId is sanitized", () => {
  const config = parseScheduleConfig([
    "schedule",
    "--dry-run",
    "--runId", "  PROD DATABASE_URL / Wallet Secret  "
  ]);

  assert.equal(config.runId, "prod-database-url-wallet-secret");
});

test("schedule runId rejects fully unsafe values", () => {
  assert.throws(
    () => parseScheduleConfig(["schedule", "--dry-run", "--runId", " !!! "]),
    ScheduleConfigError
  );
});
