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

const SECRET_LIKE_KEYS = [
  "database_url",
  "direct_url",
  "jwt",
  "token",
  "wallet",
  "private_key",
  "secret"
] as const;

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

function parseRequiredString(args: string[], name: string): string {
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

export function parseWorkerConfig(args: string[]): WorkerConfig {
  const execute = hasFlag(args, "execute");
  const dryRunFlag = hasFlag(args, "dry-run");
  const mode: WorkerMode = execute ? "execute" : "dry-run";

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

export function hasForbiddenPlanKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenPlanKeys(item));
  if (typeof value !== "object" || value === null) return false;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (SECRET_LIKE_KEYS.some((secretKey) => normalizedKey.includes(secretKey))) {
      return true;
    }
    if (hasForbiddenPlanKeys(child)) return true;
  }

  return false;
}
