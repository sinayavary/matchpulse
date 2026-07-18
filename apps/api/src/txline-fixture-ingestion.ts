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

export type FixtureDiscoveryCoverage = {
  requested_epoch_days: number[];
  successful_epoch_days: number[];
  failed_epoch_days: number[];
  earliest_discovered_start: string | null;
  latest_discovered_start: string | null;
  future_horizon_days: number;
  fixtures_discovered: number;
  fixtures_upserted: number;
  fixtures_skipped: number;
  fixtures_failed: number;
};

export type FixtureDiscoveryWindowInput = {
  competitionId: string;
  now?: Date;
  backfillDays?: number;
  futureDays?: number;
  wait?: (ms: number) => Promise<void>;
  fetchFixtures?: (params: { competitionId: string; startEpochDay: number }) => Promise<unknown>;
  upsertFixture?: (upsert: FixtureUpsert) => Promise<unknown>;
};

export type FixtureDiscoveryWindowResult = {
  coverage: FixtureDiscoveryCoverage;
  days: number;
};

export type FixtureCatalogReconciliationInput = {
  fixtureId: string;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
};

export type FixtureCatalogReconciliationReport = {
  dry_run: boolean;
  rows_scanned: number;
  lifecycle_corrections: number;
  status_corrections: number;
  duplicate_candidate_groups: number;
  high_confidence_duplicates: number;
  ambiguous_groups: number;
  representatives_selected: number;
  rows_unchanged: number;
  errors: number;
  source_rows_deleted: number;
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

function nonNegativeEnvInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function epochDay(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

function reconciliationText(value: string | null): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function buildFixtureCatalogReconciliationReport(
  rows: FixtureCatalogReconciliationInput[],
  options: { dryRun?: boolean; competition?: string; now?: Date } = {}
): FixtureCatalogReconciliationReport {
  const selected = options.competition === undefined
    ? rows
    : rows.filter((row) => reconciliationText(row.competition) === reconciliationText(options.competition ?? null));
  const groups = new Map<string, FixtureCatalogReconciliationInput[]>();
  for (const row of selected) {
    const start = row.startTimeUtc?.getTime();
    const bucket = start === undefined || start === null || !Number.isFinite(start) ? "unknown" : String(Math.floor(start / 300_000));
    const key = [reconciliationText(row.competition), reconciliationText(row.homeTeam), reconciliationText(row.awayTeam), bucket].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let highConfidence = 0;
  let ambiguous = 0;
  let unchanged = 0;
  for (const group of groups.values()) {
    if (group.length === 1) unchanged += 1;
    else {
      const hasCompleteIdentity = group.every((row) => row.competition !== null && row.homeTeam !== null && row.awayTeam !== null);
      if (hasCompleteIdentity) highConfidence += 1;
      else ambiguous += 1;
    }
  }
  const now = options.now ?? new Date();
  const statusCorrections = selected.filter((row) => row.status === null || row.status.trim() === "").length;
  const lifecycleCorrections = selected.filter((row) => row.startTimeUtc !== null && row.startTimeUtc.getTime() <= now.getTime() && row.status === "UNKNOWN").length;
  return {
    dry_run: options.dryRun !== false,
    rows_scanned: selected.length,
    lifecycle_corrections: lifecycleCorrections,
    status_corrections: statusCorrections,
    duplicate_candidate_groups: [...groups.values()].filter((group) => group.length > 1).length,
    high_confidence_duplicates: highConfidence,
    ambiguous_groups: ambiguous,
    representatives_selected: groups.size,
    rows_unchanged: unchanged,
    errors: 0,
    source_rows_deleted: 0
  };
}

export async function ingestTxlineFixtureDiscoveryWindow({
  competitionId,
  now = new Date(),
  backfillDays = nonNegativeEnvInteger("MATCHPULSE_DISCOVERY_BACKFILL_DAYS", 1),
  futureDays = nonNegativeEnvInteger("MATCHPULSE_DISCOVERY_FUTURE_DAYS", 14),
  wait = async () => undefined,
  fetchFixtures,
  upsertFixture
}: FixtureDiscoveryWindowInput): Promise<FixtureDiscoveryWindowResult> {
  const start = Math.max(0, epochDay(now) - Math.max(0, Math.trunc(backfillDays)));
  const end = epochDay(now) + Math.max(0, Math.trunc(futureDays));
  const nearInterval = nonNegativeEnvInteger("MATCHPULSE_NEAR_DISCOVERY_INTERVAL_MS", 5 * 60_000);
  const farInterval = nonNegativeEnvInteger("MATCHPULSE_FAR_DISCOVERY_INTERVAL_MS", 30 * 60_000);
  const requested = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  const coverage: FixtureDiscoveryCoverage = {
    requested_epoch_days: requested,
    successful_epoch_days: [],
    failed_epoch_days: [],
    earliest_discovered_start: null,
    latest_discovered_start: null,
    future_horizon_days: Math.max(0, Math.trunc(futureDays)),
    fixtures_discovered: 0,
    fixtures_upserted: 0,
    fixtures_skipped: 0,
    fixtures_failed: 0
  };

  for (const day of requested) {
    try {
      const result = await ingestTxlineFixtures({ competitionId, startEpochDay: day, fetchFixtures, upsertFixture });
      coverage.successful_epoch_days.push(day);
      coverage.fixtures_discovered += result.fetchedCount;
      coverage.fixtures_upserted += result.upsertedCount;
      coverage.fixtures_skipped += result.skippedCount;
      coverage.fixtures_failed += result.failedCount;
      for (const fixture of result.fixtures) {
        if (fixture.start_time_utc === null) continue;
        if (coverage.earliest_discovered_start === null || fixture.start_time_utc < coverage.earliest_discovered_start) coverage.earliest_discovered_start = fixture.start_time_utc;
        if (coverage.latest_discovered_start === null || fixture.start_time_utc > coverage.latest_discovered_start) coverage.latest_discovered_start = fixture.start_time_utc;
      }
    } catch {
      coverage.failed_epoch_days.push(day);
    }
    const isNear = day <= epochDay(now) + 1;
    await wait(isNear ? nearInterval : farInterval);
  }
  return { coverage, days: requested.length };
}
