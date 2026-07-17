export type AutomaticWorkerRuntime = {
  runCycle: () => Promise<unknown>;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  heartbeat?: () => Promise<void>;
};

export type AutomaticWorkerOptions = {
  intervalMs?: number;
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
  try {
    const result = await runtime.runCycle();
    options.onCycle?.(result);
    return { status: "ok" as const, result };
  } catch (error) {
    options.onError?.(error);
    return { status: "error" as const };
  } finally {
    await runtime.releaseLock();
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
