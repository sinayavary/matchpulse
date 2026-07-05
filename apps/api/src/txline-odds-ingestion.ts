import type { Prisma } from "@prisma/client";
import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import {
  isRecord,
  normalizeAsOfToEpochMs,
  parseFixtureId,
  readString
} from "./txline-normalizer.js";

export type TxlineOddsIngestionInput = {
  fixtureId: string;
  asOf?: string | number | null;
  includeRaw?: boolean;
};

export type TxlineOddsRow = {
  fixtureId: string;
  externalSeq: string | null;
  marketId: string;
  marketName: string | null;
  selectionName: string;
  odds: number;
  previousOdds: null;
  changePercent: null;
  direction: "flat" | "unknown";
  sourceTimestamp: Date | null;
  raw?: unknown;
};

export type TxlineOddsIngestionSummary = {
  fetched_count: number;
  mapped_count: number;
  upserted_count: number;
  skipped_count: number;
  failed_count: number;
};

type SafeOddsSnapshot = {
  fixture_id: string;
  market_id: string;
  market_name: string | null;
  selection_name: string;
  odds: number;
  direction: "flat" | "unknown";
  source_timestamp: string | null;
};

type OddsSnapshotWrite = {
  create: Prisma.OddsSnapshotUncheckedCreateInput;
  update?: Prisma.OddsSnapshotUncheckedUpdateInput;
  where?: Prisma.OddsSnapshotWhereUniqueInput;
};

type IngestionDependencies = {
  fetchOdds?: (params: { fixtureId: string; asOf: number }) => Promise<unknown>;
  writeOddsSnapshot?: (write: OddsSnapshotWrite) => Promise<unknown>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function stableValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object" || value === null) return null;

  try {
    return JSON.stringify(canonicalize(value));
  } catch {
    return null;
  }
}

function optionalString(value: unknown): string | null {
  return readString(value) ??
    (typeof value === "number" && Number.isFinite(value) ? String(value) : null);
}

function epochMsToDate(value: unknown): Date | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1_000_000_000_000
  ) return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return undefined;
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export function buildOddsMarketId(rawOdds: unknown): string {
  if (!isRecord(rawOdds)) return "unknown";

  const parts = [
    ["bookmaker", stableValue(rawOdds.bookmakerId)],
    ["type", stableValue(rawOdds.superOddsType)],
    ["period", stableValue(rawOdds.marketPeriod)],
    ["parameters", stableValue(rawOdds.marketParameters)]
  ]
    .filter((part): part is [string, string] => part[1] !== null)
    .map(([key, value]) => `${key}:${value}`);

  return parts.length > 0 ? parts.join("|") : "unknown";
}

export function mapTxlineOddsSnapshotToOddsRows(
  rawOddsItems: unknown[],
  options: { fixtureId: string; includeRaw?: boolean }
): { rows: TxlineOddsRow[]; skipped_count: number } {
  const rows: TxlineOddsRow[] = [];
  let skippedCount = 0;

  for (const rawOdds of rawOddsItems) {
    if (!isRecord(rawOdds) || !Array.isArray(rawOdds.prices)) {
      skippedCount += 1;
      continue;
    }

    const priceNames = Array.isArray(rawOdds.priceNames) ? rawOdds.priceNames : [];
    const raw = options.includeRaw ? rawOdds : undefined;
    for (let index = 0; index < rawOdds.prices.length; index += 1) {
      const odds = rawOdds.prices[index];
      if (typeof odds !== "number" || !Number.isFinite(odds)) {
        skippedCount += 1;
        continue;
      }

      rows.push({
        fixtureId: options.fixtureId,
        externalSeq: optionalString(rawOdds.messageId),
        marketId: buildOddsMarketId(rawOdds),
        marketName: optionalString(rawOdds.superOddsType),
        selectionName: readString(priceNames[index]) ?? `selection_${index}`,
        odds,
        previousOdds: null,
        changePercent: null,
        direction: "flat",
        sourceTimestamp: epochMsToDate(rawOdds.ts),
        ...(raw === undefined ? {} : { raw })
      });
    }
  }

  return { rows, skipped_count: skippedCount };
}

function toSafeSnapshot(row: TxlineOddsRow): SafeOddsSnapshot {
  return {
    fixture_id: row.fixtureId,
    market_id: row.marketId,
    market_name: row.marketName,
    selection_name: row.selectionName,
    odds: row.odds,
    direction: row.direction,
    source_timestamp: row.sourceTimestamp?.toISOString() ?? null
  };
}

