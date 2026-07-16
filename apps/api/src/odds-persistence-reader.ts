export type PersistedOddsRow = {
  id: string;
  fixtureId: string;
  marketId: string;
  marketName: string | null;
  selectionName: string;
  odds: number | { toNumber(): number };
  previousOdds: number | { toNumber(): number } | null;
  changePercent: number | { toNumber(): number } | null;
  direction: string;
  sourceTimestamp: Date | null;
  createdAt: Date;
};

export type OddsReaderDatabase = { oddsSnapshot: { findMany(args: unknown): Promise<PersistedOddsRow[]> } };
export type OddsRead = { fixture_id: string; market_id: string; market_name: string | null; selection_name: string; odds: number; previous_odds: number | null; change_percent: number | null; direction: string; source_timestamp: string | null; created_at: string };

function decimal(value: number | { toNumber(): number } | null): number | null { if (value === null) return null; const result = typeof value === "number" ? value : value.toNumber(); return Number.isFinite(result) ? result : null; }
function fixture(value: unknown): string { if (typeof value !== "string" || value.trim() === "") throw new TypeError("fixture_id must be non-empty."); return value.trim(); }

export function buildOddsReaderQuery(fixtureId: string, asOf?: Date, limit = 100): Record<string, unknown> {
  const take = Math.min(500, Math.max(1, Math.trunc(limit))); const where: Record<string, unknown> = { fixtureId: fixture(fixtureId) };
  if (asOf !== undefined) where.sourceTimestamp = { lte: asOf };
  return { where, orderBy: [{ sourceTimestamp: "asc" }, { createdAt: "asc" }, { id: "asc" }], take };
}

export async function readOddsSnapshots(db: OddsReaderDatabase, options: { fixtureId: string; asOf?: Date; limit?: number }): Promise<OddsRead[]> {
  const rows = await db.oddsSnapshot.findMany(buildOddsReaderQuery(options.fixtureId, options.asOf, options.limit));
  return rows.map((row) => ({ fixture_id: row.fixtureId, market_id: row.marketId, market_name: row.marketName, selection_name: row.selectionName,
    odds: decimal(row.odds) ?? 0, previous_odds: decimal(row.previousOdds), change_percent: decimal(row.changePercent), direction: row.direction,
    source_timestamp: row.sourceTimestamp?.toISOString() ?? null, created_at: row.createdAt.toISOString() }));
}
