import assert from "node:assert/strict";
import test from "node:test";
import { runAutomaticWorkerOnce } from "./automatic-worker.js";

test("worker singleton skips a concurrent cycle", async () => {
  let runs = 0;
  const result = await runAutomaticWorkerOnce({ acquireLock: async () => false, releaseLock: async () => undefined, runCycle: async () => { runs += 1; } });
  assert.equal(result.status, "lock_not_acquired");
  assert.equal(runs, 0);
});

test("worker releases advisory lock after a failed cycle", async () => {
  let released = false;
  const result = await runAutomaticWorkerOnce({ acquireLock: async () => true, releaseLock: async () => { released = true; }, runCycle: async () => { throw new Error("temporary"); } });
  assert.equal(result.status, "error");
  assert.equal(released, true);
});
