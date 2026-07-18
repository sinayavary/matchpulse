import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { normalizeTxlineFixture } from "./txline-normalizer.js";
import { buildOddsAsOfCandidates } from "./txline-odds-discovery.js";
import { mapTxlineOddsSnapshotToOddsRows } from "./txline-odds-ingestion.js";

const DEFAULT_COMPETITION_ID = 72;
const DEFAULT_BACKFILL_DAYS = 1;
const DEFAULT_FUTURE_DAYS = 14;
const DEFAULT_LIMIT_PER_DAY = 10;
const MAX_DAYS = 31;
const MAX_LIMIT_PER_DAY = 20;
const MAX_CANDIDATE_CHECKS = 800;
const CHECK_DELAY_MS = 300;
const SAMPLE_LIMIT = 5;

type RawResponseType = "array" | "object" | "null" | "unknown";

export type SafeOddsRawDiagnostics = {
  raw_response_type: RawResponseType;
  raw_items_count: number;
  first_item_keys: string[];
  has_prices_array: boolean;
  prices_length: number | null;
  has_price_names_array: boolean;
  price_names_length: number | null;
  has_bookmaker: boolean;
  has_super_odds_type: boolean;
  has_message_id: boolean;
  has_ts: boolean;
};

export type NormalizedDiscoveryWindowInput = {
  competitionId: number;
  startEpochDayFrom: number;
  startEpochDayTo: number;
  limitPerDay: number;
  includeDiagnostics: boolean;
};

export type TxlineOddsDiscoveryWindowCandidate = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  start_time_utc: string | null;
  start_epoch_day: number;
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
  diagnostics?: SafeOddsRawDiagnostics;
};

export type TxlineOddsDiscoveryWindowResult = {
  found: boolean;
  reason:
    | "mapped_odds_found"
    | "raw_odds_shape_seen_but_not_mapped"
    | "no_odds_found";
  competition_id: number;
  start_epoch_day_from: number;
  start_epoch_day_to: number;
  checked_days: number;
  checked_fixtures: number;
  checked_candidates: number;
  error_count: number;
  candidate: TxlineOddsDiscoveryWindowCandidate | null;
};

type DiscoveryWindowInput = Partial<{
  competitionId: unknown;
  startEpochDayFrom: unknown;
  startEpochDayTo: unknown;
  limitPerDay: unknown;
  includeDiagnostics: unknown;
}>;

