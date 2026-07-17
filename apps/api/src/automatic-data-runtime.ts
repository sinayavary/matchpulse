import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import { ingestTxlineFixtures } from "./txline-fixture-ingestion.js";
import { ingestTxlineScoreSnapshot } from "./txline-score-ingestion.js";
import { ingestTxlineOddsSnapshot } from "./txline-odds-ingestion.js";
import { ingestTxlineMatchEvents } from "./txline-event-ingestion.js";

export type CompetitionConfig = { competitionId: string; startEpochDay: number };
export type PollPhase = "upcoming" | "prematch" | "live" | "postmatch" | "finished";
export type PollConfig = { leadMinutes: number; tailMinutes: number; upcomingMs: number; prematchMs: number; liveMs: number; postmatchMs: number };

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

export function parseCompetitionConfig(value = process.env.MATCHPULSE_COMPETITIONS): CompetitionConfig[] {
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
  const result = await getDbClient().$queryRawUnsafe<Array<{ locked: boolean }>>("SELECT pg_try_advisory_lock(8142391201) AS locked");
  return result[0]?.locked === true;
}

export async function releaseWorkerLock(): Promise<void> {
  await getDbClient().$queryRawUnsafe("SELECT pg_advisory_unlock(8142391201)");
}

export async function updateWorkerHealth(input: { status: string; lastIngestion?: Date; error?: string | null; errorCount?: number }) {
  await getDbClient().healthStatus.upsert({
    where: { serviceName: "matchpulse-data-worker" },
    create: { serviceName: "matchpulse-data-worker", status: input.status, lastHeartbeat: new Date(), lastDataReceivedAt: input.lastIngestion ?? null, errorCount: input.errorCount ?? 0, lastError: input.error?.slice(0, 300) ?? null },
    update: { status: input.status, lastHeartbeat: new Date(), ...(input.lastIngestion ? { lastDataReceivedAt: input.lastIngestion } : {}), ...(input.error !== undefined ? { lastError: input.error?.slice(0, 300) ?? null } : {}), ...(input.errorCount === undefined ? {} : { errorCount: input.errorCount }) }
  });
}

export async function runAutomaticIngestionCycle(now = new Date()) {
  const config = automaticRuntimeConfig();
  const competitions = parseCompetitionConfig();
  if (competitions.length === 0) throw new Error("No production competition configuration is available.");
  const client = createTxlineLiveClient();
  let success = 0;
  let failed = 0;
  for (const competition of competitions) {
    await withProviderRetry(() => ingestTxlineFixtures({ competitionId: competition.competitionId, startEpochDay: competition.startEpochDay, includeRaw: false }));
  }
  const fixtures = await getDbClient().fixture.findMany({ select: { fixtureId: true, startTimeUtc: true, status: true } });
  for (const fixture of fixtures) {
    const phase = pollPhase(fixture.startTimeUtc, fixture.status, now, config);
    if (phase === "finished") continue;
    try {
      await withProviderRetry(() => ingestTxlineScoreSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      await withProviderRetry(() => ingestTxlineOddsSnapshot({ fixtureId: fixture.fixtureId, asOf: now.getTime(), includeRaw: false }));
      const historical = await withProviderRetry(() => client.getScoreHistorical({ fixtureId: fixture.fixtureId }));
      const events = extractProviderEvents(historical);
      if (events.length > 0) await ingestTxlineMatchEvents({ fixtureId: fixture.fixtureId, rawEvents: events });
      success += 1;
    } catch { failed += 1; }
  }
  await updateWorkerHealth({ status: failed === 0 ? "healthy" : success > 0 ? "degraded" : "error", lastIngestion: success > 0 ? now : undefined, errorCount: failed });
  return { success, failed, activeFixtures: fixtures.length, agentEnabled: config.agentEnabled, discoveredCompetitions: competitions.length };
}
