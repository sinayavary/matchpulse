import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import { ingestTxlineFixtures } from "./txline-fixture-ingestion.js";
import { ingestTxlineScoreSnapshot } from "./txline-score-ingestion.js";
import { ingestTxlineOddsSnapshot } from "./txline-odds-ingestion.js";
import { ingestTxlineMatchEvents } from "./txline-event-ingestion.js";

export type CompetitionConfig = { competitionId: string; startEpochDay: number };
export type PollPhase = "upcoming" | "prematch" | "live" | "postmatch" | "finished";
export type PollConfig = { leadMinutes: number; tailMinutes: number; upcomingMs: number; prematchMs: number; liveMs: number; postmatchMs: number };
export type SafeRuntimeError = { name: string; code: string; message: string; stage: string };

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
  tailMinutes: envNumber("MATCHPULSE_CAPTURE_TAIL_MINUTES", 180)
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

function utcEpochDay(date: Date): number { return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000); }

export function discoveryEpochDays(now = new Date()): number[] {
  const day = utcEpochDay(now);
  return [day - 1, day, day + 1];
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
  const token = (status ?? "").toLowerCase();
  if (["finished", "final", "ft", "completed", "ended"].includes(token)) return "finished";
  if (["live", "1h", "2h", "ht", "inplay", "in_running", "running"].includes(token)) return "live";
  if (startTime === null) return "upcoming";
  const minutes = (startTime.getTime() - now.getTime()) / 60_000;
  if (minutes > config.leadMinutes) return "upcoming";
  if (minutes > 0) return "prematch";
  if (minutes >= -config.tailMinutes) return "postmatch";
  return "finished";
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
  await getDbClient().$executeRaw(Prisma.sql`UPDATE health_status SET status = 'idle', updated_at = CURRENT_TIMESTAMP, raw = jsonb_build_object('owner_id', ${workerOwnerId}, 'lease_expires_at', CURRENT_TIMESTAMP) WHERE service_name = 'matchpulse-data-worker' AND raw->>'owner_id' = ${workerOwnerId}`);
}

export async function updateWorkerHealth(input: { status: string; lastIngestion?: Date; error?: unknown; errorCount?: number; stage?: string; cycle?: Record<string, unknown> }) {
  const safe = input.error === undefined || input.error === null ? null : safeError(input.error, input.stage ?? "runtime");
  const cycleJson = input.cycle === undefined ? undefined : JSON.parse(JSON.stringify(input.cycle)) as Prisma.InputJsonValue;
  await getDbClient().healthStatus.upsert({
    where: { serviceName: "matchpulse-data-worker" },
    create: { serviceName: "matchpulse-data-worker", status: input.status, lastHeartbeat: new Date(), lastDataReceivedAt: input.lastIngestion ?? null, errorCount: input.errorCount ?? 0, lastError: safe ? JSON.stringify(safe) : null, raw: cycleJson },
    update: { status: input.status, lastHeartbeat: new Date(), ...(input.lastIngestion ? { lastDataReceivedAt: input.lastIngestion } : {}), ...(safe ? { lastError: JSON.stringify(safe) } : {}), ...(input.errorCount === undefined ? {} : { errorCount: input.errorCount }), ...(cycleJson ? { raw: cycleJson } : {}) }
  });
}

export async function runAutomaticIngestionCycle(now = new Date()) {
  const config = automaticRuntimeConfig();
  await updateWorkerHealth({ status: "starting", stage: "startup" });
  const competitions = parseCompetitionConfig();
  if (competitions.length === 0) {
    const error = new Error("No production competition configuration is available.");
    await updateWorkerHealth({ status: "no_data", error, errorCount: 1, stage: "configuration" });
    return { success: 0, failed: 0, activeFixtures: 0, agentEnabled: config.agentEnabled, discoveredCompetitions: 0, nextWakeMs: config.discoveryIntervalMs, status: "no_data" as const };
  }
  const client = createTxlineLiveClient();
  let success = 0;
  let failed = 0;
  let discoveryFailed = 0;
  for (const competition of competitions) {
    for (const startEpochDay of (process.env.MATCHPULSE_COMPETITIONS ? [competition.startEpochDay] : discoveryEpochDays(now))) {
      try { await withProviderRetry(() => ingestTxlineFixtures({ competitionId: competition.competitionId, startEpochDay, includeRaw: false })); } catch { discoveryFailed += 1; }
    }
  }
  const fixtures = await getDbClient().fixture.findMany({ select: { fixtureId: true, startTimeUtc: true, status: true } });
  let nextWakeMs = config.discoveryIntervalMs;
  for (const fixture of fixtures) {
    const phase = pollPhase(fixture.startTimeUtc, fixture.status, now, config);
    if (phase === "finished" || phase === "upcoming") continue;
    nextWakeMs = Math.min(nextWakeMs, cadenceForPhase(phase, config));
    try {
      await withProviderRetry(() => ingestTxlineScoreSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      await withProviderRetry(() => ingestTxlineOddsSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      const historical = await withProviderRetry(() => client.getScoreHistorical({ fixtureId: fixture.fixtureId }));
      const events = extractProviderEvents(historical);
      if (events.length > 0) await ingestTxlineMatchEvents({ fixtureId: fixture.fixtureId, rawEvents: events });
      success += 1;
    } catch { failed += 1; }
  }
  const status = failed === 0 && discoveryFailed === 0 ? "healthy" : success > 0 ? "degraded" : "error";
  await updateWorkerHealth({ status, lastIngestion: success > 0 ? now : undefined, errorCount: failed + discoveryFailed, stage: discoveryFailed > 0 ? "discovery" : failed > 0 ? "ingestion" : "cycle", cycle: { owner_id: workerOwnerId, status, discovery_failed: discoveryFailed, successful_fixture_count: success, failed_fixture_count: failed, active_fixture_count: fixtures.length, last_cycle_finished_at: now.toISOString() } });
  return { success, failed, activeFixtures: fixtures.length, agentEnabled: config.agentEnabled, discoveredCompetitions: competitions.length, discoveryFailed, nextWakeMs, status };
}
