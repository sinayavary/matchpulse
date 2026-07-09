import { getDbClient } from "./db.js";
import {
  PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE,
  assertNoForbiddenProductIntelligenceFields,
  createProductIntelligenceSignal,
  type ProductIntelligenceSignal
} from "./product-intelligence-contract.js";

export type OddsReliabilityStatus = "unavailable" | "limited" | "available";

export type StoredOddsReliabilityRow = {
  market_id?: string | null;
  selection_name?: string | null;
  source_timestamp?: string | number | Date | null;
  provider_id?: string | null;
  source_label?: string | null;
};

export type AssessStoredOddsReliabilityInput = {
  fixture_id: string;
  odds_rows?: Array<StoredOddsReliabilityRow & Record<string, unknown>>;
  reference_time?: string | number | Date | null;
};

export type OddsReliabilityAssessment = {
  status: OddsReliabilityStatus;
  source: "database";
  fixture_id: string;
  snapshot_count: number;
  market_count: number;
  provider_count: number;
  latest_timestamp: string | null;
  limitations: string[];
  signals: ProductIntelligenceSignal[];
  safe_scope_note: string;
};

export type OddsReliabilityDependencies = {
  fetchOddsRows?: (fixtureId: string) => Promise<Array<StoredOddsReliabilityRow & Record<string, unknown>>>;
  now?: () => Date;
};

const MIN_SNAPSHOT_COUNT = 10;
const MIN_MARKET_COUNT = 5;
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }

  return null;
}

function toIsoTimestamp(value: unknown): string | null {
  const time = parseTimestamp(value);
  return time === null ? null : new Date(time).toISOString();
}

function getProviderKey(row: StoredOddsReliabilityRow): string | null {
  if (isNonEmptyString(row.provider_id)) return row.provider_id.trim();
  if (isNonEmptyString(row.source_label)) return row.source_label.trim();
  return null;
}

function buildSignals(input: {
  fixture_id: string;
  status: OddsReliabilityStatus;
  snapshot_count: number;
  market_count: number;
  provider_count: number;
  latest_timestamp: string | null;
  limitations: string[];
}): ProductIntelligenceSignal[] {
  const signals: ProductIntelligenceSignal[] = [];
  const availabilitySeverity =
    input.status === "unavailable"
      ? "critical"
      : input.status === "limited"
        ? "warning"
        : "info";

  signals.push(
    createProductIntelligenceSignal({
      category: "MARKET_DATA_AVAILABILITY",
      severity: availabilitySeverity,
      title: input.status === "unavailable"
        ? "Stored odds data unavailable"
        : "Stored odds data available",
      message: input.status === "unavailable"
        ? "No stored odds snapshots are available for this fixture."
        : "Stored odds snapshots are available for this fixture.",
      evidence_count: input.snapshot_count,
      source: "database",
      safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
    })
  );

  if (input.status !== "unavailable") {
    signals.push(
      createProductIntelligenceSignal({
        category: "DATA_QUALITY",
        severity: input.limitations.length > 0 ? "warning" : "info",
        title: "Stored odds quality assessed",
        message: input.limitations.length > 0
          ? "Stored odds data is present, but quality limitations were detected."
          : "Stored odds data passes the baseline quality checks.",
        evidence_count: input.market_count,
        source: "database",
        safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
      })
    );

    signals.push(
      createProductIntelligenceSignal({
        category: "RUNTIME_FRESHNESS",
        severity:
          input.latest_timestamp === null || input.limitations.some((limitation) =>
            limitation.toLowerCase().includes("freshness")
          )
            ? "warning"
            : "info",
        title: "Stored odds freshness assessed",
        message: input.latest_timestamp === null
          ? "No stored odds timestamp is available for freshness checks."
          : "Stored odds freshness was evaluated from the latest timestamp.",
        evidence_count: input.latest_timestamp === null ? 0 : 1,
        source: "database",
        safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
      })
    );
  }

  return signals;
}

