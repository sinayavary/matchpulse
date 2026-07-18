import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import { buildFixtureCatalogReconciliationReport, ingestTxlineFixtureDiscoveryWindow, type FixtureCatalogReconciliationInput, type FixtureDiscoveryCoverage } from "./txline-fixture-ingestion.js";
import { ingestTxlineScoreSnapshot } from "./txline-score-ingestion.js";
import { ingestTxlineOddsSnapshot } from "./txline-odds-ingestion.js";
import { ingestTxlineMatchEvents } from "./txline-event-ingestion.js";
import { resolveMatchLifecycle } from "./match-lifecycle.js";

export type CompetitionConfig = { competitionId: string; startEpochDay: number };
export type PollPhase = "upcoming" | "prematch" | "live" | "postmatch" | "finished";
export type PollConfig = { leadMinutes: number; tailMinutes: number; upcomingMs: number; prematchMs: number; liveMs: number; postmatchMs: number };
export type SafeRuntimeError = { name: string; code: string; message: string; stage: string };
export type WorkerCycleRecord = {
  owner_id: string;
  last_cycle_status: string;
  started_at: string;
  finished_at: string | null;
  discovered_competitions: number;
  discovered_fixture_count: number;
  active_fixture_count: number;
  persisted_fixture_count: number;
  successful_fixture_count: number;
  failed_fixture_count: number;
  configuration_error: boolean;
  lock_acquired: boolean;
  lease_expires_at: string;
  discovery?: {
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
    fixtures_unchanged: number;
    fixtures_failed: number;
    next_near_discovery_at: string;
    next_far_discovery_at: string;
  };
};

const envNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const automaticRuntimeConfig = () => ({
  enabled: process.env.MATCHPULSE_DATA_WORKER_ENABLED === "true",
  agentEnabled: process.env.MATCHPULSE_AGENT_ENABLED !== "false",
  discoveryIntervalMs: envNumber("MATCHPULSE_FIXTURE_DISCOVERY_INTERVAL_MS", 300_000),
  upcomingMs: envNumber("MATCHPULSE_UPCOMING_POLL_INTERVAL_MS", 300_000),
  prematchMs: envNumber("MATCHPULSE_PREMATCH_POLL_INTERVAL_MS", 30_000),
  liveMs: envNumber("MATCHPULSE_LIVE_POLL_INTERVAL_MS", 15_000),
  postmatchMs: envNumber("MATCHPULSE_POSTMATCH_POLL_INTERVAL_MS", 30_000),
  leadMinutes: envNumber("MATCHPULSE_CAPTURE_LEAD_MINUTES", 60),
  tailMinutes: envNumber("MATCHPULSE_CAPTURE_TAIL_MINUTES", 180),
  discoveryBackfillDays: Math.max(0, Math.trunc(envNumber("MATCHPULSE_DISCOVERY_BACKFILL_DAYS", 1))),
  discoveryFutureDays: Math.max(0, Math.trunc(envNumber("MATCHPULSE_DISCOVERY_FUTURE_DAYS", 14))),
  nearDiscoveryIntervalMs: envNumber("MATCHPULSE_NEAR_DISCOVERY_INTERVAL_MS", 5 * 60_000),
  farDiscoveryIntervalMs: envNumber("MATCHPULSE_FAR_DISCOVERY_INTERVAL_MS", 30 * 60_000),
  discoveryRetries: Math.max(0, Math.trunc(envNumber("MATCHPULSE_DISCOVERY_RETRIES", 3)))
});

const workerOwnerId = randomUUID();
const LEASE_MS = 90_000;

function safeError(error: unknown, stage: string): SafeRuntimeError {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const name = typeof record.name === "string" ? record.name.slice(0, 80) : "Error";
  const code = typeof record.code === "string" ? record.code.slice(0, 80) : "UNKNOWN";
  const message = error instanceof Error ? error.message : String(error);
  return { name, code, message: message.replace(/(https?:\/\/|postgres(?:ql)?:\/\/|bearer\s+|token|jwt|password|database_url)[^\s]*/gi, "[redacted]").slice(0, 240), stage };
}

export function toSafeRuntimeError(error: unknown, stage: string): SafeRuntimeError { return safeError(error, stage); }

