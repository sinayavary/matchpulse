export class SchedulePlanError extends TypeError {}

export const DEFAULT_ODDS_LIMIT = 20;
export const MAX_ODDS_LIMIT = 50;

export type ScheduleJob = {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
};

/**
 * Static, known-safe demo fixture jobs.
 *
 * These are the only fixtures the schedule plan is allowed to reference in this
 * phase. No live data is fetched and no DB is read while building the plan.
 * The two fixtures below are the same demo fixtures surfaced by the public demo
 * bridge and are safe to enumerate statically.
 */
export const STATIC_DEMO_SCHEDULE_JOBS: readonly ScheduleJob[] = [
  {
    fixtureId: "17952170",
    competitionId: 430,
    startEpochDay: 20608,
    includeFixture: true,
    includeScore: true,
    includeOdds: true,
    oddsLimit: DEFAULT_ODDS_LIMIT
  },
  {
    fixtureId: "17588223",
    competitionId: 430,
    startEpochDay: 20608,
    includeFixture: true,
    includeScore: true,
    includeOdds: true,
    oddsLimit: DEFAULT_ODDS_LIMIT
  }
] as const;

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

function jobHasSecretLikeKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => jobHasSecretLikeKey(item));
  if (typeof value !== "object" || value === null) return false;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeKey(key);
    if (SECRET_LIKE_PATTERNS.some((pattern) => normalizedKey.includes(normalizeKey(pattern)))) {
      return true;
    }
    if (jobHasSecretLikeKey(child)) return true;
  }
  return false;
}

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

/**
 * Validates a single schedule job against the safe shape required by this phase.
 * Throws SchedulePlanError on any violation.
 */
export function validateScheduleJob(input: unknown): ScheduleJob {
  if (typeof input !== "object" || input === null) {
    throw new SchedulePlanError("scheduled job must be an object.");
  }
  const record = input as Record<string, unknown>;

  if (jobHasSecretLikeKey(record)) {
    throw new SchedulePlanError("scheduled job contains forbidden secret-like fields.");
  }

  const fixtureId = record.fixtureId;
  if (typeof fixtureId !== "string" || fixtureId.trim() === "") {
    throw new SchedulePlanError("scheduled job requires a non-empty fixtureId string.");
  }

  const competitionId = Number(record.competitionId);
  if (!Number.isFinite(competitionId) || competitionId <= 0 || !Number.isInteger(competitionId)) {
    throw new SchedulePlanError("scheduled job requires competitionId to be a finite positive integer.");
  }

  const startEpochDay = Number(record.startEpochDay);
  if (!Number.isFinite(startEpochDay) || startEpochDay <= 0 || !Number.isInteger(startEpochDay)) {
    throw new SchedulePlanError("scheduled job requires startEpochDay to be a finite positive integer.");
  }

  const rawOddsLimit = record.oddsLimit;
  const oddsLimit = rawOddsLimit === undefined
    ? DEFAULT_ODDS_LIMIT
    : Math.min(MAX_ODDS_LIMIT, Math.trunc(Number(rawOddsLimit)));
  if (!Number.isFinite(oddsLimit) || oddsLimit < 1) {
    throw new SchedulePlanError("scheduled job requires oddsLimit to be a positive integer.");
  }

  const includeFixture = record.includeFixture ?? true;
  if (!isBoolean(includeFixture)) {
    throw new SchedulePlanError("scheduled job includeFixture must be a boolean.");
  }
  const includeScore = record.includeScore ?? true;
  if (!isBoolean(includeScore)) {
    throw new SchedulePlanError("scheduled job includeScore must be a boolean.");
  }
  const includeOdds = record.includeOdds ?? true;
  if (!isBoolean(includeOdds)) {
    throw new SchedulePlanError("scheduled job includeOdds must be a boolean.");
  }

  const allowedKeys = new Set([
    "fixtureId",
    "competitionId",
    "startEpochDay",
    "includeFixture",
    "includeScore",
    "includeOdds",
    "oddsLimit"
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new SchedulePlanError(`scheduled job contains unknown field: ${key}.`);
    }
  }

  return {
    fixtureId,
    competitionId,
    startEpochDay,
    includeFixture,
    includeScore,
    includeOdds,
    oddsLimit
  };
}

/**
 * Builds the static schedule plan from known-safe demo fixtures.
 * Accepts an optional override list so callers can restrict to a subset
 * (e.g. only fixture 17952170). All jobs are re-validated before returning.
 * Never fetches live data. Never reads or writes the DB.
 */
export function buildStaticSchedulePlan(
  jobs: readonly ScheduleJob[] = STATIC_DEMO_SCHEDULE_JOBS
): ScheduleJob[] {
  return jobs.map((job) => validateScheduleJob(job));
}

/**
 * Returns the primary demo job (17952170) used for the one-cycle dry-run plan.
 */
export function getPrimaryDemoScheduleJob(): ScheduleJob {
  return STATIC_DEMO_SCHEDULE_JOBS[0];
}
