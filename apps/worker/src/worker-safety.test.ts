import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkerConfig } from "./worker-config.js";
import {
  WorkerSafetyError,
  assertSafeWorkerOutput,
  createWorkerOutputEnvelope,
  hasForbiddenOutputKeys
} from "./worker-safety.js";

test("output redaction check catches secret-like keys", () => {
  assert.equal(hasForbiddenOutputKeys({ connectionString: "postgres://example" }), true);
});

test("output redaction check is case-insensitive", () => {
  assert.equal(hasForbiddenOutputKeys({ Authorization: "Bearer abc" }), true);
});

test("safe worker output passes redaction guard", () => {
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608",
    "--dry-run"
  ]);

  const envelope = createWorkerOutputEnvelope(config);
  assert.doesNotThrow(() => assertSafeWorkerOutput(envelope));
});

test("redaction guard throws on forbidden keys", () => {
  assert.throws(
    () => assertSafeWorkerOutput({ nested: { PRIVATE_KEY: "value" } }),
    WorkerSafetyError
  );
});
