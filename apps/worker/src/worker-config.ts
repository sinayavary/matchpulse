export type WorkerMode = "dry-run" | "execute";

export type WorkerConfig = {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  asOf?: string;
  oddsLimit: number;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  mode: WorkerMode;
  dryRun: boolean;
  execute: boolean;
  confirmDbWrite: boolean;
  runId: string;
  schedulerEnabled: false;
  loopEnabled: false;
};

export type WorkerPlan = {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  asOf?: string;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
  mode: WorkerMode;
};

export class WorkerConfigError extends TypeError {}

const MAX_RUN_ID_LENGTH = 80;

function readFlagValue(args: string[], name: string): string | undefined {
  const directPrefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === `--${name}`) return args[index + 1];
    if (arg.startsWith(directPrefix)) return arg.slice(directPrefix.length);
  }
  return undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function countFlagOccurrences(args: string[], name: string): number {
  const exactFlag = `--${name}`;
  const directPrefix = `${exactFlag}=`;
  return args.reduce((count, arg) => (
    arg === exactFlag || arg.startsWith(directPrefix) ? count + 1 : count
  ), 0);
}

function parseRequiredString(args: string[], name: string): string {
  if (countFlagOccurrences(args, name) > 1) {
    throw new WorkerConfigError(`${name} does not support multiple values.`);
  }
  const value = readFlagValue(args, name)?.trim();
  if (!value) {
    throw new WorkerConfigError(`${name} is required.`);
  }
  return value;
}

function parseRequiredNonNegativeInteger(args: string[], name: string): number {
  const rawValue = parseRequiredString(args, name);
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    throw new WorkerConfigError(`${name} must be a non-negative integer.`);
  }
  return value;
}

function parseOptionalBoolean(args: string[], name: string, defaultValue: boolean): boolean {
  const rawValue = readFlagValue(args, name);
  if (rawValue === undefined) return hasFlag(args, name) ? true : defaultValue;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new WorkerConfigError(`${name} must be true or false when provided.`);
}

function parseOptionalAsOf(args: string[]): string | undefined {
  const rawValue = readFlagValue(args, "asOf")?.trim();
  if (rawValue === undefined || rawValue === "") return undefined;

  const epochMs = /^[-+]?\d+(?:\.\d+)?$/.test(rawValue) ? Number(rawValue) : Date.parse(rawValue);
  if (!Number.isFinite(epochMs) || !Number.isFinite(new Date(epochMs).getTime())) {
    throw new WorkerConfigError("asOf must be epoch milliseconds or a valid ISO date string.");
  }
  return rawValue;
}

function parseOddsLimit(args: string[]): number {
  const rawValue = readFlagValue(args, "oddsLimit");
  if (rawValue === undefined || rawValue.trim() === "") return 20;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new WorkerConfigError("oddsLimit must be a positive integer.");
  }

  const normalized = Math.trunc(value);
  if (normalized < 1) {
    throw new WorkerConfigError("oddsLimit must be a positive integer.");
  }

  return Math.min(50, normalized);
}

function sanitizeRunId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, MAX_RUN_ID_LENGTH);
}

function buildDefaultRunId(): string {
  return `worker-run-${Date.now()}`;
}

function parseRunId(args: string[]): string {
  const rawValue = readFlagValue(args, "runId");
  if (rawValue === undefined) return buildDefaultRunId();

  if (countFlagOccurrences(args, "runId") > 1) {
    throw new WorkerConfigError("runId does not support multiple values.");
  }

  const sanitized = sanitizeRunId(rawValue);
  if (!sanitized) {
    throw new WorkerConfigError("runId must contain at least one safe alphanumeric character.");
  }
  return sanitized;
}

export function parseWorkerConfig(args: string[]): WorkerConfig {
  const execute = hasFlag(args, "execute");
  const dryRunFlag = hasFlag(args, "dry-run");
  const confirmDbWrite = hasFlag(args, "confirm-db-write");
  const mode: WorkerMode = execute ? "execute" : "dry-run";

  if (execute && !confirmDbWrite) {
    throw new WorkerConfigError("execute mode requires --confirm-db-write.");
  }

  return {
    fixtureId: parseRequiredString(args, "fixtureId"),
    competitionId: parseRequiredNonNegativeInteger(args, "competitionId"),
    startEpochDay: parseRequiredNonNegativeInteger(args, "startEpochDay"),
    asOf: parseOptionalAsOf(args),
    oddsLimit: parseOddsLimit(args),
    includeFixture: parseOptionalBoolean(args, "includeFixture", true),
    includeScore: parseOptionalBoolean(args, "includeScore", true),
    includeOdds: parseOptionalBoolean(args, "includeOdds", true),
    mode,
    dryRun: !execute || dryRunFlag,
    execute,
    confirmDbWrite,
    runId: parseRunId(args),
    schedulerEnabled: false,
    loopEnabled: false
  };
}

export function toWorkerPlan(config: WorkerConfig): WorkerPlan {
  return {
    fixtureId: config.fixtureId,
    competitionId: config.competitionId,
    startEpochDay: config.startEpochDay,
    ...(config.asOf === undefined ? {} : { asOf: config.asOf }),
    includeFixture: config.includeFixture,
    includeScore: config.includeScore,
    includeOdds: config.includeOdds,
    oddsLimit: config.oddsLimit,
    mode: config.mode
  };
}

export function formatWorkerPlan(config: WorkerConfig): string {
  return JSON.stringify(toWorkerPlan(config), null, 2);
}
