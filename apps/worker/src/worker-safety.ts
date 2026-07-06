import { type WorkerConfig, toWorkerPlan } from "./worker-config.js";

const SECRET_LIKE_PATTERNS = [
  "database_url",
  "direct_url",
  "jwt",
  "token",
  "api_key",
  "secret",
  "private_key",
  "wallet",
  "password",
  "connectionstring",
  "bearer",
  "authorization"
] as const;

export class WorkerSafetyError extends TypeError {}

export type WorkerOutputEnvelope = {
  worker_version: "worker-v0";
  mode: "dry-run" | "execute";
  run_id: string;
  plan: {
    fixtureId: string;
    competitionId: number;
    startEpochDay: number;
    asOf: string | null;
    includeFixture: boolean;
    includeScore: boolean;
    includeOdds: boolean;
    oddsLimit: number;
  };
  safety: {
    db_write_enabled: boolean;
    txline_call_enabled: boolean;
    scheduler_enabled: false;
  };
  result?: {
    fixtureId: string;
    metaStatus: string | null;
    runId: string | null;
  };
  error?: {
    message: string;
  };
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasForbiddenOutputKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenOutputKeys(item));
  if (typeof value !== "object" || value === null) return false;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    if (SECRET_LIKE_PATTERNS.some((pattern) => normalizedKey.includes(normalizeKey(pattern)))) {
      return true;
    }
    if (hasForbiddenOutputKeys(child)) return true;
  }

  return false;
}

export function assertSafeWorkerOutput(value: unknown): void {
  if (hasForbiddenOutputKeys(value)) {
    throw new WorkerSafetyError("Worker output contains forbidden secret-like keys.");
  }
}

export function createWorkerOutputEnvelope(
  config: WorkerConfig,
  extras: Partial<Pick<WorkerOutputEnvelope, "result" | "error">> = {}
): WorkerOutputEnvelope {
  const plan = toWorkerPlan(config);
  const envelope: WorkerOutputEnvelope = {
    worker_version: "worker-v0",
    mode: config.mode,
    run_id: config.runId,
    plan: {
      fixtureId: plan.fixtureId,
      competitionId: plan.competitionId,
      startEpochDay: plan.startEpochDay,
      asOf: plan.asOf ?? null,
      includeFixture: plan.includeFixture,
      includeScore: plan.includeScore,
      includeOdds: plan.includeOdds,
      oddsLimit: plan.oddsLimit
    },
    safety: {
      db_write_enabled: config.execute && config.confirmDbWrite,
      txline_call_enabled: config.execute && config.confirmDbWrite,
      scheduler_enabled: false
    },
    ...extras
  };

  assertSafeWorkerOutput(envelope);
  return envelope;
}
