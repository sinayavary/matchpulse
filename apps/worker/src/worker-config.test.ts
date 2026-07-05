import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkerConfigError,
  formatWorkerPlan,
  hasForbiddenPlanKeys,
  parseWorkerConfig
} from "./worker-config.js";

const validArgs = [
  "--fixtureId", "17952170",
  "--competitionId", "430",
  "--startEpochDay", "20608",
  "--dry-run"
];

test("CLI/config parser accepts valid dry-run input", () => {
  const config = parseWorkerConfig(validArgs);

  assert.equal(config.fixtureId, "17952170");
  assert.equal(config.competitionId, 430);
  assert.equal(config.startEpochDay, 20608);
  assert.equal(config.mode, "dry-run");
  assert.equal(config.dryRun, true);
  assert.equal(config.execute, false);
});

test("CLI/config parser rejects missing fixtureId", () => {
  assert.throws(
    () => parseWorkerConfig(["--competitionId", "430", "--startEpochDay", "20608"]),
    WorkerConfigError
  );
});

test("CLI/config parser rejects invalid competitionId", () => {
  assert.throws(
    () => parseWorkerConfig(["--fixtureId", "17952170", "--competitionId", "-1", "--startEpochDay", "20608"]),
    WorkerConfigError
  );
});

test("CLI/config parser rejects invalid startEpochDay", () => {
  assert.throws(
    () => parseWorkerConfig(["--fixtureId", "17952170", "--competitionId", "430", "--startEpochDay", "NaN"]),
    WorkerConfigError
  );
});

test("oddsLimit defaults to 20", () => {
  const config = parseWorkerConfig(validArgs);
  assert.equal(config.oddsLimit, 20);
});

test("oddsLimit caps at 50", () => {
  const config = parseWorkerConfig([...validArgs, "--oddsLimit", "500"]);
  assert.equal(config.oddsLimit, 50);
});

test("safe plan output does not include forbidden secret-like keys", () => {
  const config = parseWorkerConfig([...validArgs, "--asOf", "2026-07-06T10:00:00.000Z"]);
  const plan = JSON.parse(formatWorkerPlan(config)) as Record<string, unknown>;

  assert.equal(hasForbiddenPlanKeys(plan), false);
  assert.deepEqual(Object.keys(plan).sort(), [
    "asOf",
    "competitionId",
    "fixtureId",
    "includeFixture",
    "includeOdds",
    "includeScore",
    "mode",
    "oddsLimit",
    "startEpochDay"
  ]);
});

test("worker config does not enable scheduler or loop by default", () => {
  const config = parseWorkerConfig(validArgs);

  assert.equal(config.schedulerEnabled, false);
  assert.equal(config.loopEnabled, false);
});
