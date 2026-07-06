export type ScheduleMode = "schedule-dry-run" | "schedule-execute";

export type ScheduleConfig = {
  mode: ScheduleMode;
  schedulerEnabled: false;
  loopEnabled: false;
  cronEnabled: false;
  redisEnabled: false;
  queueEnabled: false;
  dbWriteEnabled: boolean;
  txlineCallEnabled: boolean;
  execute: boolean;
  confirmDbWrite: boolean;
  cycleCount: 1;
  runId: string;
};

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

export class ScheduleConfigError extends TypeError {}

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

function countFlagOccurrences(args: string[], name: string): number {
  const exactFlag = `--${name}`;
  const directPrefix = `${exactFlag}=`;
  return args.reduce((count, arg) => (
    arg === exactFlag || arg.startsWith(directPrefix) ? count + 1 : count
  ), 0);
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
  return `schedule-run-${Date.now()}`;
}

function parseRunId(args: string[]): string {
  const rawValue = readFlagValue(args, "runId");
  if (rawValue === undefined) return buildDefaultRunId();

  if (countFlagOccurrences(args, "runId") > 1) {
    throw new ScheduleConfigError("runId does not support multiple values.");
  }

  const sanitized = sanitizeRunId(rawValue);
  if (!sanitized) {
    throw new ScheduleConfigError("runId must contain at least one safe alphanumeric character.");
  }
  return sanitized;
}

/**
 * Detects whether the CLI args are invoking the schedule subcommand family.
 * The first positional token is treated as the subcommand: `schedule ...`.
 */
export function isScheduleInvocation(args: string[]): boolean {
  if (args.length === 0) return false;
  const first = args[0];
  if (typeof first !== "string") return false;
  return first === "schedule" || first === "--schedule";
}

export function parseScheduleConfig(args: string[]): ScheduleConfig {
  const positionalSubcommand = args[0];
  const explicitScheduleFlag = positionalSubcommand === "--schedule" || positionalSubcommand === "schedule";

  if (!explicitScheduleFlag && !hasFlag(args, "schedule")) {
    throw new ScheduleConfigError("schedule mode is not enabled by default.");
  }

  const execute = hasFlag(args, "execute");
  const confirmDbWrite = hasFlag(args, "confirm-db-write")
    || hasFlag(args, "confirmDbWrite");

  if (confirmDbWrite && !execute) {
    throw new ScheduleConfigError("scheduled confirmation requires --execute.");
  }

  if (execute && !confirmDbWrite) {
    throw new ScheduleConfigError("scheduled execute mode requires --confirm-db-write.");
  }

  const loopRequested = hasFlag(args, "loop")
    || hasFlag(args, "interval")
    || hasFlag(args, "cron")
    || hasFlag(args, "watch")
    || hasFlag(args, "daemon")
    || hasFlag(args, "batch")
    || hasFlag(args, "unbounded");

  if (loopRequested) {
    throw new ScheduleConfigError("background loop, interval, cron, watch, and daemon modes are not enabled in this phase.");
  }

  const redisRequested = hasFlag(args, "redis")
    || hasFlag(args, "queue")
    || hasFlag(args, "bullmq")
    || hasFlag(args, "upstash");

  if (redisRequested) {
    throw new ScheduleConfigError("Redis, Upstash, BullMQ, and queue backends are not enabled in this phase.");
  }

  return {
    mode: execute ? "schedule-execute" : "schedule-dry-run",
    schedulerEnabled: false,
    loopEnabled: false,
    cronEnabled: false,
    redisEnabled: false,
    queueEnabled: false,
    dbWriteEnabled: execute && confirmDbWrite,
    txlineCallEnabled: execute && confirmDbWrite,
    execute,
    confirmDbWrite,
    cycleCount: 1,
    runId: parseRunId(args)
  };
}
