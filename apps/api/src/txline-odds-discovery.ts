import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { normalizeTxlineFixture } from "./txline-normalizer.js";
import { mapTxlineOddsSnapshotToOddsRows } from "./txline-odds-ingestion.js";

const MAX_FIXTURES = 50;
const DEFAULT_LIMIT = 20;
const CHECK_DELAY_MS = 300;
const SAMPLE_LIMIT = 5;
const AS_OF_OFFSETS_MS = [
  7 * 24 * 60 * 60 * 1_000,
  3 * 24 * 60 * 60 * 1_000,
  48 * 60 * 60 * 1_000,
  24 * 60 * 60 * 1_000,
  12 * 60 * 60 * 1_000,
  6 * 60 * 60 * 1_000,
  60 * 60 * 1_000,
  0
] as const;

export type TxlineOddsDiscoveryInput = {
  competitionId: number;
  startEpochDay: number;
  limit?: number;
  includeSamples?: boolean;
};

export type TxlineOddsDiscoveryResult = {
  found: boolean;
  competition_id: number;
  start_epoch_day: number;
  checked_fixtures: number;
  checked_candidates: number;
  candidate: null | {
    fixture_id: string;
    home_team: string;
    away_team: string;
    start_time_utc: string | null;
    as_of: number;
    fetched_count: number;
    mapped_count: number;
    sample: Array<{
      market_id: string;
      market_name: string | null;
      selection_name: string;
      odds: number;
      direction: string;
      source_timestamp: string | null;
    }>;
  };
};

export class TxlineOddsDiscoveryError extends Error {
  constructor(public readonly result: TxlineOddsDiscoveryResult) {
    super("One or more TxLINE odds checks failed during discovery.");
    this.name = "TxlineOddsDiscoveryError";
  }
}

export type TxlineOddsDiscoveryDependencies = {
  fetchFixtures?: (params: {
    competitionId: string;
    startEpochDay: number;
  }) => Promise<unknown>;
  fetchOdds?: (params: { fixtureId: string; asOf: number }) => Promise<unknown>;
  normalizeFixture?: (rawFixture: unknown) => {
    fixture_id: string;
    home_team: string;
    away_team: string;
    start_time_utc: string | null;
  } | null;
  wait?: (ms: number) => Promise<void>;
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildOddsAsOfCandidates(startTimeUtc: string | null): number[] {
  if (typeof startTimeUtc !== "string" || startTimeUtc.trim() === "") return [];

  const startTime = new Date(startTimeUtc).getTime();
  if (!Number.isFinite(startTime)) return [];

  return AS_OF_OFFSETS_MS.map((offset) => startTime - offset);
}

export function normalizeOddsDiscoveryLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_FIXTURES, Math.max(1, Math.trunc(limit)));
}

export async function discoverTxlineOddsAvailability(
  input: TxlineOddsDiscoveryInput,
  dependencies: TxlineOddsDiscoveryDependencies = {}
): Promise<TxlineOddsDiscoveryResult> {
  const fetchFixtures = dependencies.fetchFixtures ??
    ((params) => createTxlineLiveClient().getFixtureSnapshot(params));
  const fetchOdds = dependencies.fetchOdds ??
    ((params) => createTxlineLiveClient().getOddsSnapshot(params));
  const normalizeFixture = dependencies.normalizeFixture ??
    ((rawFixture) => normalizeTxlineFixture(rawFixture, { includeRaw: false }));
  const wait = dependencies.wait ?? delay;
  const limit = normalizeOddsDiscoveryLimit(input.limit);
  const snapshot = await fetchFixtures({
    competitionId: String(input.competitionId),
    startEpochDay: input.startEpochDay
  });
  const rawFixtures = Array.isArray(snapshot) ? snapshot : [];
  const fixtures = rawFixtures
    .map(normalizeFixture)
    .filter((fixture) => fixture !== null)
    .slice(0, limit);
  let checkedFixtures = 0;
  let checkedCandidates = 0;
  let failedCandidates = 0;

  for (const fixture of fixtures) {
    const candidates = buildOddsAsOfCandidates(fixture.start_time_utc);
    if (candidates.length === 0) continue;
    checkedFixtures += 1;

    for (const asOf of candidates) {
      if (checkedCandidates > 0) await wait(CHECK_DELAY_MS);
      checkedCandidates += 1;
      try {
        const snapshot = await fetchOdds({ fixtureId: fixture.fixture_id, asOf });
        const rawOddsItems = Array.isArray(snapshot) ? snapshot : [];
        const mapped = mapTxlineOddsSnapshotToOddsRows(rawOddsItems, {
          fixtureId: fixture.fixture_id,
          includeRaw: false
        });

        if (mapped.rows.length > 0) {
          const sampleSize = input.includeSamples === true ? SAMPLE_LIMIT : 1;
          return {
            found: true,
            competition_id: input.competitionId,
            start_epoch_day: input.startEpochDay,
            checked_fixtures: checkedFixtures,
            checked_candidates: checkedCandidates,
            candidate: {
              fixture_id: fixture.fixture_id,
              home_team: fixture.home_team,
              away_team: fixture.away_team,
              start_time_utc: fixture.start_time_utc,
              as_of: asOf,
              fetched_count: rawOddsItems.length,
              mapped_count: mapped.rows.length,
              sample: mapped.rows.slice(0, sampleSize).map((row) => ({
                market_id: row.marketId,
                market_name: row.marketName,
                selection_name: row.selectionName,
                odds: row.odds,
                direction: row.direction,
                source_timestamp: row.sourceTimestamp?.toISOString() ?? null
              }))
            }
          };
        }
      } catch {
        // A single unavailable fixture/asOf pair must not abort the bounded scan.
        failedCandidates += 1;
      }

    }
  }

  const result: TxlineOddsDiscoveryResult = {
    found: false,
    competition_id: input.competitionId,
    start_epoch_day: input.startEpochDay,
    checked_fixtures: checkedFixtures,
    checked_candidates: checkedCandidates,
    candidate: null
  };

  if (failedCandidates > 0) throw new TxlineOddsDiscoveryError(result);
  return result;
}
