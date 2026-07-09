export const SIGNALCORE_ALLOWED_SIGNAL_TYPES = [
  "DATA_READY",
  "STATE_PARTIAL",
  "STATE_EMPTY",
  "FIXTURE_AVAILABLE",
  "FIXTURE_MISSING",
  "SCORE_AVAILABLE",
  "SCOREBOARD_MISSING",
  "ODDS_AVAILABLE",
  "ODDS_MISSING",
  "DATA_FRESH",
  "DATA_STALE",
  "IDENTITY_INCOMPLETE",
  "PRESSURE_HINT_AVAILABLE",
  "ODDS_RELIABILITY_ASSESSED"
] as const;

export const SIGNALCORE_ALLOWED_SIGNAL_SEVERITIES = [
  "info",
  "warning",
  "critical"
] as const;

export const SIGNALCORE_ALLOWED_AGENT_TOOLS = [
  "getMatchState",
  "runIngestionPipeline",
  "getSignalSummary",
  "getReplayState"
] as const;

export const SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS = [
  "probability",
  "confidence",
  "recommendation",
  "recommended_bet",
  "bet",
  "wager",
  "stake",
  "expected_value",
  "edge",
  "prediction",
  "winner",
  "deposit",
  "wallet",
  "payout",
  "profit"
] as const;

export const SIGNALCORE_FORBIDDEN_TOPICS = [
  "betting_advice",
  "wagering_suggestions",
  "probability_estimates",
  "confidence_claims",
  "market_edge",
  "odds_movement_interpretation",
  "match_outcome_predictions",
  "recommended_actions",
  "wallet_deposit_payment_flows"
] as const;

export const SIGNALCORE_MVP_PRODUCT_OPTIONS = [
  "match_intelligence_card",
  "data_quality_dashboard",
  "signal_feed",
  "replay_timeline_later",
  "watchlist_later",
  "alerts_later"
] as const;

export type SignalCoreAllowedSignalType =
  typeof SIGNALCORE_ALLOWED_SIGNAL_TYPES[number];
export type SignalCoreAllowedSignalSeverity =
  typeof SIGNALCORE_ALLOWED_SIGNAL_SEVERITIES[number];
export type SignalCoreAllowedAgentTool =
  typeof SIGNALCORE_ALLOWED_AGENT_TOOLS[number];
export type SignalCoreMvpProductOption =
  typeof SIGNALCORE_MVP_PRODUCT_OPTIONS[number];

export function getSignalCoreContract() {
  return {
    version: "v0-contract" as const,
    allowed_signal_types: [...SIGNALCORE_ALLOWED_SIGNAL_TYPES],
    allowed_signal_severities: [...SIGNALCORE_ALLOWED_SIGNAL_SEVERITIES],
    allowed_agent_tools: [...SIGNALCORE_ALLOWED_AGENT_TOOLS],
    forbidden_output_fields: [...SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS],
    forbidden_topics: [...SIGNALCORE_FORBIDDEN_TOPICS],
    product_options: [...SIGNALCORE_MVP_PRODUCT_OPTIONS],
    next_phase: "Internal agent presenter odds reliability hint behind includeOddsReliability" as const
  };
}

const forbiddenOutputFields = new Set<string>(SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS);

export function assertNoForbiddenSignalFields(value: unknown): void {
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
        throw new TypeError(`Forbidden SignalCore output field: ${fieldPath}`);
      }
      inspect(nestedValue, fieldPath);
    }
  }

  inspect(value, "");
}
