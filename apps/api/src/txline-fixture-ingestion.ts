import type { Prisma } from "@prisma/client";
import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import {
  isRecord,
  normalizeTxlineFixture,
  readString,
  type NormalizedTxlineFixturePreview
} from "./txline-normalizer.js";

export type FixtureUpsert = {
  where: { fixtureId: string };
  create: Prisma.FixtureCreateInput;
  update: Prisma.FixtureUpdateInput;
};

export type IngestedFixture = {
  fixture_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  start_time_utc: string | null;
  status: string;
};

export type FixtureIngestionResult = {
  fetchedCount: number;
  normalizedCount: number;
  upsertedCount: number;
  skippedCount: number;
  failedCount: number;
  fixtures: IngestedFixture[];
};

type IngestTxlineFixturesInput = {
  competitionId: string;
  startEpochDay: number;
  includeRaw?: boolean;
  fetchFixtures?: (params: {
    competitionId: string;
    startEpochDay: number;
  }) => Promise<unknown>;
  upsertFixture?: (upsert: FixtureUpsert) => Promise<unknown>;
};

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (!isRecord(value)) return undefined;

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return undefined;
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function hasReliableTeams(rawFixture: unknown) {
  return isRecord(rawFixture) &&
    typeof rawFixture.Participant1IsHome === "boolean" &&
    readString(rawFixture.Participant1) !== null &&
    readString(rawFixture.Participant2) !== null;
}

export function mapNormalizedFixtureToFixtureUpsert(
  normalizedFixture: NormalizedTxlineFixturePreview,
  rawFixture: unknown,
  includeRaw = false
): FixtureUpsert | null {
  if (!hasReliableTeams(rawFixture)) return null;

  const startTimeUtc = normalizedFixture.start_time_utc === null
    ? null
    : new Date(normalizedFixture.start_time_utc);
  if (startTimeUtc !== null && !Number.isFinite(startTimeUtc.getTime())) return null;

  const raw = includeRaw ? safeJson(rawFixture) : undefined;
  const values = {
    fixtureId: normalizedFixture.fixture_id,
    competition: normalizedFixture.competition,
    stage: normalizedFixture.stage,
    sport: "soccer",
    startTimeUtc,
    homeTeam: normalizedFixture.home_team,
    awayTeam: normalizedFixture.away_team,
    status: normalizedFixture.status,
    ...(raw === undefined ? {} : { raw })
  };

  return {
    where: { fixtureId: normalizedFixture.fixture_id },
    create: values,
    update: values
  };
}

function toSafeFixture(normalized: NormalizedTxlineFixturePreview): IngestedFixture {
  return {
    fixture_id: normalized.fixture_id,
    competition: normalized.competition,
    home_team: normalized.home_team,
    away_team: normalized.away_team,
    start_time_utc: normalized.start_time_utc,
    status: normalized.status
  };
}

export async function ingestTxlineFixtures({
  competitionId,
  startEpochDay,
  includeRaw = false,
  fetchFixtures = (params) => createTxlineLiveClient().getFixtureSnapshot(params),
  upsertFixture = (upsert) => getDbClient().fixture.upsert(upsert)
}: IngestTxlineFixturesInput): Promise<FixtureIngestionResult> {
  const snapshot = await fetchFixtures({ competitionId, startEpochDay });
  const rawFixtures = Array.isArray(snapshot) ? snapshot : [];
  const result: FixtureIngestionResult = {
    fetchedCount: rawFixtures.length,
    normalizedCount: 0,
    upsertedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    fixtures: []
  };

  for (const rawFixture of rawFixtures) {
    const normalized = normalizeTxlineFixture(rawFixture, { includeRaw: false });
    if (normalized === null) {
      result.skippedCount += 1;
      continue;
    }

    result.normalizedCount += 1;
    const upsert = mapNormalizedFixtureToFixtureUpsert(normalized, rawFixture, includeRaw);
    if (upsert === null) {
      result.skippedCount += 1;
      continue;
    }

    try {
      await upsertFixture(upsert);
      result.upsertedCount += 1;
      result.fixtures.push(toSafeFixture(normalized));
    } catch {
      result.failedCount += 1;
    }
  }

  return result;
}

export function summarizeFixtureIngestion(result: FixtureIngestionResult) {
  return {
    fetched_count: result.fetchedCount,
    normalized_count: result.normalizedCount,
    upserted_count: result.upsertedCount,
    skipped_count: result.skippedCount,
    failed_count: result.failedCount
  };
}
