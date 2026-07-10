import {
  PUBLIC_MARKET_SAFETY_NOTE,
  buildPublicMarketIntelligence,
  type InternalOddsIntelligenceContext,
  type NormalizedOddsMarketType,
  type NormalizedOddsSelectionType,
  type OddsMarketIntelligence,
  type PublicMarketIntelligence,
  type PublicMarketMovement,
  type PublicMarketReliabilityLevel,
} from "./odds-intelligence-contract.js";

const MARKET_LABELS: Readonly<Record<NormalizedOddsMarketType, string>> = {
  match_result_1x2: "Match result",
  double_chance: "Double chance",
  total_goals: "Total goals",
  both_teams_to_score: "Both teams to score",
  asian_handicap: "Asian handicap",
  next_goal: "Next goal",
  correct_score: "Correct score",
  unknown: "Other market",
};

const SELECTION_LABELS: Readonly<Record<NormalizedOddsSelectionType, string>> = {
  home: "Home",
  draw: "Draw",
  away: "Away",
  none: "No goal",
  yes: "Yes",
  no: "No",
  over: "Over",
  under: "Under",
  other: "Other",
  unknown: "Unknown",
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function reliability(level: InternalOddsIntelligenceContext["status"]): PublicMarketReliabilityLevel {
  switch (level) {
    case "high_confidence": return "strong";
    case "reliable": return "good";
    case "limited": return "limited";
    case "unreliable":
    case "invalid": return "low";
    case "unavailable": return "unavailable";
  }
}

function latestTimestamp(context: InternalOddsIntelligenceContext): string | null {
  return context.markets
    .map((market) => market.latest_timestamp)
    .filter((value): value is string => value !== null)
    .sort(compareText)
    .at(-1) ?? null;
}

function movementMagnitude(market: OddsMarketIntelligence, selectionIndex: number): number {
  const selection = market.selections[selectionIndex]!;
  return Math.max(
    Math.abs(selection.probability_change_1m ?? 0),
    Math.abs(selection.probability_change_5m ?? 0),
  );
}

function movementFromSelection(
  market: OddsMarketIntelligence,
  selectionIndex: number,
): PublicMarketMovement {
  const selection = market.selections[selectionIndex]!;
  const oneMinute = selection.probability_change_1m;
  const fiveMinute = selection.probability_change_5m;
  const selectedChange = fiveMinute ?? oneMinute;
  const magnitude = movementMagnitude(market, selectionIndex);
  const volatile =
    market.volatility_score >= 0.7 &&
    (selectedChange === null || magnitude < 0.005);
  const direction: PublicMarketMovement["direction"] = volatile
    ? "volatile"
    : selectedChange === null
      ? "unknown"
      : magnitude < 0.005
        ? "stable"
        : selectedChange > 0
          ? "up"
          : "down";
  const strength: PublicMarketMovement["strength"] =
    magnitude >= 0.03 || market.volatility_score >= 0.8
      ? "high"
      : magnitude >= 0.01 || market.volatility_score >= 0.45
        ? "medium"
        : "low";
  const selectionLabel = SELECTION_LABELS[selection.selection];
  const marketLabel = MARKET_LABELS[market.market_type];
  const summary = direction === "up"
    ? `${selectionLabel} market support moved upward in the recent window.`
    : direction === "down"
      ? `${selectionLabel} market support moved downward in the recent window.`
      : direction === "stable"
        ? `${selectionLabel} market support remained broadly stable.`
        : direction === "volatile"
          ? `${selectionLabel} market support showed unstable recent movement.`
          : `Recent movement for ${selectionLabel} could not be determined.`;
  return {
    market_label: marketLabel,
    selection_label: selectionLabel,
    direction,
    strength,
    summary,
  };
}

function notableMovements(
  context: InternalOddsIntelligenceContext,
): PublicMarketMovement[] {
  const candidates = context.markets.flatMap((market) => (
    market.selections.flatMap((selection, selectionIndex) => (
      selection.probability_change_1m !== null ||
      selection.probability_change_5m !== null ||
      market.volatility_score >= 0.2
        ? [{
            market,
            selectionIndex,
            magnitude: movementMagnitude(market, selectionIndex),
          }]
        : []
    ))
  ));
  return candidates
    .sort((left, right) => (
      right.magnitude - left.magnitude ||
      right.market.volatility_score - left.market.volatility_score ||
      compareText(left.market.market_key, right.market.market_key) ||
      compareText(
        left.market.selections[left.selectionIndex]!.selection,
        right.market.selections[right.selectionIndex]!.selection,
      )
    ))
    .slice(0, 3)
    .map((candidate) => movementFromSelection(
      candidate.market,
      candidate.selectionIndex,
    ));
}

function summary(context: InternalOddsIntelligenceContext): string {
  if (context.status === "unavailable") {
    return "Market intelligence is unavailable because no usable odds data is present.";
  }
  if (context.status === "invalid") {
    return "Market intelligence is unavailable because the supplied odds data failed validation.";
  }
  if (context.usable_market_count === 0) {
    return "Odds data is present, but reliability gates excluded it from model use.";
  }
  if (context.status === "high_confidence") {
    return "Market intelligence has strong coverage, agreement, and freshness.";
  }
  if (context.status === "reliable") {
    return "Market intelligence is usable with good overall reliability.";
  }
  return "Market intelligence is usable with material data limitations.";
}

export function mapInternalOddsIntelligenceToPublic(
  context: InternalOddsIntelligenceContext,
): PublicMarketIntelligence {
  const lastUpdate = latestTimestamp(context);
  const availability: PublicMarketIntelligence["availability"] =
    context.status === "unavailable" || context.status === "invalid"
      ? "unavailable"
      : context.usable_market_count > 0 &&
          ["reliable", "high_confidence"].includes(context.status)
        ? "available"
        : "limited";
  const freshness: PublicMarketIntelligence["freshness"] = lastUpdate === null
    ? "unknown"
    : context.freshness_score >= 0.95
      ? "fresh"
      : context.freshness_score >= 0.4
        ? "aging"
        : "stale";
  const providerCoverage: PublicMarketIntelligence["provider_coverage"] =
    context.provider_count === 0
      ? "none"
      : context.provider_count === 1
        ? "single"
        : context.provider_count <= 3
          ? "limited"
          : "broad";
  const providerAgreement: PublicMarketIntelligence["provider_agreement"] =
    context.provider_count === 0
      ? "unknown"
      : context.consensus_score >= 0.8
        ? "strong"
        : context.consensus_score >= 0.55
          ? "mixed"
          : "weak";
  const volatility: PublicMarketIntelligence["volatility"] =
    context.market_count === 0
      ? "none"
      : context.volatility_score < 0.2
        ? "low"
        : context.volatility_score < 0.5
          ? "medium"
          : "high";

  return buildPublicMarketIntelligence({
    market_intelligence_version: "public-market-intelligence-v1",
    fixture_id: context.fixture_id,
    generated_at: context.generated_at,
    availability,
    reliability: reliability(context.status),
    freshness,
    provider_coverage: providerCoverage,
    provider_agreement: providerAgreement,
    volatility,
    market_count: context.market_count,
    usable_market_count: context.usable_market_count,
    provider_count: context.provider_count,
    notable_movements: notableMovements(context),
    summary: summary(context),
    limitations: [...new Set(context.limitations)].sort(compareText),
    last_update: lastUpdate,
    safety_note: PUBLIC_MARKET_SAFETY_NOTE,
  });
}
