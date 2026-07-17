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
  const locked = await runtime.acquireLock();
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
  const intervalMs = options.intervalMs ?? Number(process.env.MATCHPULSE_UPCOMING_POLL_INTERVAL_MS ?? 300000);
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let stopped = false;
  const stop = () => { stopped = true; };
  while (!stopped) {
    await runAutomaticWorkerOnce(runtime, options);
    if (!stopped) await sleep(intervalMs);
  }
  return stop;
}
