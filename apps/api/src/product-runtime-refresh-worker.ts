import { runTargetIngestionCycle } from "./ingestion-runner.js";
import { runBackgroundIntelligenceCycle } from "./background-intelligence-runtime.js";

export type ProductRuntimeRefreshWorkerEnv = {
  MATCHPULSE_RUNTIME_REFRESH_ENABLED?: unknown;
  MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS?: unknown;
  MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START?: unknown;
};

export type ProductRuntimeRefreshWorkerConfig = {
  enabled: boolean;
  intervalMs: number;
  runOnStart: boolean;
};

export type ProductRuntimeRefreshWorkerRunner = (
  input?: Parameters<typeof runTargetIngestionCycle>[0]
) => Promise<Awaited<ReturnType<typeof runTargetIngestionCycle>>>;

export type ProductRuntimeRefreshWorkerLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
};

export type ProductRuntimeRefreshWorkerOptions = {
  env?: ProductRuntimeRefreshWorkerEnv;
  runner?: ProductRuntimeRefreshWorkerRunner;
  logger?: ProductRuntimeRefreshWorkerLogger;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  predictionRunner?: () => Promise<unknown>;
};

export type ProductRuntimeRefreshWorkerSummary = {
  status: "ok" | "partial" | "failed";
  targets: {
    fixtures: { status: string; count?: number };
    scores: { status: string; count?: number };
    odds: { status: string; count?: number };
    events: { status: string; count?: number };
  };
  finished_at: string;
};

export type ProductRuntimeRefreshWorker = {
  readonly config: ProductRuntimeRefreshWorkerConfig;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  isStarted: () => boolean;
};

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;
const MAX_INTERVAL_MS = 3_600_000;

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function readInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

export function normalizeProductRuntimeRefreshConfig(
  env: ProductRuntimeRefreshWorkerEnv = process.env
): ProductRuntimeRefreshWorkerConfig {
  const enabled = readBoolean(env.MATCHPULSE_RUNTIME_REFRESH_ENABLED, false);
  const runOnStart = readBoolean(env.MATCHPULSE_RUNTIME_REFRESH_RUN_ON_START, false);
  const intervalMs = Math.min(
    MAX_INTERVAL_MS,
    Math.max(
      MIN_INTERVAL_MS,
      readInteger(env.MATCHPULSE_RUNTIME_REFRESH_INTERVAL_MS, DEFAULT_INTERVAL_MS)
    )
  );

  return {
    enabled,
    intervalMs,
    runOnStart
  };
}

function buildSummary(summary: Awaited<ReturnType<typeof runTargetIngestionCycle>>): ProductRuntimeRefreshWorkerSummary {
  return {
    status: summary.status,
    targets: {
      fixtures: {
        status: summary.targets.fixtures.status,
        ...(typeof summary.targets.fixtures.count === "number"
          ? { count: summary.targets.fixtures.count }
          : {})
      },
      scores: {
        status: summary.targets.scores.status,
        ...(typeof summary.targets.scores.count === "number"
          ? { count: summary.targets.scores.count }
          : {})
      },
      odds: {
        status: summary.targets.odds.status,
        ...(typeof summary.targets.odds.count === "number"
          ? { count: summary.targets.odds.count }
          : {})
      },
      events: {
        status: summary.targets.events.status,
        ...(typeof summary.targets.events.count === "number"
          ? { count: summary.targets.events.count }
          : {})
      }
    },
    finished_at: summary.finished_at
  };
}

function buildFailedSummary(): ProductRuntimeRefreshWorkerSummary {
  return {
    status: "failed",
    targets: {
      fixtures: { status: "failed" },
      scores: { status: "failed" },
      odds: { status: "failed" },
      events: { status: "failed" }
    },
    finished_at: new Date().toISOString()
  };
}

export function createProductRuntimeRefreshWorker(
  options: ProductRuntimeRefreshWorkerOptions = {}
): ProductRuntimeRefreshWorker {
  const config = normalizeProductRuntimeRefreshConfig(options.env);
  const runner = options.runner ?? runTargetIngestionCycle;
  const logger = options.logger ?? console;
  const setTimeoutImpl = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutFn ?? clearTimeout;
  const predictionRunner = options.predictionRunner ?? (
    process.env.MATCHPULSE_AGENT_ENABLED === "true"
      ? () => runBackgroundIntelligenceCycle()
      : undefined
  );

  let started = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let currentCycle: Promise<void> | null = null;

  const scheduleNext = () => {
    if (!started || stopped) return;
    timer = setTimeoutImpl(() => {
      timer = null;
      void executeCycle();
    }, config.intervalMs);
  };

  const logSummary = (summary: ProductRuntimeRefreshWorkerSummary) => {
    logger.info(summary, "Product runtime refresh cycle");
  };

  const executeCycle = async () => {
    if (!started || stopped) return;
    if (currentCycle !== null) return currentCycle;

    currentCycle = (async () => {
      try {
        const summary = buildSummary(await runner({}));
        logSummary(summary);
        if (predictionRunner !== undefined) {
          try { await predictionRunner(); }
          catch { logger.error({ status: "failed" }, "Prediction runtime cycle failed"); }
        }
      } catch {
        const summary = buildFailedSummary();
        logSummary(summary);
        logger.error(summary, "Product runtime refresh cycle failed");
      }
    })();

    try {
      await currentCycle;
    } finally {
      currentCycle = null;
      if (!stopped) scheduleNext();
    }
  };

  return {
    config,
    async start() {
      if (!config.enabled || started) return;
      started = true;
      stopped = false;

      if (config.runOnStart) {
        void executeCycle();
        return;
      }

      scheduleNext();
    },
    async stop() {
      stopped = true;
      started = false;
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
      if (currentCycle !== null) {
        await currentCycle;
      }
    },
    isRunning() {
      return currentCycle !== null;
    },
    isStarted() {
      return started;
    }
  };
}