function toWrite(row: TxlineOddsRow): OddsSnapshotWrite {
  const raw = Object.prototype.hasOwnProperty.call(row, "raw") ? safeJson(row.raw) : undefined;
  const values: Prisma.OddsSnapshotUncheckedCreateInput = {
    fixtureId: row.fixtureId,
    externalSeq: row.externalSeq,
    marketId: row.marketId,
    marketName: row.marketName,
    selectionName: row.selectionName,
    odds: row.odds,
    previousOdds: null,
    changePercent: null,
    direction: row.direction,
    sourceTimestamp: row.sourceTimestamp,
    ...(raw === undefined ? {} : { raw })
  };

  if (row.externalSeq === null) return { create: values };

  const update: Prisma.OddsSnapshotUncheckedUpdateInput = {
    odds: row.odds,
    marketName: row.marketName,
    previousOdds: null,
    changePercent: null,
    direction: row.direction,
    sourceTimestamp: row.sourceTimestamp,
    ...(raw === undefined ? {} : { raw })
  };
  return {
    where: {
      fixtureId_externalSeq_marketId_selectionName: {
        fixtureId: row.fixtureId,
        externalSeq: row.externalSeq,
        marketId: row.marketId,
        selectionName: row.selectionName
      }
    },
    create: values,
    update
  };
}

async function defaultWriteOddsSnapshot(write: OddsSnapshotWrite) {
  if (write.where !== undefined && write.update !== undefined) {
    return getDbClient().oddsSnapshot.upsert({
      where: write.where,
      create: write.create,
      update: write.update
    });
  }
  return getDbClient().oddsSnapshot.create({ data: write.create });
}

export async function ingestTxlineOddsSnapshot(
  input: TxlineOddsIngestionInput,
  dependencies: IngestionDependencies = {}
): Promise<{
  requested: { fixture_id: string; as_of: string };
  result: TxlineOddsIngestionSummary;
  odds_snapshots: SafeOddsSnapshot[];
}> {
  const fixtureId = parseFixtureId(input.fixtureId);
  const rawAsOf = input.asOf ?? Date.now();
  const asOf = normalizeAsOfToEpochMs(String(rawAsOf));
  if (fixtureId === null || asOf === null) {
    throw new TypeError("fixtureId and a valid asOf value are required.");
  }

  const fetchOdds = dependencies.fetchOdds ??
    ((params) => createTxlineLiveClient().getOddsSnapshot(params));
  const writeOddsSnapshot = dependencies.writeOddsSnapshot ?? defaultWriteOddsSnapshot;
  const snapshot = await fetchOdds({ fixtureId, asOf: Number(asOf) });
  const rawOddsItems = Array.isArray(snapshot) ? snapshot : [];
  const mapped = mapTxlineOddsSnapshotToOddsRows(rawOddsItems, {
    fixtureId,
    includeRaw: input.includeRaw === true
  });
  const result: TxlineOddsIngestionSummary = {
    fetched_count: rawOddsItems.length,
    mapped_count: mapped.rows.length,
    upserted_count: 0,
    skipped_count: mapped.skipped_count,
    failed_count: 0
  };
  const storedRows: TxlineOddsRow[] = [];

  for (const row of mapped.rows) {
    try {
      await writeOddsSnapshot(toWrite(row));
      result.upserted_count += 1;
      storedRows.push(row);
    } catch {
      result.failed_count += 1;
    }
  }

  return {
    requested: { fixture_id: fixtureId, as_of: asOf },
    result,
    odds_snapshots: storedRows.map(toSafeSnapshot)
  };
}

export async function getDbOddsSnapshotsByFixtureId(fixtureId: string): Promise<{
  found: boolean;
  count: number;
  odds_snapshots: Array<{
    fixture_id: string;
    market_id: string;
    market_name: string | null;
    selection_name: string;
    odds: number;
    direction: string;
    source_timestamp: string | null;
  }>;
}> {
  const rows = await getDbClient().oddsSnapshot.findMany({
    where: { fixtureId },
    orderBy: [{ sourceTimestamp: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      fixtureId: true,
      marketId: true,
      marketName: true,
      selectionName: true,
      odds: true,
      direction: true,
      sourceTimestamp: true
    }
  });
  const snapshots = rows.map((row) => ({
    fixture_id: row.fixtureId,
    market_id: row.marketId,
    market_name: row.marketName,
    selection_name: row.selectionName,
    odds: row.odds.toNumber(),
    direction: row.direction,
    source_timestamp: row.sourceTimestamp?.toISOString() ?? null
  }));

  return {
    found: snapshots.length > 0,
    count: snapshots.length,
    odds_snapshots: snapshots
  };
}
