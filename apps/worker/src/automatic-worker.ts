export type AutomaticWorkerRuntime = {
  runCycle: () => Promise<unknown>;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  heartbeat?: () => Promise<void>;
};

export type AutomaticWorkerOptions = {
  intervalMs?: number;
  heartbeatIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onCycle?: (result: unknown) => void;
  onError?: (error: unknown) => void;
};

export async function runAutomaticWorkerOnce(runtime: AutomaticWorkerRuntime, options: AutomaticWorkerOptions = {}) {
  let locked = false;
  try {
    locked = await runtime.acquireLock();
  } catch (error) {
    options.onError?.(error);
    return { status: "error" as const };
  }
  if (!locked) return { status: "lock_not_acquired" as const };
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let rejectHeartbeat: ((error: unknown) => void) | undefined;
  const heartbeatFailure = new Promise<never>((_resolve, reject) => { rejectHeartbeat = reject; });
  if (runtime.heartbeat) {
    try {
      await runtime.heartbeat();
    } catch (error) {
      options.onError?.(error);
      try { await runtime.releaseLock(); } catch (releaseError) { options.onError?.(releaseError); }
      return { status: "error" as const };
    }
    heartbeatTimer = setInterval(() => {
      void runtime.heartbeat!().catch((error) => rejectHeartbeat?.(error));
    }, options.heartbeatIntervalMs ?? 30_000);
  }
  try {
    const result = await (runtime.heartbeat
      ? Promise.race([runtime.runCycle(), heartbeatFailure])
      : runtime.runCycle());
    options.onCycle?.(result);
    return { status: "ok" as const, result };
  } catch (error) {
    options.onError?.(error);
    return { status: "error" as const };
  } finally {
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    try { await runtime.releaseLock(); } catch (error) { options.onError?.(error); }
  }
}

export async function runAutomaticWorkerLoop(runtime: AutomaticWorkerRuntime, options: AutomaticWorkerOptions = {}) {
  const intervalMs = options.intervalMs ?? Number(process.env.MATCHPULSE_FIXTURE_DISCOVERY_INTERVAL_MS ?? 300000);
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let stopped = false;
  const stop = () => { stopped = true; };
  while (!stopped) {
    const result = await runAutomaticWorkerOnce(runtime, options);
    const nextWakeMs = typeof result.result === "object" && result.result !== null && "nextWakeMs" in result.result && typeof result.result.nextWakeMs === "number" ? result.result.nextWakeMs : intervalMs;
    if (!stopped) await sleep(Math.max(5_000, nextWakeMs));
  }
  return stop;
}
