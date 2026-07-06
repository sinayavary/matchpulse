import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkerConfigError,
  parseWorkerConfig
} from "./worker-config.js";
import { createWorkerOutputEnvelope } from "./worker-safety.js";

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
  assert.equal(config.confirmDbWrite, false);
  assert.match(config.runId, /^worker-run-\d+$/);
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

test("dry-run remains default when no mode flag is provided", () => {
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608"
  ]);

  assert.equal(config.mode, "dry-run");
  assert.equal(config.dryRun, true);
  assert.equal(config.execute, false);
});

test("execute without confirmation is rejected", () => {
  assert.throws(
    () => parseWorkerConfig([
      "--fixtureId", "17952170",
      "--competitionId", "430",
      "--startEpochDay", "20608",
      "--execute"
    ]),
    /execute mode requires --confirm-db-write/i
  );
});

test("execute with confirmation is accepted", () => {
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608",
    "--execute",
    "--confirm-db-write"
  ]);

  assert.equal(config.mode, "execute");
  assert.equal(config.execute, true);
  assert.equal(config.confirmDbWrite, true);
});

test("run id is sanitized to a safe value", () => {
  const config = parseWorkerConfig([
    ...validArgs,
    "--runId", "  PROD DATABASE_URL / Wallet Secret  "
  ]);

  assert.equal(config.runId, "prod-database-url-wallet-secret");
});

test("run id rejects fully unsafe values", () => {
  assert.throws(
    () => parseWorkerConfig([
      ...validArgs,
      "--runId", " !!! "
    ]),
    /runId must contain at least one safe alphanumeric character/i
  );
});

test("multiple fixture ids are rejected", () => {
  assert.throws(
    () => parseWorkerConfig([
      "--fixtureId", "17952170",
      "--fixtureId", "17952171",
      "--competitionId", "430",
      "--startEpochDay", "20608"
    ]),
    /fixtureId does not support multiple values/i
  );
});

test("safe worker output envelope includes required dry-run fields", () => {
  const config = parseWorkerConfig([...validArgs, "--asOf", "2026-07-06T10:00:00.000Z"]);
  const envelope = createWorkerOutputEnvelope(config);

  assert.equal(envelope.worker_version, "worker-v0");
  assert.equal(envelope.mode, "dry-run");
  assert.equal(envelope.plan.fixtureId, "17952170");
  assert.equal(envelope.plan.asOf, "2026-07-06T10:00:00.000Z");
  assert.equal(envelope.safety.db_write_enabled, false);
  assert.equal(envelope.safety.txline_call_enabled, false);
  assert.equal(envelope.safety.scheduler_enabled, false);
});

test("worker config does not enable scheduler or loop by default", () => {
  const config = parseWorkerConfig(validArgs);

  assert.equal(config.schedulerEnabled, false);
  assert.equal(config.loopEnabled, false);
});