export function normalizeWorkerHealthState(input: { error?: unknown; errorCount?: number; stage?: string }) {
  const safe = input.error === undefined || input.error === null ? null : safeError(input.error, input.stage ?? "runtime");
  return { lastError: safe ? JSON.stringify(safe) : null, errorCount: input.errorCount ?? 0 };
}

function utcEpochDay(date: Date): number { return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000); }

export function discoveryEpochDays(now = new Date(), backfillDays = automaticRuntimeConfig().discoveryBackfillDays, futureDays = automaticRuntimeConfig().discoveryFutureDays): number[] {
  const day = utcEpochDay(now);
  return Array.from({ length: Math.max(0, Math.trunc(backfillDays) + Math.trunc(futureDays) + 1) }, (_, index) => day - Math.trunc(backfillDays) + index);
}

function emptyDiscoveryCoverage(futureDays: number, backfillDays: number): FixtureDiscoveryCoverage {
  return {
    requested_epoch_days: [], attempted_epoch_days: [], successful_epoch_days: [], failed_epoch_days: [], rate_limited_epoch_days: [], retry_count: 0,
    earliest_discovered_start: null, latest_discovered_start: null, future_horizon_days: futureDays,
    fixtures_discovered: 0, fixtures_upserted: 0, fixtures_skipped: 0, fixtures_failed: 0,
    fixtures_unchanged: 0, next_near_discovery_at: null, next_far_discovery_at: null,
    discovery_backfill_days: backfillDays
  };
}

function mergeDiscoveryCoverage(target: FixtureDiscoveryCoverage, next: FixtureDiscoveryCoverage): void {
  target.requested_epoch_days.push(...next.requested_epoch_days);
  target.attempted_epoch_days.push(...next.attempted_epoch_days);
  target.successful_epoch_days.push(...next.successful_epoch_days);
  target.failed_epoch_days.push(...next.failed_epoch_days);
  target.rate_limited_epoch_days.push(...next.rate_limited_epoch_days);
  target.retry_count += next.retry_count;
  target.fixtures_discovered += next.fixtures_discovered;
  target.fixtures_upserted += next.fixtures_upserted;
  target.fixtures_skipped += next.fixtures_skipped;
  target.fixtures_failed += next.fixtures_failed;
  target.fixtures_unchanged += next.fixtures_unchanged;
  if (next.earliest_discovered_start !== null && (target.earliest_discovered_start === null || next.earliest_discovered_start < target.earliest_discovered_start)) target.earliest_discovered_start = next.earliest_discovered_start;
  if (next.latest_discovered_start !== null && (target.latest_discovered_start === null || next.latest_discovered_start > target.latest_discovered_start)) target.latest_discovered_start = next.latest_discovered_start;
}

function discoveryHealth(coverage: FixtureDiscoveryCoverage, now: Date, config: ReturnType<typeof automaticRuntimeConfig>) {
  const nextNear = new Date(now.getTime() + config.nearDiscoveryIntervalMs).toISOString();
  const nextFar = new Date(now.getTime() + config.farDiscoveryIntervalMs).toISOString();
  return { ...coverage, discovery_backfill_days: config.discoveryBackfillDays, next_near_discovery_at: nextNear, next_far_discovery_at: nextFar };
}

export function parseCompetitionConfig(value = process.env.MATCHPULSE_COMPETITIONS): CompetitionConfig[] {
  const idList = process.env.MATCHPULSE_COMPETITION_IDS?.trim();
  if (!value?.trim() && idList) return idList.split(",").map((competitionId) => ({ competitionId: competitionId.trim(), startEpochDay: utcEpochDay(new Date()) })).filter((item) => /^\d+$/.test(item.competitionId));
  const configuredValue = value?.trim() || (() => {
    const competitionId = process.env.TXLINE_DEFAULT_COMPETITION_ID?.trim();
    const startEpochDay = process.env.TXLINE_DEFAULT_START_EPOCH_DAY?.trim();
    return competitionId && startEpochDay ? `${competitionId}:${startEpochDay}` : "";
  })();
  if (!configuredValue) return [];
  const items: CompetitionConfig[] = [];
  for (const token of configuredValue.split(",")) {
    const [competitionId, rawDay] = token.trim().split(":");
    const startEpochDay = Number(rawDay);
    if (!competitionId || !/^\d+$/.test(competitionId) || !Number.isInteger(startEpochDay) || startEpochDay < 0) {
      throw new Error("MATCHPULSE_COMPETITIONS must contain real competitionId:startEpochDay entries.");
    }
    items.push({ competitionId, startEpochDay });
  }
  return items;
}

