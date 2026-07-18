import { parseWorkerConfig, WorkerConfigError } from "./worker-config.js";
import { runWorker } from "./worker-runner.js";
import { createWorkerOutputEnvelope } from "./worker-safety.js";
import {
  isScheduleInvocation,
  parseScheduleConfig,
  ScheduleConfigError
} from "./schedule-config.js";
import {
  runScheduleDryRun,
  runScheduleExecute,
  ScheduleRunnerError
} from "./schedule-runner.js";
import { runAutomaticWorkerLoop } from "./automatic-worker.js";

async function runAutomaticMode() {
  const runtimePath = process.env.MATCHPULSE_API_RUNTIME_PATH ?? "../../api/src/automatic-data-runtime.js";
  const apiModule = await import(runtimePath) as {
    runAutomaticIngestionCycle: () => Promise<unknown>;
    tryAcquireWorkerLock: () => Promise<boolean>;
    heartbeatWorkerLock: () => Promise<void>;
    releaseWorkerLock: () => Promise<void>;
    tryAcquireManagedWorkerLock: (serviceName: "matchpulse-intelligence-worker" | "matchpulse-evaluation-worker") => Promise<boolean>;
    heartbeatManagedWorkerLock: (serviceName: "matchpulse-intelligence-worker" | "matchpulse-evaluation-worker") => Promise<void>;
    releaseManagedWorkerLock: (serviceName: "matchpulse-intelligence-worker" | "matchpulse-evaluation-worker") => Promise<void>;
  };
  const reportError = (loop: string) => (error: unknown) => {
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const name = typeof record.name === "string" ? record.name.slice(0, 80) : "Error";
    const code = typeof record.code === "string" ? record.code.slice(0, 80) : "UNKNOWN";
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "automatic_worker_cycle_failed", loop, error: { name, code, message: message.replace(/(https?:\/\/|postgres(?:ql)?:\/\/|bearer\s+|token|jwt|password|database_url)[^\s]*/gi, "[redacted]").slice(0, 240) } }));
  };
  const loops: Array<Promise<unknown>> = [];
  if (process.env.MATCHPULSE_DATA_WORKER_ENABLED === "true") {
    loops.push(runAutomaticWorkerLoop({ runCycle: apiModule.runAutomaticIngestionCycle, acquireLock: apiModule.tryAcquireWorkerLock, heartbeat: apiModule.heartbeatWorkerLock, releaseLock: apiModule.releaseWorkerLock }, { onError: reportError("ingestion") }));
  }
  if (process.env.MATCHPULSE_AGENT_WORKER_ENABLED === "true") {
    const intelligencePath = process.env.MATCHPULSE_INTELLIGENCE_RUNTIME_PATH ?? "../../api/src/background-intelligence-runtime.js";
    const intelligence = await import(intelligencePath) as { runManagedBackgroundIntelligenceCycle: () => Promise<unknown> };
    const service = "matchpulse-intelligence-worker" as const;
    loops.push(runAutomaticWorkerLoop({ runCycle: intelligence.runManagedBackgroundIntelligenceCycle, acquireLock: () => apiModule.tryAcquireManagedWorkerLock(service), heartbeat: () => apiModule.heartbeatManagedWorkerLock(service), releaseLock: () => apiModule.releaseManagedWorkerLock(service) }, { intervalMs: Number(process.env.MATCHPULSE_AGENT_INTERVAL_MS ?? 60_000), onError: reportError("intelligence") }));
  }
  if (process.env.MATCHPULSE_EVALUATION_WORKER_ENABLED === "true") {
    const evaluationPath = process.env.MATCHPULSE_EVALUATION_RUNTIME_PATH ?? "../../api/src/evaluation-learning-runtime.js";
    const evaluation = await import(evaluationPath) as { runManagedEvaluationWorkerCycle: () => Promise<unknown> };
    const service = "matchpulse-evaluation-worker" as const;
    loops.push(runAutomaticWorkerLoop({ runCycle: evaluation.runManagedEvaluationWorkerCycle, acquireLock: () => apiModule.tryAcquireManagedWorkerLock(service), heartbeat: () => apiModule.heartbeatManagedWorkerLock(service), releaseLock: () => apiModule.releaseManagedWorkerLock(service) }, { intervalMs: Number(process.env.MATCHPULSE_EVALUATION_INTERVAL_MS ?? 300_000), onError: reportError("evaluation") }));
  }
  await Promise.all(loops);
}

