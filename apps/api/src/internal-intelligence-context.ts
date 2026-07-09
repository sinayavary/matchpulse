import type { EventImpactAssessment } from "./event-impact-foundation.js";
import type { MatchEventContext } from "./match-event-context-builder.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import type { OddsReliabilityAssessment } from "./odds-reliability-foundation.js";

export type InternalIntelligenceContext = {
  fixture_id: string;
  status: "empty" | "partial" | "available";
  generated_at: string;
  data_readiness: {
    has_fixture: boolean;
    has_scoreboard: boolean;
    has_odds: boolean;
    has_events: boolean;
    has_event_impact: boolean;
    quality_status: "empty" | "partial" | "complete";
    quality_issues: string[];
  };
  match_state: {
    phase: string;
    home_score: number | null;
    away_score: number | null;
    last_data_received_at: string | null;
    freshness_label: string;
  };
  odds_reliability: {
    status: "unavailable" | "limited" | "available";
    snapshot_count: number;
    market_count: number;
    provider_count: number;
    latest_timestamp: string | null;
    limitations: string[];
  };
  event_context: {
    event_count: number;
    latest_event_timestamp: string | null;
    pressure_level: "none" | "low" | "medium" | "high";
    pressure_label: string;
    timeline_summary: MatchEventContext["timeline_summary"];
  };
  event_impact: {
    impact_level: "none" | "low" | "medium" | "high";
    impact_label: string;
    key_event_count: number;
    impact_summary: EventImpactAssessment["impact_summary"];
  };
  limitations: string[];
  safe_scope_note: string;
};

const LIMITATIONS = [
  "This internal context is based only on stored MatchPulse database records.",
  "It does not predict match outcomes.",
  "It does not provide betting advice.",
  "It does not expose private formulas or raw provider payloads."
];

const SAFE_SCOPE_NOTE = "Internal bounded intelligence context for stored match data only.";

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function freshnessLabel(matchState: CanonicalMatchState): string {
  if (matchState.freshness.latest_data_timestamp === null) return "No stored match data timestamp";
  if (matchState.scoreboard.last_data_received_at !== null) return "Stored scoreboard timestamp available";
  return "Stored odds timestamp available";
}

export function buildInternalIntelligenceContext(input: {
  fixtureId: string;
  matchState: CanonicalMatchState;
  oddsReliability: OddsReliabilityAssessment;
  eventContext: MatchEventContext;
  eventImpact: EventImpactAssessment;
  now?: () => Date;
}): InternalIntelligenceContext {
  const hasFixture = input.matchState.quality.has_fixture;
  const hasScoreboard = input.matchState.quality.has_scoreboard;
  const hasOdds = input.oddsReliability.snapshot_count > 0;
  const hasEvents = input.eventContext.event_count > 0;
  const hasEventImpact = input.eventImpact.status === "available";
  const qualityIssues = unique([
    ...input.matchState.quality.issues,
    ...(hasOdds ? [] : ["odds_missing"]),
    ...(hasEvents ? [] : ["events_missing"]),
    ...(hasEventImpact ? [] : ["event_impact_missing"])
  ]);
  const qualityStatus = !hasFixture && !hasScoreboard && !hasOdds && !hasEvents
    ? "empty" as const
    : hasFixture && hasScoreboard && (hasOdds || hasEvents)
      ? "complete" as const
      : "partial" as const;
  const status = qualityStatus === "empty"
    ? "empty" as const
    : input.matchState.quality.status === "complete" && (hasOdds || hasEvents)
      ? "available" as const
      : "partial" as const;

  return {
    fixture_id: input.fixtureId,
    status,
    generated_at: (input.now?.() ?? new Date()).toISOString(),
    data_readiness: {
      has_fixture: hasFixture,
      has_scoreboard: hasScoreboard,
      has_odds: hasOdds,
      has_events: hasEvents,
      has_event_impact: hasEventImpact,
      quality_status: qualityStatus,
      quality_issues: qualityIssues
    },
    match_state: {
      phase: input.matchState.scoreboard.phase ?? "unknown",
      home_score: input.matchState.scoreboard.home_score,
      away_score: input.matchState.scoreboard.away_score,
      last_data_received_at: input.matchState.scoreboard.last_data_received_at,
      freshness_label: freshnessLabel(input.matchState)
    },
    odds_reliability: {
      status: input.oddsReliability.status,
      snapshot_count: input.oddsReliability.snapshot_count,
      market_count: input.oddsReliability.market_count,
      provider_count: input.oddsReliability.provider_count,
      latest_timestamp: input.oddsReliability.latest_timestamp,
      limitations: [...input.oddsReliability.limitations]
    },
    event_context: {
      event_count: input.eventContext.event_count,
      latest_event_timestamp: input.eventContext.latest_event_timestamp,
      pressure_level: input.eventContext.pressure_context.level,
      pressure_label: input.eventContext.pressure_context.label,
      timeline_summary: { ...input.eventContext.timeline_summary }
    },
    event_impact: {
      impact_level: input.eventImpact.impact_level,
      impact_label: input.eventImpact.impact_label,
      key_event_count: input.eventImpact.key_impact_events.length,
      impact_summary: { ...input.eventImpact.impact_summary }
    },
    limitations: [...LIMITATIONS],
    safe_scope_note: SAFE_SCOPE_NOTE
  };
}
