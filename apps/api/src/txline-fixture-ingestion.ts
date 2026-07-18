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
  attempted_epoch_days: number[];
  successful_epoch_days: number[];
  failed_epoch_days: number[];
  rate_limited_epoch_days: number[];
  retry_count: number;
  earliest_discovered_start: string | null;
  latest_discovered_start: string | null;
  future_horizon_days: number;
  discovery_backfill_days: number;
  fixtures_discovered: number;
  fixtures_upserted: number;
  fixtures_skipped: number;
  fixtures_failed: number;
  fixtures_unchanged: number;
  next_near_discovery_at: string | null;
  next_far_discovery_at: string | null;
  daily_coverage: FixtureDiscoveryDayCoverage[];
};

export type FixtureDiscoveryDayCoverage = {
  epoch_day: number;
  calendar_date_utc: string;
  attempts: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  fixture_count: number;
  status: "pending" | "success" | "no_data" | "retry_scheduled" | "rate_limited" | "failed";
  safe_error_code: string | null;
  retry_at: string | null;
};

export type FixtureDiscoveryWindowInput = {
  competitionId: string;
  now?: Date;
  backfillDays?: number;
  futureDays?: number;
  wait?: (ms: number) => Promise<void>;
  jitter?: () => number;
  retries?: number;
  retryAfterMs?: (error: unknown) => number | null;
  fetchFixtures?: (params: { competitionId: string; startEpochDay: number }) => Promise<unknown>;
  upsertFixture?: (upsert: FixtureUpsert) => Promise<unknown>;
};

export type FixtureDiscoveryWindowResult = {
  coverage: FixtureDiscoveryCoverage;
  days: number;
  fixtures: IngestedFixture[];
};

export type FixtureCatalogReconciliationInput = {
  fixtureId: string;
  sport?: string | null;
  competition: string | null;
  stage?: string | null;
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

function retryAfterMilliseconds(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const direct = error.retryAfterMs ?? error.retry_after_ms;
  if (typeof direct === "number" && Number.isFinite(direct) && direct >= 0) return direct;
  const headers = error.headers;
  if (isRecord(headers)) {
    const value = headers["retry-after"] ?? headers["Retry-After"];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value * 1_000;
    if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value.trim()) * 1_000;
  }
  const status = error.status ?? error.statusCode;
  return status === 429 ? 1_000 : null;
}

function isRateLimited(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.status === 429 || error.statusCode === 429 || error.code === "429" || error.code === "RATE_LIMITED";
}

