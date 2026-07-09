import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductRuntimeRefreshWorker,
  normalizeProductRuntimeRefreshConfig,
} from "./product-runtime-refresh-worker.js";
import type { TargetIngestionCycleSummary } from "./ingestion-runner.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeTimerHarness() {
  type TimerEntry = {
    id: number;
    callback: () => void;
  };

  let nextId = 1;
  const timers: TimerEntry[] = [];

  const setTimeoutFn: typeof setTimeout = ((callback: (...args: any[]) => void, _ms?: number) => {
    const id = nextId++;
    timers.push({
      id,
      callback: () => callback()
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  const clearTimeoutFn: typeof clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
    const index = timers.findIndex((timer) => timer.id === Number(handle));
    if (index >= 0) timers.splice(index, 1);
  }) as typeof clearTimeout;

  return {
    timers,
    setTimeoutFn,
    clearTimeoutFn,
    fireNextTimer() {
      const timer = timers.shift();
      if (timer === undefined) {
        throw new Error("expected a scheduled timer");
      }
      timer.callback();
    }
  };
}

function createLogger() {
  const calls: Array<{ level: "info" | "warn" | "error"; obj: Record<string, unknown>; msg?: string }> = [];
  return {
    calls,
    logger: {
      info(obj: Record<string, unknown>, msg?: string) {
        calls.push({ level: "info", obj, msg });
      },
      warn(obj: Record<string, unknown>, msg?: string) {
        calls.push({ level: "warn", obj, msg });
      },
      error(obj: Record<string, unknown>, msg?: string) {
        calls.push({ level: "error", obj, msg });
      }
    }
  };
}

test("env normalization defaults to disabled", () => {
  assert.deepEqual(normalizeProductRuntimeRefreshConfig({}), {
    enabled: false,
    intervalMs: 60_000,
    runOnStart: false
  });
});

test("interval clamps to the configured minimum and maximum", () => {
  assert.equal(
    normalizeProductRuntimeRefreshConfig({
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: 1
    }).intervalMs,
    15_000
  );
  assert.equal(
    normalizeProductRuntimeRefreshConfig({
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: 9_999_999
    }).intervalMs,
    3_600_000
  );
});

test("worker runs once on start when enabled and runOnStart is true", async () => {
  let calls = 0;
  const logger = createLogger();
  const worker = createProductRuntimeRefreshWorker({
    env: {
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: "15000"
    },
    runner: async () => {
      calls += 1;
      return {
        status: "ok",
        started_at: "2026-07-09T00:00:00.000Z",
        finished_at: "2026-07-09T00:00:01.000Z",
        targets: {
          fixtures: { attempted: true, status: "ok", count: 1 },
          scores: { attempted: true, status: "ok", count: 1 },
          odds: { attempted: true, status: "ok", count: 1 },
          events: { attempted: false, status: "skipped", count: 0 }
        },
        safe_scope_note: "safe"
      };
    },
    logger: logger.logger,
    setTimeoutFn: setTimeout,
    clearTimeoutFn: clearTimeout
  });

  await worker.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 1);
  assert.equal(worker.isStarted(), true);
  assert.equal(worker.isRunning(), false);
  assert.equal(logger.calls.filter((call) => call.level === "info").length >= 1, true);

  await worker.stop();
});

test("worker does not overlap cycles", async () => {
  const timers = createFakeTimerHarness();
  let calls = 0;
  const deferred = createDeferred<void>();
  const worker = createProductRuntimeRefreshWorker({
    env: {
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: "15000",
      MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START: "false"
    },
    runner: async () => {
      calls += 1;
      await deferred.promise;
      return {
        status: "ok",
        started_at: "2026-07-09T00:00:00.000Z",
        finished_at: "2026-07-09T00:00:01.000Z",
        targets: {
          fixtures: { attempted: true, status: "ok", count: 1 },
          scores: { attempted: true, status: "ok", count: 1 },
          odds: { attempted: true, status: "ok", count: 1 },
          events: { attempted: false, status: "skipped", count: 0 }
        },
        safe_scope_note: "safe"
      };
    },
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn
  });

  await worker.start();
  assert.equal(timers.timers.length, 1);

  const firstTimer = timers.timers.shift();
  if (firstTimer === undefined) {
    throw new Error("expected a scheduled timer");
  }
  const firstTimerCallback = firstTimer.callback;
  firstTimerCallback();
  await Promise.resolve();
  firstTimerCallback();
  await Promise.resolve();

  assert.equal(calls, 1);
  assert.equal(worker.isRunning(), true);

  deferred.resolve();
  await worker.stop();
  assert.equal(worker.isRunning(), false);
  assert.equal(timers.timers.length, 0);
});

test("worker stops cleanly", async () => {
  const timers = createFakeTimerHarness();
  const deferred = createDeferred<TargetIngestionCycleSummary>();
  let calls = 0;
  const worker = createProductRuntimeRefreshWorker({
    env: {
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: "15000",
      MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START: "true"
    },
    runner: async () => {
      calls += 1;
      return await deferred.promise;
    },
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn
  });

  await worker.start();
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(worker.isRunning(), true);

  const stopPromise = worker.stop();
  deferred.resolve({
    status: "ok",
    started_at: "2026-07-09T00:00:00.000Z",
    targets: {
      fixtures: { attempted: true, status: "ok", count: 1 },
      scores: { attempted: true, status: "ok", count: 1 },
      odds: { attempted: true, status: "ok", count: 1 },
      events: { attempted: false, status: "skipped", count: 0 }
    },
    finished_at: "2026-07-09T00:00:01.000Z",
    safe_scope_note: "safe"
  });
  await stopPromise;

  assert.equal(worker.isStarted(), false);
  assert.equal(worker.isRunning(), false);
  assert.equal(timers.timers.length, 0);
});

test("sanitized log excludes raw payloads and secrets", async () => {
  const logger = createLogger();
  const worker = createProductRuntimeRefreshWorker({
    env: {
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START: "true",
      MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS: "15000"
    },
    runner: async () => ({
      status: "partial",
      started_at: "2026-07-09T00:00:00.000Z",
      finished_at: "2026-07-09T00:00:01.000Z",
      targets: {
        fixtures: { attempted: true, status: "ok", count: 1 },
        scores: { attempted: true, status: "partial", count: 1 },
        odds: { attempted: true, status: "failed" },
        events: { attempted: false, status: "skipped" }
      },
      safe_scope_note: "safe",
      raw_payload: "must-not-escape",
      api_secret: "must-not-escape"
    } as never),
    logger: logger.logger
  });

  await worker.start();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  const serialized = JSON.stringify(logger.calls);
  assert.equal(serialized.includes("must-not-escape"), false);
  assert.equal(serialized.includes("raw_payload"), false);
  assert.equal(serialized.includes("api_secret"), false);
});

test("no real TxLINE call is made in worker tests", async () => {
  let calls = 0;
  const worker = createProductRuntimeRefreshWorker({
    env: {
      MATCHPULSE_RUNTIME_REFRESH_ENABLED: "true",
      MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START: "true"
    },
    runner: async () => {
      calls += 1;
      return {
        status: "ok",
        started_at: "2026-07-09T00:00:00.000Z",
        finished_at: "2026-07-09T00:00:01.000Z",
        targets: {
        fixtures: { attempted: true, status: "ok", count: 1 },
        scores: { attempted: true, status: "ok", count: 1 },
        odds: { attempted: true, status: "ok", count: 1 },
        events: { attempted: false, status: "skipped", count: 0 }
        },
        safe_scope_note: "safe"
      };
    }
  });

  await worker.start();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  assert.equal(calls, 1);
});
