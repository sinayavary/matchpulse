export type RuntimeFixtureTarget = {
  competitionId: number;
  startEpochDay: number;
};

export type RuntimeScoreTarget = {
  fixtureId: string;
  asOf: number;
};

export type RuntimeOddsTarget = {
  fixtureId: string;
  asOf: number;
};

export type RuntimeEventTarget = {
  fixtureId: string;
  asOf?: number;
};

export type RuntimeIngestionTargets = {
  fixtures: RuntimeFixtureTarget[];
  scores: RuntimeScoreTarget[];
  odds: RuntimeOddsTarget[];
  events: RuntimeEventTarget[];
  source: "env" | "fallback";
};

type RuntimeTargetRegistryInput = {
  fixtures?: unknown;
  scores?: unknown;
  odds?: unknown;
  events?: unknown;
};

export const FALLBACK_RUNTIME_INGESTION_TARGETS: RuntimeIngestionTargets = {
  fixtures: [{ competitionId: 430, startEpochDay: 20608 }],
  scores: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
  odds: [{ fixtureId: "17588223", asOf: 1_781_226_000_000 }],
  events: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
  source: "fallback"
};

function isRuntimeTargetRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeFixtures(value: unknown): RuntimeFixtureTarget[] {
  if (!Array.isArray(value)) return [];

  const targets: RuntimeFixtureTarget[] = [];
  for (const item of value) {
    if (!isRuntimeTargetRecord(item)) continue;
    const competitionId = readPositiveFiniteNumber(item.competitionId);
    const startEpochDay = readPositiveFiniteNumber(item.startEpochDay);
    if (competitionId === null || startEpochDay === null) continue;
    targets.push({ competitionId, startEpochDay });
  }
  return targets;
}

function normalizeScores(value: unknown): RuntimeScoreTarget[] {
  if (!Array.isArray(value)) return [];

  const targets: RuntimeScoreTarget[] = [];
  for (const item of value) {
    if (!isRuntimeTargetRecord(item)) continue;
    const fixtureId = readNonEmptyString(item.fixtureId);
    const asOf = readPositiveFiniteNumber(item.asOf);
    if (fixtureId === null || asOf === null) continue;
    targets.push({ fixtureId, asOf });
  }
  return targets;
}

function normalizeOdds(value: unknown): RuntimeOddsTarget[] {
  if (!Array.isArray(value)) return [];

  const targets: RuntimeOddsTarget[] = [];
  for (const item of value) {
    if (!isRuntimeTargetRecord(item)) continue;
    const fixtureId = readNonEmptyString(item.fixtureId);
    const asOf = readPositiveFiniteNumber(item.asOf);
    if (fixtureId === null || asOf === null) continue;
    targets.push({ fixtureId, asOf });
  }
  return targets;
}

function normalizeEvents(value: unknown): RuntimeEventTarget[] {
  if (!Array.isArray(value)) return [];

  const targets: RuntimeEventTarget[] = [];
  for (const item of value) {
    if (!isRuntimeTargetRecord(item)) continue;
    const fixtureId = readNonEmptyString(item.fixtureId);
    const asOf = item.asOf === undefined || item.asOf === null
      ? null
      : readPositiveFiniteNumber(item.asOf);
    if (fixtureId === null || (item.asOf !== undefined && item.asOf !== null && asOf === null)) continue;
    targets.push(asOf === null ? { fixtureId } : { fixtureId, asOf });
  }
  return targets;
}

function normalizeRuntimeTargets(value: unknown): RuntimeIngestionTargets | null {
  if (!isRuntimeTargetRecord(value)) return null;

  const fixtures = normalizeFixtures(value.fixtures);
  const scores = normalizeScores(value.scores);
  const odds = normalizeOdds(value.odds);
  const events = normalizeEvents(value.events);

  if (fixtures.length === 0 && scores.length === 0 && odds.length === 0 && events.length === 0) {
    return null;
  }

  return {
    fixtures,
    scores,
    odds,
    events,
    source: "env"
  };
}

export function getRuntimeIngestionTargetsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): RuntimeIngestionTargets {
  const rawValue = env.MATCHPULSE_RUNTIME_TARGETS_JSON;
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return FALLBACK_RUNTIME_INGESTION_TARGETS;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return normalizeRuntimeTargets(parsed) ?? FALLBACK_RUNTIME_INGESTION_TARGETS;
  } catch {
    return FALLBACK_RUNTIME_INGESTION_TARGETS;
  }
}