function epochDay(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

function reconciliationText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function buildFixtureCatalogReconciliationReport(
  rows: FixtureCatalogReconciliationInput[],
  options: { dryRun?: boolean; competition?: string; now?: Date } = {}
): FixtureCatalogReconciliationReport {
  const selected = options.competition === undefined
    ? rows
    : rows.filter((row) => reconciliationText(row.competition) === reconciliationText(options.competition ?? null));
  const groups = new Map<string, Array<{ rows: FixtureCatalogReconciliationInput[]; minStart: number; maxStart: number }>>();
  for (const row of selected) {
    const start = row.startTimeUtc?.getTime();
    const key = row.competition === null || row.homeTeam === null || row.awayTeam === null
      ? `incomplete|${row.fixtureId}`
      : [reconciliationText(row.sport ?? "soccer"), reconciliationText(row.competition), reconciliationText(row.homeTeam), reconciliationText(row.awayTeam)].join("|");
    const candidates = groups.get(key) ?? [];
    const stage = reconciliationText(row.stage);
    const matched = start !== undefined && start !== null && Number.isFinite(start)
      ? candidates.find((cluster) => cluster.minStart !== Number.NEGATIVE_INFINITY && cluster.maxStart !== Number.POSITIVE_INFINITY &&
        start - cluster.minStart <= 5 * 60_000 && cluster.maxStart - start <= 5 * 60_000 &&
        cluster.rows.every((member) => {
          const memberStage = reconciliationText(member.stage);
          return stage === "" || memberStage === "" || stage === memberStage;
        }))
      : undefined;
    if (matched === undefined) {
      candidates.push({ rows: [row], minStart: start ?? Number.NEGATIVE_INFINITY, maxStart: start ?? Number.POSITIVE_INFINITY });
      groups.set(key, candidates);
    } else {
      matched.rows.push(row);
      matched.minStart = Math.min(matched.minStart, start as number);
      matched.maxStart = Math.max(matched.maxStart, start as number);
    }
  }
  let highConfidence = 0;
  let ambiguous = 0;
  let unchanged = 0;
  const clusters = [...groups.values()].flat();
  for (const cluster of clusters) {
    if (cluster.rows.length === 1) unchanged += 1;
    else {
      const hasCompleteIdentity = cluster.rows.every((row) => row.competition !== null && row.homeTeam !== null && row.awayTeam !== null);
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
    duplicate_candidate_groups: clusters.filter((group) => group.rows.length > 1).length,
    high_confidence_duplicates: highConfidence,
    ambiguous_groups: ambiguous,
    representatives_selected: clusters.length,
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
  jitter,
  retries,
  retryAfterMs,
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
    attempted_epoch_days: [],
    successful_epoch_days: [],
    failed_epoch_days: [],
    rate_limited_epoch_days: [],
    retry_count: 0,
    earliest_discovered_start: null,
    latest_discovered_start: null,
    future_horizon_days: Math.max(0, Math.trunc(futureDays)),
    discovery_backfill_days: Math.max(0, Math.trunc(backfillDays)),
    fixtures_discovered: 0,
    fixtures_upserted: 0,
    fixtures_skipped: 0,
    fixtures_failed: 0,
    fixtures_unchanged: 0,
    next_near_discovery_at: null,
    next_far_discovery_at: null,
    daily_coverage: requested.map((day) => ({
      epoch_day: day,
      calendar_date_utc: new Date(day * 86_400_000).toISOString().slice(0, 10),
      attempts: 0,
      last_attempt_at: null,
      last_success_at: null,
      fixture_count: 0,
      status: "pending" as const,
      safe_error_code: null,
      retry_at: null
    }))
  };
  const discoveredFixtures: IngestedFixture[] = [];

  for (const day of requested) {
    coverage.attempted_epoch_days.push(day);
    const dayCoverage = coverage.daily_coverage.find((entry) => entry.epoch_day === day);
    if (dayCoverage !== undefined) {
      dayCoverage.attempts = 1;
      dayCoverage.last_attempt_at = new Date().toISOString();
      dayCoverage.status = "pending";
    }
    let dayWasRateLimited = false;
    let attempt = 0;
    try {
      const maxRetries = Math.max(0, Math.trunc(retries ?? nonNegativeEnvInteger("MATCHPULSE_DISCOVERY_RETRIES", 3)));
      const result = await ingestTxlineFixtures({
        competitionId,
        startEpochDay: day,
        fetchFixtures: async (params) => {
          for (;;) {
            try {
              return await (fetchFixtures ?? ((input) => createTxlineLiveClient().getFixtureSnapshot(input)))(params);
            } catch (error) {
              if (isRateLimited(error)) dayWasRateLimited = true;
              if (attempt >= maxRetries) throw error;
              attempt += 1;
              coverage.retry_count += 1;
              const retryAfter = retryAfterMs?.(error) ?? retryAfterMilliseconds(error);
              const backoff = Math.min(30_000, 500 * (2 ** (attempt - 1)));
              const jitterMs = Math.max(0, Math.trunc(jitter?.() ?? Math.random() * 250));
              await wait(Math.max(retryAfter ?? 0, backoff) + jitterMs);
            }
          }
        },
        upsertFixture
      });
      coverage.successful_epoch_days.push(day);
      if (dayWasRateLimited) coverage.rate_limited_epoch_days.push(day);
      if (dayCoverage !== undefined) {
        dayCoverage.attempts = attempt + 1;
        dayCoverage.fixture_count = result.fetchedCount;
        dayCoverage.last_success_at = new Date().toISOString();
        dayCoverage.status = result.fetchedCount === 0 ? "no_data" : "success";
        dayCoverage.safe_error_code = null;
      }
      coverage.fixtures_discovered += result.fetchedCount;
      coverage.fixtures_upserted += result.upsertedCount;
      coverage.fixtures_skipped += result.skippedCount;
      coverage.fixtures_failed += result.failedCount;
      for (const fixture of result.fixtures) {
        discoveredFixtures.push(fixture);
        if (fixture.start_time_utc === null) continue;
        if (coverage.earliest_discovered_start === null || fixture.start_time_utc < coverage.earliest_discovered_start) coverage.earliest_discovered_start = fixture.start_time_utc;
        if (coverage.latest_discovered_start === null || fixture.start_time_utc > coverage.latest_discovered_start) coverage.latest_discovered_start = fixture.start_time_utc;
      }
    } catch (error) {
      coverage.failed_epoch_days.push(day);
      if (isRateLimited(error) || dayWasRateLimited) coverage.rate_limited_epoch_days.push(day);
      if (dayCoverage !== undefined) {
        dayCoverage.attempts = attempt + 1;
        dayCoverage.status = isRateLimited(error) || dayWasRateLimited ? "rate_limited" : "failed";
        dayCoverage.safe_error_code = isRateLimited(error) || dayWasRateLimited ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_DISCOVERY_FAILED";
        dayCoverage.retry_at = new Date(Date.now() + nearInterval).toISOString();
      }
    }
    const isNear = day <= epochDay(now) + 1;
    await wait(isNear ? nearInterval : farInterval);
  }
  return { coverage, days: requested.length, fixtures: discoveredFixtures };
}
