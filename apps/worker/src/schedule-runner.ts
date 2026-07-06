import { type ScheduleConfig } from "./schedule-config.js";
import {
  buildStaticSchedulePlan,
  type ScheduleJob
} from "./schedule-plan.js";

export class ScheduleRunnerError extends TypeError {}

export type ScheduleSafetyBlock = {
  db_write_enabled: false;
  txline_call_enabled: false;
  scheduler_enabled: false;
  redis_enabled: false;
  queue_enabled: false;
};

export type ScheduleJobView = {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
};

export type ScheduleOutputEnvelope = {
  worker_version: "worker-v0";
  mode: "schedule-dry-run";
  scheduler_enabled: false;
  cycle_count: 1;
  run_id: string;
  jobs: ScheduleJobView[];
  safety: ScheduleSafetyBlock;
};

const SECRET_LIKE_PATTERNS = [
  "databaseurl",
  "directurl",
  "jwt",
  "token",
  "apikey",
  "secret",
  "privatekey",
  "wallet",
  "password",
  "connectionstring",
  "bearer",
  "authorization"
] as const;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasScheduleForbiddenOutputKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasScheduleForbiddenOutputKeys(item));
  if (typeof value !== "object" || value === null) return false;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeKey(key);
    if (SECRET_LIKE_PATTERNS.some((pattern) => normalizedKey.includes(normalizeKey(pattern)))) {
      return true;
    }
    if (hasScheduleForbiddenOutputKeys(child)) return true;
  }
  return false;
}

export function assertSafeScheduleOutput(value: unknown): void {
  if (hasScheduleForbiddenOutputKeys(value)) {
    throw new ScheduleRunnerError("Schedule output contains forbidden secret-like keys.");
  }
}

function toJobView(job: ScheduleJob): ScheduleJobView {
  return {
    fixtureId: job.fixtureId,
    competitionId: job.competitionId,
    startEpochDay: job.startEpochDay,
    includeFixture: job.includeFixture,
    includeScore: job.includeScore,
    includeOdds: job.includeOdds,
    oddsLimit: job.oddsLimit
  };
}

/**
 * Builds the safe one-cycle dry-run schedule envelope.
 *
 * This never calls the ingestion runner, never calls TxLINE, never writes the
 * DB, and never starts a loop. It only prints a safe static plan.
 */
export function runScheduleDryRun(
  config: ScheduleConfig,
  options: { jobs?: readonly ScheduleJob[] } = {}
): ScheduleOutputEnvelope {
  if (config.schedulerEnabled) {
    throw new ScheduleRunnerError("scheduler must remain disabled in this phase.");
  }
  if (config.dbWriteEnabled || config.txlineCallEnabled) {
    throw new ScheduleRunnerError("schedule execute is not enabled in this phase.");
  }

  const jobs = buildStaticSchedulePlan(options.jobs).map(toJobView);

  const envelope: ScheduleOutputEnvelope = {
    worker_version: "worker-v0",
    mode: "schedule-dry-run",
    scheduler_enabled: false,
    cycle_count: 1,
    run_id: config.runId,
    jobs,
    safety: {
      db_write_enabled: false,
      txline_call_enabled: false,
      scheduler_enabled: false,
      redis_enabled: false,
      queue_enabled: false
    }
  };

  assertSafeScheduleOutput(envelope);
  return envelope;
}