function collectLimitations(input: {
  snapshot_count: number;
  market_count: number;
  provider_count: number;
  latest_timestamp: string | null;
  stale: boolean;
  missing_market_identifiers: number;
}): string[] {
  const limitations: string[] = [];

  if (input.snapshot_count < MIN_SNAPSHOT_COUNT) {
    limitations.push(`Low snapshot count; only ${input.snapshot_count} stored odds snapshots were found.`);
  }

  if (input.market_count < MIN_MARKET_COUNT) {
    limitations.push(`Low market coverage; only ${input.market_count} distinct markets were mapped.`);
  }

  if (input.latest_timestamp === null) {
    limitations.push("No stored odds timestamp is available for freshness checks.");
  } else if (input.stale) {
    limitations.push("Stored odds data is older than the freshness window.");
  }

  if (input.missing_market_identifiers > 0) {
    limitations.push("Some stored odds rows are missing required market identifiers.");
  }

  if (input.provider_count <= 1 && input.snapshot_count > 0) {
    limitations.push("Limited source diversity; this does not represent broad bookmaker consensus.");
  }

  return limitations;
}

export function assessStoredOddsReliability(
  input: AssessStoredOddsReliabilityInput
): OddsReliabilityAssessment {
  const rows = input.odds_rows ?? [];
  const snapshot_count = rows.length;
  const marketIds = new Set<string>();
  const providerKeys = new Set<string>();
  let missing_market_identifiers = 0;
  let latestTimestamp: string | null = null;
  let latestTimeMs: number | null = null;

  for (const row of rows) {
    const marketId = isNonEmptyString(row.market_id) ? row.market_id.trim() : null;
    if (marketId === null) {
      missing_market_identifiers += 1;
    } else {
      marketIds.add(marketId);
    }

    const providerKey = getProviderKey(row);
    if (providerKey !== null) providerKeys.add(providerKey);

    const rowTimestamp = parseTimestamp(row.source_timestamp);
    if (rowTimestamp !== null && (latestTimeMs === null || rowTimestamp > latestTimeMs)) {
      latestTimeMs = rowTimestamp;
      latestTimestamp = new Date(rowTimestamp).toISOString();
    }
  }

  const market_count = marketIds.size;
  const provider_count = providerKeys.size > 0
    ? providerKeys.size
    : snapshot_count > 0
      ? 1
      : 0;
  const referenceTimeMs = parseTimestamp(input.reference_time ?? null) ?? Date.now();
  const stale = latestTimeMs === null
    ? false
    : referenceTimeMs - latestTimeMs > DEFAULT_STALE_AFTER_MS;

  const limitations = collectLimitations({
    snapshot_count,
    market_count,
    provider_count,
    latest_timestamp: latestTimestamp,
    stale,
    missing_market_identifiers
  });

  const status: OddsReliabilityStatus =
    snapshot_count === 0
      ? "unavailable"
      : limitations.some((limitation) =>
          limitation.startsWith("Low snapshot count") ||
          limitation.startsWith("Low market coverage") ||
          limitation.startsWith("No stored odds timestamp") ||
          limitation.startsWith("Stored odds data is older") ||
          limitation.startsWith("Some stored odds rows")
        )
        ? "limited"
        : "available";

  const assessment: OddsReliabilityAssessment = {
    status,
    source: "database",
    fixture_id: input.fixture_id,
    snapshot_count,
    market_count,
    provider_count,
    latest_timestamp: latestTimestamp,
    limitations,
    signals: buildSignals({
      fixture_id: input.fixture_id,
      status,
      snapshot_count,
      market_count,
      provider_count,
      latest_timestamp: latestTimestamp,
      limitations
    }),
    safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
  };

  assertNoForbiddenProductIntelligenceFields(assessment);
  return assessment;
}

export async function getOddsReliabilityAssessmentForFixture(
  fixtureId: string,
  dependencies: OddsReliabilityDependencies = {}
): Promise<OddsReliabilityAssessment> {
  const fetchOddsRows = dependencies.fetchOddsRows ?? (async (id: string) => {
    const rows = await getDbClient().oddsSnapshot.findMany({
      where: { fixtureId: id },
      orderBy: [{ sourceTimestamp: "desc" }, { createdAt: "desc" }],
      select: {
        marketId: true,
        selectionName: true,
        sourceTimestamp: true
      }
    });

    return rows.map((row) => ({
      market_id: row.marketId,
      selection_name: row.selectionName,
      source_timestamp: row.sourceTimestamp?.toISOString() ?? null
    }));
  });

  const rows = await fetchOddsRows(fixtureId).catch(() => []);
  return assessStoredOddsReliability({
    fixture_id: fixtureId,
    odds_rows: rows,
    reference_time: dependencies.now?.() ?? new Date()
  });
}