export type TxlineOddsDiscoveryWindowDependencies = {
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

function toNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function envPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function currentUtcEpochDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function normalizeDiscoveryWindowInput(
  input: DiscoveryWindowInput = {}
): NormalizedDiscoveryWindowInput {
  const competitionId = toNonNegativeInteger(input.competitionId, DEFAULT_COMPETITION_ID);
  const today = currentUtcEpochDay();
  const defaultBackfill = envPositiveInteger("MATCHPULSE_DISCOVERY_BACKFILL_DAYS", DEFAULT_BACKFILL_DAYS);
  const defaultFuture = envPositiveInteger("MATCHPULSE_DISCOVERY_FUTURE_DAYS", DEFAULT_FUTURE_DAYS);
  const startEpochDayFrom = toNonNegativeInteger(
    input.startEpochDayFrom,
    Math.max(0, today - defaultBackfill)
  );
  const requestedTo = toNonNegativeInteger(
    input.startEpochDayTo,
    today + defaultFuture
  );
  const startEpochDayTo = Math.min(
    Math.max(startEpochDayFrom, requestedTo),
    startEpochDayFrom + MAX_DAYS - 1
  );
  const limitPerDay = Math.min(
    MAX_LIMIT_PER_DAY,
    toPositiveInteger(input.limitPerDay, DEFAULT_LIMIT_PER_DAY)
  );
  const includeDiagnostics = input.includeDiagnostics === undefined
    ? true
    : input.includeDiagnostics === true || input.includeDiagnostics === "true";

  return {
    competitionId,
    startEpochDayFrom,
    startEpochDayTo,
    limitPerDay,
    includeDiagnostics
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildSafeOddsRawDiagnostics(raw: unknown): SafeOddsRawDiagnostics {
  const rawResponseType: RawResponseType = raw === null
    ? "null"
    : Array.isArray(raw)
      ? "array"
      : isRecord(raw)
        ? "object"
        : "unknown";
  const firstItem = Array.isArray(raw) ? raw[0] : raw;
  const item = isRecord(firstItem) ? firstItem : null;
  const prices = item !== null
    ? Array.isArray(item.prices)
      ? item.prices
      : Array.isArray(item.Prices)
        ? item.Prices
        : null
    : null;
  const priceNames = item !== null
    ? Array.isArray(item.priceNames)
      ? item.priceNames
      : Array.isArray(item.PriceNames)
        ? item.PriceNames
        : null
    : null;
  const hasEitherKey = (camelCaseKey: string, pascalCaseKey: string) => item !== null && (
    Object.prototype.hasOwnProperty.call(item, camelCaseKey) ||
    Object.prototype.hasOwnProperty.call(item, pascalCaseKey)
  );

  return {
    raw_response_type: rawResponseType,
    raw_items_count: Array.isArray(raw) ? raw.length : isRecord(raw) ? 1 : 0,
    first_item_keys: item === null ? [] : Object.keys(item).sort(),
    has_prices_array: prices !== null,
    prices_length: prices?.length ?? null,
    has_price_names_array: priceNames !== null,
    price_names_length: priceNames?.length ?? null,
    has_bookmaker: hasEitherKey("bookmaker", "Bookmaker"),
    has_super_odds_type: hasEitherKey("superOddsType", "SuperOddsType"),
    has_message_id: hasEitherKey("messageId", "MessageId"),
    has_ts: hasEitherKey("ts", "Ts")
  };
}

function hasRawOddsLikeShape(diagnostics: SafeOddsRawDiagnostics): boolean {
  return diagnostics.raw_items_count > 0 && (
    diagnostics.first_item_keys.length > 0 ||
    diagnostics.has_prices_array ||
    diagnostics.has_price_names_array
  );
}

function toCandidate(
  fixture: {
    fixture_id: string;
    home_team: string;
    away_team: string;
    start_time_utc: string | null;
  },
  startEpochDay: number,
  asOf: number,
  raw: unknown,
  includeDiagnostics: boolean
): TxlineOddsDiscoveryWindowCandidate {
  const rawOddsItems = Array.isArray(raw) ? raw : [];
  const mapped = mapTxlineOddsSnapshotToOddsRows(rawOddsItems, {
    fixtureId: fixture.fixture_id,
    includeRaw: false
  });
  const diagnostics = buildSafeOddsRawDiagnostics(raw);

  return {
    fixture_id: fixture.fixture_id,
    home_team: fixture.home_team,
    away_team: fixture.away_team,
    start_time_utc: fixture.start_time_utc,
    start_epoch_day: startEpochDay,
    as_of: asOf,
    fetched_count: diagnostics.raw_items_count,
    mapped_count: mapped.rows.length,
    sample: mapped.rows.slice(0, SAMPLE_LIMIT).map((row) => ({
      market_id: row.marketId,
      market_name: row.marketName,
      selection_name: row.selectionName,
      odds: row.odds,
      direction: row.direction,
      source_timestamp: row.sourceTimestamp?.toISOString() ?? null
    })),
    ...(includeDiagnostics ? { diagnostics } : {})
  };
}

export async function discoverTxlineOddsAvailabilityWindow(
  rawInput: DiscoveryWindowInput,
  dependencies: TxlineOddsDiscoveryWindowDependencies = {}
): Promise<TxlineOddsDiscoveryWindowResult> {
  const input = normalizeDiscoveryWindowInput(rawInput);
  const liveClient = dependencies.fetchFixtures !== undefined && dependencies.fetchOdds !== undefined
    ? null
    : createTxlineLiveClient();
  const fetchFixtures = dependencies.fetchFixtures ??
    ((params) => liveClient!.getFixtureSnapshot(params));
  const fetchOdds = dependencies.fetchOdds ??
    ((params) => liveClient!.getOddsSnapshot(params));
  const normalizeFixture = dependencies.normalizeFixture ??
    ((rawFixture) => normalizeTxlineFixture(rawFixture, { includeRaw: false }));
  const wait = dependencies.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let checkedDays = 0;
  let checkedFixtures = 0;
  let checkedCandidates = 0;
  let errorCount = 0;
  let firstUnmappedCandidate: TxlineOddsDiscoveryWindowCandidate | null = null;

  for (
    let startEpochDay = input.startEpochDayFrom;
    startEpochDay <= input.startEpochDayTo && checkedCandidates < MAX_CANDIDATE_CHECKS;
    startEpochDay += 1
  ) {
    checkedDays += 1;
    let snapshot: unknown;
    try {
      snapshot = await fetchFixtures({
        competitionId: String(input.competitionId),
        startEpochDay
      });
    } catch {
      errorCount += 1;
      continue;
    }

    const rawFixtures = Array.isArray(snapshot) ? snapshot.slice(0, input.limitPerDay) : [];
    for (const rawFixture of rawFixtures) {
      let fixture: ReturnType<typeof normalizeFixture>;
      try {
        fixture = normalizeFixture(rawFixture);
      } catch {
        errorCount += 1;
        continue;
      }
      if (fixture === null) continue;

      const asOfCandidates = buildOddsAsOfCandidates(fixture.start_time_utc);
      if (asOfCandidates.length === 0) continue;
      checkedFixtures += 1;

      for (const asOf of asOfCandidates) {
        if (checkedCandidates >= MAX_CANDIDATE_CHECKS) break;
        if (checkedCandidates > 0) await wait(CHECK_DELAY_MS);
        checkedCandidates += 1;

        try {
          const rawOdds = await fetchOdds({ fixtureId: fixture.fixture_id, asOf });
          const candidate = toCandidate(
            fixture,
            startEpochDay,
            asOf,
            rawOdds,
            input.includeDiagnostics
          );
          if (candidate.mapped_count > 0) {
            return {
              found: true,
              reason: "mapped_odds_found",
              competition_id: input.competitionId,
              start_epoch_day_from: input.startEpochDayFrom,
              start_epoch_day_to: input.startEpochDayTo,
              checked_days: checkedDays,
              checked_fixtures: checkedFixtures,
              checked_candidates: checkedCandidates,
              error_count: errorCount,
              candidate
            };
          }

          const diagnostics = buildSafeOddsRawDiagnostics(rawOdds);
          if (firstUnmappedCandidate === null && hasRawOddsLikeShape(diagnostics)) {
            firstUnmappedCandidate = candidate;
          }
        } catch {
          errorCount += 1;
        }
      }
    }
  }

  return {
    found: false,
    reason: firstUnmappedCandidate === null
      ? "no_odds_found"
      : "raw_odds_shape_seen_but_not_mapped",
    competition_id: input.competitionId,
    start_epoch_day_from: input.startEpochDayFrom,
    start_epoch_day_to: input.startEpochDayTo,
    checked_days: checkedDays,
    checked_fixtures: checkedFixtures,
    checked_candidates: checkedCandidates,
    error_count: errorCount,
    candidate: firstUnmappedCandidate
  };
}
