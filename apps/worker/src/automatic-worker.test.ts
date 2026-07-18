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

test("worker reports safe acquisition failures and keeps the loop recoverable", async () => {
  let reported = false;
  const result = await runAutomaticWorkerOnce({ acquireLock: async () => { throw new Error("DATABASE_URL=secret"); }, releaseLock: async () => undefined, runCycle: async () => undefined }, { onError: () => { reported = true; } });
  assert.equal(result.status, "error");
  assert.equal(reported, true);
});

test("worker renews its lease during a long cycle", async () => {
  let heartbeats = 0;
  const result = await runAutomaticWorkerOnce({
    acquireLock: async () => true,
    releaseLock: async () => undefined,
    heartbeat: async () => { heartbeats += 1; },
    runCycle: async () => new Promise((resolve) => setTimeout(() => resolve("done"), 35))
  }, { heartbeatIntervalMs: 10 });
  assert.equal(result.status, "ok");
  assert.ok(heartbeats >= 2);
});

test("lost heartbeat fails the cycle safely and releases the lock", async () => {
  let released = false;
  const result = await runAutomaticWorkerOnce({
    acquireLock: async () => true,
    releaseLock: async () => { released = true; },
    heartbeat: async () => { throw new Error("lease lost"); },
    runCycle: async () => new Promise((resolve) => setTimeout(resolve, 50))
  }, { heartbeatIntervalMs: 5 });
  assert.equal(result.status, "error");
  assert.equal(released, true);
});
