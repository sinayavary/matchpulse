import type { ProductAgentV1Response } from "./product-agent-v1.js";

export type FinalProductIntelligence = {
  product_version: "matchpulse-final-v1";
  fixture_id: string;
  status: "live" | "degraded" | "no_data" | "stale";
  headline: string;
  summary: string;
  readiness: {
    display_ready: boolean;
    level: "ready" | "limited" | "unavailable" | "stale";
    reasons: string[];
  };
  data_quality: {
    level: "complete" | "partial" | "empty";
    issues: string[];
  };
  freshness: {
    label: string;
    latest_data_timestamp: string | null;
    note: string;
  };
  market_data: {
    status: "available" | "limited" | "unavailable";
    label: string;
  };
  match_activity: {
    level: "none" | "low" | "medium" | "high";
    label: string;
  };
  signal_counts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  public_notes: string[];
  safety_note: string;
};

const SAFETY_NOTE =
  "MatchPulse provides informational sports intelligence only. It does not provide predictions, probabilities, betting recommendations, or wagering instructions.";

const FORBIDDEN_STRUCTURED_KEYS = new Set([
  "decision_context", "operator_guidance", "limitations", "signal_brief", "top_signals",
  "signals", "state", "internal_context", "raw", "raw_payload", "debug", "debug_lineage",
  "formula", "model", "prediction", "probability", "confidence", "winner", "recommended_bet",
  "bet", "expected_value", "ev", "edge", "wager", "stake", "profit", "payout", "wallet",
  "deposit", "token", "secret", "api_key", "stack"
]);

function marketDataLabel(status: FinalProductIntelligence["market_data"]["status"]): string {
  return status === "available"
    ? "Market data is available."
    : status === "limited"
      ? "Market data is limited."
      : "Market data is not available.";
}

function activityLabel(level: FinalProductIntelligence["match_activity"]["level"]): string {
  return level === "none"
    ? "No notable activity pressure is currently available."
    : level === "low"
      ? "Match activity pressure is low."
      : level === "medium"
        ? "Match activity pressure is moderate."
        : "Match activity pressure is high.";
}

function sanitizeNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((note): note is string => typeof note === "string")
    .map((note) => note.trim().slice(0, 240))
    .filter((note) => note.length > 0)
    .slice(0, 5);
}

export function assertFinalProductIntelligencePublicSafe(payload: unknown): void {
  const visited = new WeakSet<object>();

  function inspect(value: unknown, path: string): void {
    if (value === null || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_STRUCTURED_KEYS.has(key.toLowerCase())) {
        throw new TypeError(`Forbidden final product intelligence field: ${path ? `${path}.` : ""}${key}`);
      }
      inspect(nested, path ? `${path}.${key}` : key);
    }
  }

  inspect(payload, "");
}

export function mapProductAgentToFinalProductIntelligence(
  input: ProductAgentV1Response
): FinalProductIntelligence {
  const insight = input.data;
  const status = input.meta.status;
  const freshnessLabel = insight.freshness.freshness_label;
  const readinessLevel: FinalProductIntelligence["readiness"]["level"] = status === "stale"
    ? "stale"
    : insight.readiness.display_ready
      ? "ready"
      : insight.data_quality.level === "partial"
        ? "limited"
        : "unavailable";
  const marketStatus = insight.decision_context.market_reliability_level;
  const activityLevel = insight.decision_context.event_pressure_level;

  const output: FinalProductIntelligence = {
    product_version: "matchpulse-final-v1",
    fixture_id: insight.fixture_id,
    status,
    headline: insight.headline,
    summary: insight.summary,
    readiness: {
      display_ready: insight.readiness.display_ready,
      level: readinessLevel,
      reasons: [...insight.data_quality.issues]
    },
    data_quality: {
      level: insight.data_quality.level,
      issues: [...insight.data_quality.issues]
    },
    freshness: {
      label: freshnessLabel,
      latest_data_timestamp: insight.freshness.latest_data_timestamp,
      note: insight.freshness.note
    },
    market_data: {
      status: marketStatus,
      label: marketDataLabel(marketStatus)
    },
    match_activity: {
      level: activityLevel,
      label: activityLabel(activityLevel)
    },
    signal_counts: {
      total: insight.signal_brief.total,
      critical: insight.signal_brief.critical,
      warning: insight.signal_brief.warning,
      info: insight.signal_brief.info
    },
    public_notes: sanitizeNotes(insight.user_facing_notes),
    safety_note: SAFETY_NOTE
  };

  assertFinalProductIntelligencePublicSafe(output);
  return output;
}