export function pollPhase(startTime: Date | null, status: string | null, now = new Date(), config: PollConfig = automaticRuntimeConfig()): PollPhase {
  const lifecycle = resolveMatchLifecycle({ providerStatus: status, startTimeUtc: startTime, now, captureLeadMinutes: config.leadMinutes, captureTailMinutes: config.tailMinutes });
  if (lifecycle.lifecycle === "scheduled" && startTime !== null && startTime.getTime() - now.getTime() <= config.leadMinutes * 60_000 && startTime.getTime() > now.getTime()) return "prematch";
  switch (lifecycle.lifecycle) {
    case "scheduled": return "upcoming";
    case "prematch": return "prematch";
    case "live_first_half":
    case "halftime":
    case "live_second_half":
    case "extra_time":
    case "penalties":
    case "unknown_in_progress": return "live";
    case "finished_unconfirmed": return "postmatch";
    default: return "finished";
  }
}

export function cadenceForPhase(phase: PollPhase, config: PollConfig = automaticRuntimeConfig()): number {
  switch (phase) {
    case "prematch": return config.prematchMs;
    case "live": return config.liveMs;
    case "postmatch": return config.postmatchMs;
    case "finished": return Number.POSITIVE_INFINITY;
    default: return config.upcomingMs;
  }
}

export async function withProviderRetry<T>(operation: () => Promise<T>, options: { retries?: number; sleep?: (ms: number) => Promise<void>; retryAfterMs?: (error: unknown) => number | null } = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); } catch (error) {
      if (attempt >= retries) throw error;
      const retryAfter = options.retryAfterMs?.(error) ?? 0;
      const jitter = Math.floor(Math.random() * 250);
      await sleep(Math.max(retryAfter, 500 * (2 ** attempt)) + jitter);
    }
  }
}

