import type { ProductAgentV1Insight, ProductAgentV1Response } from "./product-agent-v1.js";

export const PRODUCT_AGENT_INTERNAL_ROUTE_PATH =
  "/api/internal/product-agent/matches/:fixtureId/insight" as const;

export const PRODUCT_AGENT_INTERNAL_ALLOWED_QUERY_PARAMS = [
  "staleAfterMinutes",
  "oddsLimit",
  "includeEventImpact",
  "includeOddsReliability"
] as const;

export const PRODUCT_AGENT_INTERNAL_FORBIDDEN_FIELDS = [
  "prediction",
  "probability",
  "confidence",
  "winner",
  "recommended_bet",
  "bet",
  "expected_value",
  "ev",
  "edge",
  "wager",
  "stake",
  "profit",
  "payout",
  "wallet",
  "deposit",
  "formula",
  "raw",
  "raw_payload",
  "debug",
  "debug_lineage",
  "internal_context",
  "stack",
  "secret",
  "token",
  "api_key"
] as const;

export type ProductAgentInternalRouteQuery = {
  includeEventImpact: boolean;
  includeOddsReliability: boolean;
  staleAfterMinutes: number;
  oddsLimit: number;
};

export type ProductAgentInternalRouteContract = {
  route: typeof PRODUCT_AGENT_INTERNAL_ROUTE_PATH;
  method: "GET";
  audience: string[];
  auth_required: true;
  auth_boundary: "internal-server-side";
  public_exposure_allowed: false;
  decision_context_exposure: "internal-only";
  allowed_query_params: string[];
  unknown_query_params: "reject";
  forbidden_public_targets: string[];
  safe_scope_note: string;
};

const DEFAULT_QUERY: ProductAgentInternalRouteQuery = {
  includeEventImpact: true,
  includeOddsReliability: true,
  staleAfterMinutes: 180,
  oddsLimit: 20
};

const forbiddenFields = new Set<string>(PRODUCT_AGENT_INTERNAL_FORBIDDEN_FIELDS);
const allowedQueryParams = new Set<string>(PRODUCT_AGENT_INTERNAL_ALLOWED_QUERY_PARAMS);

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function readBoundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export function getProductAgentInternalRouteContract(): ProductAgentInternalRouteContract {
  return {
    route: PRODUCT_AGENT_INTERNAL_ROUTE_PATH,
    method: "GET",
    audience: [
      "internal operator dashboard",
      "internal demo/debug tooling",
      "backend-only orchestration",
      "future protected admin panel"
    ],
    auth_required: true,
    auth_boundary: "internal-server-side",
    public_exposure_allowed: false,
    decision_context_exposure: "internal-only",
    allowed_query_params: [...PRODUCT_AGENT_INTERNAL_ALLOWED_QUERY_PARAMS],
    unknown_query_params: "reject",
    forbidden_public_targets: [
      "/api/matches",
      "/api/matches/:fixtureId",
      "/api/public/*",
      "apps/web public frontend props",
      "Telegram runtime payloads by default"
    ],
    safe_scope_note:
      "Internal Product Agent output is limited to data availability, freshness, quality, and approved signal activity. It does not provide predictions, probabilities, recommendations, or betting guidance."
  };
}

export function normalizeProductAgentInternalRouteQuery(
  query: Record<string, unknown>
): ProductAgentInternalRouteQuery {
  for (const key of Object.keys(query)) {
    if (!allowedQueryParams.has(key)) {
      throw new TypeError(`Unknown Product Agent route query parameter: ${key}`);
    }
  }

  return {
    includeEventImpact: readBoolean(query.includeEventImpact, DEFAULT_QUERY.includeEventImpact),
    includeOddsReliability: readBoolean(
      query.includeOddsReliability,
      DEFAULT_QUERY.includeOddsReliability
    ),
    staleAfterMinutes: readBoundedInteger(
      query.staleAfterMinutes,
      DEFAULT_QUERY.staleAfterMinutes,
      1,
      10080
    ),
    oddsLimit: readBoundedInteger(query.oddsLimit, DEFAULT_QUERY.oddsLimit, 1, 50)
  };
}

export function assertProductAgentInternalRoutePayloadSafe(payload: unknown): void {
  const visited = new WeakSet<object>();

  function inspect(value: unknown, path: string): void {
    if (value === null || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nested] of Object.entries(value)) {
      if (forbiddenFields.has(key.toLowerCase())) {
        throw new TypeError(`Forbidden Product Agent route field: ${path ? `${path}.` : ""}${key}`);
      }
      inspect(nested, path ? `${path}.${key}` : key);
    }
  }

  inspect(payload, "");
}

export type ProductAgentInternalRouteSuccess = ProductAgentV1Response & {
  data: ProductAgentV1Insight;
};

export type ProductAgentInternalRouteFailure = {
  data: null;
  meta: {
    status: "no_data" | "degraded";
    source: "product-agent";
    mode: "internal";
    message: string;
  };
};
