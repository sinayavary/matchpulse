export const PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES = [
  "DATA_QUALITY",
  "RUNTIME_FRESHNESS",
  "MARKET_DATA_AVAILABILITY",
  "PRESSURE_CONTEXT",
  "VERIFICATION_STATUS",
  "PRODUCT_READINESS"
] as const;

export const PRODUCT_INTELLIGENCE_ALLOWED_SEVERITIES = [
  "info",
  "warning",
  "critical"
] as const;

export const PRODUCT_INTELLIGENCE_ALLOWED_SOURCES = [
  "database",
  "txline",
  "signalcore",
  "verification",
  "runtime"
] as const;

export const PRODUCT_INTELLIGENCE_FORBIDDEN_OUTPUT_FIELDS = [
  "probability",
  "prediction",
  "confidence",
  "winner",
  "edge",
  "expected_value",
  "recommended_bet",
  "bet",
  "wager",
  "stake",
  "profit",
  "payout",
  "wallet",
  "deposit",
  "formula",
  "raw_payload",
  "debug_lineage"
] as const;

export const PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE =
  "MatchPulse product intelligence describes data quality, freshness, availability, pressure context, and verification status. It does not provide predictions, probabilities, betting recommendations, expected value, or wagering instructions.";

export type ProductIntelligenceCategory =
  typeof PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES[number];

export type ProductIntelligenceSeverity =
  typeof PRODUCT_INTELLIGENCE_ALLOWED_SEVERITIES[number];

export type ProductIntelligenceSource =
  typeof PRODUCT_INTELLIGENCE_ALLOWED_SOURCES[number];

export type ProductIntelligenceSignal = {
  category: ProductIntelligenceCategory;
  severity: ProductIntelligenceSeverity;
  title: string;
  message: string;
  evidence_count?: number;
  source: ProductIntelligenceSource;
  safe_scope_note: string;
};

export type ProductIntelligenceContract = {
  version: "v0-contract";
  allowed_categories: readonly ProductIntelligenceCategory[];
  allowed_severities: readonly ProductIntelligenceSeverity[];
  allowed_sources: readonly ProductIntelligenceSource[];
  forbidden_output_fields: readonly string[];
  safe_scope_note: string;
};

const forbiddenOutputFields = new Set<string>(PRODUCT_INTELLIGENCE_FORBIDDEN_OUTPUT_FIELDS);

export function getProductIntelligenceContract(): ProductIntelligenceContract {
  return {
    version: "v0-contract",
    allowed_categories: [...PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES],
    allowed_severities: [...PRODUCT_INTELLIGENCE_ALLOWED_SEVERITIES],
    allowed_sources: [...PRODUCT_INTELLIGENCE_ALLOWED_SOURCES],
    forbidden_output_fields: [...PRODUCT_INTELLIGENCE_FORBIDDEN_OUTPUT_FIELDS],
    safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
  };
}

export function createProductIntelligenceSignal(
  signal: ProductIntelligenceSignal
): ProductIntelligenceSignal {
  return signal;
}

export function assertNoForbiddenProductIntelligenceFields(value: unknown): void {
  const visited = new WeakSet<object>();

  function inspect(current: unknown, path: string): void {
    if (current === null || typeof current !== "object") return;
    if (visited.has(current)) return;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      const fieldPath = path ? `${path}.${key}` : key;
      if (forbiddenOutputFields.has(normalizedKey)) {
        throw new TypeError(`Forbidden ProductIntelligence output field: ${fieldPath}`);
      }
      inspect(nestedValue, fieldPath);
    }
  }

  inspect(value, "");
}