export function extractProviderEvents(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(extractProviderEvents);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["events", "Events", "matchEvents", "MatchEvents"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

export async function tryAcquireWorkerLock(): Promise<boolean> {
  const db = getDbClient();
  await db.healthStatus.upsert({ where: { serviceName: "matchpulse-data-worker" }, create: { serviceName: "matchpulse-data-worker", status: "starting", lastHeartbeat: new Date(), errorCount: 0 }, update: {} });
  const result = await db.$queryRaw<Array<{ owner_id: string }>>(Prisma.sql`UPDATE health_status SET status = 'locked', last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, raw = jsonb_build_object('owner_id', ${workerOwnerId}, 'lease_expires_at', (CURRENT_TIMESTAMP + interval '90 seconds')) WHERE service_name = 'matchpulse-data-worker' AND ((raw->>'lease_expires_at') IS NULL OR (raw->>'lease_expires_at')::timestamptz < CURRENT_TIMESTAMP OR raw->>'owner_id' = ${workerOwnerId}) RETURNING raw->>'owner_id' AS owner_id`);
  return result[0]?.owner_id === workerOwnerId;
}

export async function releaseWorkerLock(): Promise<void> {
  await getDbClient().$executeRaw(Prisma.sql`UPDATE health_status SET status = 'idle', updated_at = CURRENT_TIMESTAMP, raw = jsonb_set(jsonb_set(COALESCE(raw, '{}'::jsonb), '{lock_acquired}', 'false'::jsonb, true), '{lease_expires_at}', to_jsonb(CURRENT_TIMESTAMP), true) WHERE service_name = 'matchpulse-data-worker' AND raw->>'owner_id' = ${workerOwnerId}`);
}

export async function updateWorkerHealth(input: { status: string; lastIngestion?: Date; error?: unknown; errorCount?: number; stage?: string; cycle?: Record<string, unknown> }) {
  const healthState = normalizeWorkerHealthState(input);
  const cycleJson = input.cycle === undefined ? undefined : JSON.parse(JSON.stringify(input.cycle)) as Prisma.InputJsonValue;
  await getDbClient().healthStatus.upsert({
    where: { serviceName: "matchpulse-data-worker" },
    create: { serviceName: "matchpulse-data-worker", status: input.status, lastHeartbeat: new Date(), lastDataReceivedAt: input.lastIngestion ?? null, errorCount: healthState.errorCount, lastError: healthState.lastError, raw: cycleJson },
    update: { status: input.status, lastHeartbeat: new Date(), ...(input.lastIngestion ? { lastDataReceivedAt: input.lastIngestion } : {}), lastError: healthState.lastError, errorCount: healthState.errorCount, ...(cycleJson ? { raw: cycleJson } : {}) }
  });
}

export function buildWorkerCycleRecord(input: Omit<WorkerCycleRecord, "owner_id" | "lease_expires_at"> & { leaseExpiresAt: Date }): WorkerCycleRecord {
  const { leaseExpiresAt, ...cycle } = input;
  return {
    owner_id: workerOwnerId,
    ...cycle,
    lease_expires_at: leaseExpiresAt.toISOString()
  };
}

export type MatchesCatalogReconciliationOptions = {
  dryRun?: boolean;
  competition?: string;
  from?: Date;
  to?: Date;
  batchSize?: number;
  cursor?: string;
  resume?: boolean;
  maxBatches?: number;
  now?: Date;
  db?: any;
};

export type MatchesCatalogReconciliationResult = {
  job_version: "matches-catalog-reconcile-v2";
  mode: "dry-run" | "apply";
  cursor: string | null;
  next_cursor: string | null;
  batches: number;
  rows_scanned: number;
  lifecycle_corrections: number;
  status_corrections: number;
  duplicate_candidate_groups: number;
  high_confidence_duplicates: number;
  ambiguous_groups: number;
  representatives_selected: number;
  rows_unchanged: number;
  failures: number;
  source_rows_deleted: 0;
  finished: boolean;
};

function parseResumeCursor(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function runMatchesCatalogReconciliation(options: MatchesCatalogReconciliationOptions = {}): Promise<MatchesCatalogReconciliationResult> {
  const db = (options.db ?? getDbClient()) as any;
  const dryRun = options.dryRun !== false;
  const batchSize = Math.min(250, Math.max(1, Math.trunc(options.batchSize ?? 250)));
  const maxBatches = options.maxBatches === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.trunc(options.maxBatches));
  let cursor = parseResumeCursor(options.cursor);
  if (cursor === null && options.resume) {
    try {
      const checkpoint = await db.healthStatus.findUnique({ where: { serviceName: "matchpulse-matches-catalog-reconcile" }, select: { raw: true } });
      const raw = checkpoint?.raw as Record<string, unknown> | null | undefined;
      cursor = parseResumeCursor(raw?.cursor);
    } catch { cursor = null; }
  }
  const allRows: FixtureCatalogReconciliationInput[] = [];
  let batches = 0;
  let failures = 0;
  let nextCursor: string | null = cursor;
  let finished = false;
  for (; batches < maxBatches;) {
    const where: Record<string, unknown> = {
      ...(options.competition === undefined ? {} : { competition: options.competition }),
      ...(options.from === undefined && options.to === undefined ? {} : { startTimeUtc: { ...(options.from === undefined ? {} : { gte: options.from }), ...(options.to === undefined ? {} : { lt: options.to }) } })
    };
    const rows = await db.fixture.findMany({
      where,
      ...(nextCursor === null ? {} : { cursor: { fixtureId: nextCursor }, skip: 1 }),
      orderBy: { fixtureId: "asc" },
      take: batchSize,
      select: { fixtureId: true, sport: true, stage: true, competition: true, homeTeam: true, awayTeam: true, startTimeUtc: true, status: true }
    }) as Array<FixtureCatalogReconciliationInput & { fixtureId: string }>;
    batches += 1;
    if (rows.length === 0) { finished = true; nextCursor = null; break; }
    for (const row of rows) {
      allRows.push(row);
      const lifecycle = resolveMatchLifecycle({ providerStatus: row.status, startTimeUtc: row.startTimeUtc, now: options.now ?? new Date() });
      if (!dryRun && (row.status === null || row.status.trim() === "" || row.status === "UNKNOWN")) {
        try { await db.fixture.update({ where: { fixtureId: row.fixtureId }, data: { status: lifecycle.lifecycle } }); }
        catch { failures += 1; }
      }
    }
    nextCursor = rows[rows.length - 1]!.fixtureId;
    const safeCheckpoint = { job_version: "matches-catalog-reconcile-v2", mode: dryRun ? "dry-run" : "apply", cursor: nextCursor, scanned: allRows.length, failures, updated_at: new Date().toISOString() };
    try {
      await db.healthStatus.upsert({ where: { serviceName: "matchpulse-matches-catalog-reconcile" }, create: { serviceName: "matchpulse-matches-catalog-reconcile", status: "running", lastHeartbeat: new Date(), errorCount: failures, raw: safeCheckpoint }, update: { status: "running", lastHeartbeat: new Date(), errorCount: failures, raw: safeCheckpoint } });
    } catch { /* checkpoint failure must not turn a row-level report into a destructive retry */ }
    if (rows.length < batchSize) { finished = true; nextCursor = null; break; }
  }
  const report = buildFixtureCatalogReconciliationReport(allRows, { dryRun, competition: options.competition, now: options.now });
  const result: MatchesCatalogReconciliationResult = {
    job_version: "matches-catalog-reconcile-v2", mode: dryRun ? "dry-run" : "apply", cursor: options.cursor ?? null, next_cursor: nextCursor,
    batches, rows_scanned: report.rows_scanned, lifecycle_corrections: report.lifecycle_corrections,
    status_corrections: dryRun ? report.status_corrections : report.status_corrections - failures,
    duplicate_candidate_groups: report.duplicate_candidate_groups, high_confidence_duplicates: report.high_confidence_duplicates,
    ambiguous_groups: report.ambiguous_groups, representatives_selected: report.representatives_selected,
    rows_unchanged: report.rows_unchanged, failures, source_rows_deleted: 0, finished
  };
  try {
    await db.healthStatus.upsert({ where: { serviceName: "matchpulse-matches-catalog-reconcile" }, create: { serviceName: "matchpulse-matches-catalog-reconcile", status: finished ? "idle" : "paused", lastHeartbeat: new Date(), errorCount: failures, raw: result }, update: { status: finished ? "idle" : "paused", lastHeartbeat: new Date(), errorCount: failures, raw: result } });
  } catch { /* safe summary remains the authoritative return value */ }
  return result;
}

export async function runAutomaticIngestionCycle(now = new Date()) {
  const startedAt = now;
  const config = automaticRuntimeConfig();
  const startCycle = buildWorkerCycleRecord({ last_cycle_status: "starting", started_at: startedAt.toISOString(), finished_at: null, discovered_competitions: 0, discovered_fixture_count: 0, active_fixture_count: 0, persisted_fixture_count: 0, successful_fixture_count: 0, failed_fixture_count: 0, configuration_error: false, lock_acquired: true, leaseExpiresAt: new Date(startedAt.getTime() + LEASE_MS), discovery: discoveryHealth(emptyDiscoveryCoverage(config.discoveryFutureDays, config.discoveryBackfillDays), now, config) });
  await updateWorkerHealth({ status: "starting", errorCount: 0, stage: "startup", cycle: startCycle });
  let competitions: CompetitionConfig[];
  try {
    competitions = parseCompetitionConfig();
  } catch (error) {
    const finishedAt = now;
    const cycle = buildWorkerCycleRecord({ ...startCycle, last_cycle_status: "error", finished_at: finishedAt.toISOString(), configuration_error: true, lock_acquired: true, leaseExpiresAt: new Date(finishedAt.getTime() + LEASE_MS) });
    await updateWorkerHealth({ status: "error", error, errorCount: 1, stage: "configuration", cycle });
    return { success: 0, failed: 0, activeFixtures: 0, persistedFixtures: 0, agentEnabled: config.agentEnabled, discoveredCompetitions: 0, discoveredFixtures: 0, nextWakeMs: config.discoveryIntervalMs, configurationError: true, status: "error" as const };
  }
  if (competitions.length === 0) {
    const cycle = buildWorkerCycleRecord({ ...startCycle, last_cycle_status: "no_data", finished_at: now.toISOString(), configuration_error: true, lock_acquired: true, leaseExpiresAt: new Date(now.getTime() + LEASE_MS) });
    await updateWorkerHealth({ status: "no_data", errorCount: 0, stage: "configuration", cycle });
    return { success: 0, failed: 0, activeFixtures: 0, persistedFixtures: 0, agentEnabled: config.agentEnabled, discoveredCompetitions: 0, discoveredFixtures: 0, nextWakeMs: config.discoveryIntervalMs, configurationError: true, status: "no_data" as const };
  }
  const client = createTxlineLiveClient();
  let success = 0;
  let failed = 0;
  let discoveryFailed = 0;
  let discoveredFixtureCount = 0;
  let persistedFixtureCount = 0;
  const discoveredFixtureIds = new Set<string>();
  let lastCycleError: unknown = null;
  let lastCycleErrorStage = "cycle";
  const discoveryCoverage = emptyDiscoveryCoverage(config.discoveryFutureDays, config.discoveryBackfillDays);
  for (const competition of competitions) {
    try {
      const result = await ingestTxlineFixtureDiscoveryWindow({
        competitionId: competition.competitionId,
        now,
        backfillDays: config.discoveryBackfillDays,
        futureDays: config.discoveryFutureDays,
        retries: config.discoveryRetries,
        wait: async () => undefined,
        fetchFixtures: ({ competitionId, startEpochDay }) => client.getFixtureSnapshot({ competitionId, startEpochDay })
      });
      mergeDiscoveryCoverage(discoveryCoverage, result.coverage);
      for (const fixture of result.fixtures) discoveredFixtureIds.add(fixture.fixture_id);
      discoveredFixtureCount += result.coverage.fixtures_discovered;
      persistedFixtureCount += result.coverage.fixtures_upserted;
      discoveryFailed += result.coverage.failed_epoch_days.length;
    } catch (error) { discoveryFailed += 1; lastCycleError = error; lastCycleErrorStage = "discovery"; }
  }
  const fixtures = await getDbClient().fixture.findMany({ select: { fixtureId: true, startTimeUtc: true, status: true } });
  let nextWakeMs = config.discoveryIntervalMs;
  const discoveredFixtures = fixtures.filter((fixture) => discoveredFixtureIds.has(fixture.fixtureId));
  const activeFixtures = discoveredFixtures.filter((fixture) => {
    const phase = pollPhase(fixture.startTimeUtc, fixture.status, now, config);
    return phase !== "finished" && phase !== "upcoming";
  });
  for (const fixture of activeFixtures) {
    const phase = pollPhase(fixture.startTimeUtc, fixture.status, now, config);
    nextWakeMs = Math.min(nextWakeMs, cadenceForPhase(phase, config));
    try {
      await withProviderRetry(() => ingestTxlineScoreSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      await withProviderRetry(() => ingestTxlineOddsSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      const historical = await withProviderRetry(() => client.getScoreHistorical({ fixtureId: fixture.fixtureId }));
      const events = extractProviderEvents(historical);
      if (events.length > 0) await ingestTxlineMatchEvents({ fixtureId: fixture.fixtureId, rawEvents: events });
      success += 1;
    } catch (error) { failed += 1; lastCycleError = error; lastCycleErrorStage = "ingestion"; }
  }
  const status = failed === 0 && discoveryFailed === 0 ? "healthy" : success > 0 ? "degraded" : "error";
  const cycle = buildWorkerCycleRecord({ last_cycle_status: status, started_at: startedAt.toISOString(), finished_at: now.toISOString(), discovered_competitions: competitions.length, discovered_fixture_count: discoveredFixtureCount, active_fixture_count: activeFixtures.length, persisted_fixture_count: persistedFixtureCount, successful_fixture_count: success, failed_fixture_count: failed + discoveryFailed, configuration_error: false, lock_acquired: true, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), discovery: discoveryHealth(discoveryCoverage, now, config) });
  await updateWorkerHealth({ status, lastIngestion: success > 0 ? now : undefined, error: lastCycleError, errorCount: failed + discoveryFailed, stage: lastCycleErrorStage, cycle });
  return { success, failed: failed + discoveryFailed, activeFixtures: activeFixtures.length, persistedFixtures: persistedFixtureCount, agentEnabled: config.agentEnabled, discoveredCompetitions: competitions.length, discoveredFixtures: discoveredFixtureCount, discoveryFailed, configurationError: false, nextWakeMs, status };
}