function readFlag(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const value = args.find((item) => item.startsWith(prefix));
  return value === undefined ? undefined : value.slice(prefix.length);
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function runMatchesCatalogReconcile(args: string[]) {
  const runtimePath = process.env.MATCHPULSE_API_RUNTIME_PATH ?? "../../api/src/automatic-data-runtime.js";
  const apiModule = await import(runtimePath) as {
    runMatchesCatalogReconciliation: (options: Record<string, unknown>) => Promise<unknown>;
  };
  const parseDate = (name: string): Date | undefined => {
    const value = readFlag(args, name);
    if (value === undefined) return undefined;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${name} value.`);
    return date;
  };
  const batchSizeValue = readFlag(args, "--batch-size");
  const maxBatchesValue = readFlag(args, "--max-batches");
  const output = await apiModule.runMatchesCatalogReconciliation({
    dryRun: !hasFlag(args, "--apply"),
    competition: readFlag(args, "--competition"),
    from: parseDate("--from"),
    to: parseDate("--to"),
    batchSize: batchSizeValue === undefined ? undefined : Number(batchSizeValue),
    cursor: readFlag(args, "--cursor"),
    resume: hasFlag(args, "--resume"),
    maxBatches: maxBatchesValue === undefined ? undefined : Number(maxBatchesValue)
  });
  console.log(JSON.stringify(output, null, 2));
}

async function executeIngestion(input: {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  asOf?: string;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
}) {
  const ingestionRunnerModulePath = "../../api/src/ingestion-runner.js";
  const apiModule = await import(ingestionRunnerModulePath) as {
    runFixtureIngestionPipeline: (payload: typeof input) => Promise<{
      data?: { run_id?: string | null };
      meta?: { status?: string | null };
    }>;
  };
  return apiModule.runFixtureIngestionPipeline(input);
}

async function runSchedule(args: string[]) {
  try {
    const config = parseScheduleConfig(args);
    const output = config.execute
      ? await runScheduleExecute(config, { executeIngestion })
      : runScheduleDryRun(config);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (error instanceof ScheduleConfigError || error instanceof ScheduleRunnerError) {
      console.error(`Schedule error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("Schedule execution failed.");
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "matches-catalog-reconcile") {
    try { await runMatchesCatalogReconcile(args.slice(1)); }
    catch (error) {
      console.error(error instanceof Error ? error.message : "Reconciliation failed.");
      process.exitCode = 1;
    }
    return;
  }

  if ([process.env.MATCHPULSE_DATA_WORKER_ENABLED, process.env.MATCHPULSE_AGENT_WORKER_ENABLED, process.env.MATCHPULSE_EVALUATION_WORKER_ENABLED].includes("true") && args.length === 0) {
    try { await runAutomaticMode(); } catch { process.exitCode = 1; }
    return;
  }

  if (isScheduleInvocation(args)) {
    await runSchedule(args);
    return;
  }

  try {
    const config = parseWorkerConfig(args);
    try {
      const outcome = await runWorker(config, { executeIngestion });
      console.log(JSON.stringify(outcome.output, null, 2));
    } catch {
      console.error(JSON.stringify(
        createWorkerOutputEnvelope(config, {
          error: {
            message: "Worker execution failed."
          }
        }),
        null,
        2
      ));
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof WorkerConfigError) {
      console.error(`Worker configuration error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("Worker execution failed.");
    process.exitCode = 1;
  }
}

void main();
