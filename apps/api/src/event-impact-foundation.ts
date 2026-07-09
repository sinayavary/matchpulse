import {
  getDbBackedMatchEventContext,
  type MatchEventContext
} from "./match-event-context-builder.js";

export type EventImpactAssessment = {
  fixture_id: string;
  status: "empty" | "available";
  event_count: number;
  latest_event_timestamp: string | null;
  impact_level: "none" | "low" | "medium" | "high";
  impact_label: string;
  impact_summary: {
    goals: number;
    cards: number;
    red_cards: number;
    penalties: number;
    var_events: number;
    substitutions: number;
    pressure_level: "none" | "low" | "medium" | "high";
  };
  key_impact_events: Array<{
    external_seq: string | null;
    event_type: string;
    event_minute: number | null;
    team_side: "home" | "away" | "neutral" | "unknown";
    title: string;
    impact_reason: string;
    impact_weight: "low" | "medium" | "high";
    source_timestamp: string | null;
  }>;
  cues: string[];
  limitations: string[];
  safe_scope_note: string;
};

type ImpactWeight = "low" | "medium" | "high";

const LIMITATIONS = [
  "This assessment is based only on stored match events.",
  "It does not predict match outcomes.",
  "It does not provide betting advice.",
  "It does not use private formulas or external model reasoning."
];

const SAFE_SCOPE_NOTE = "Internal event-impact summary for stored match events only.";

function normalizeKeyEventLimit(value: number | undefined): number {
  const requested = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 5;
  return Math.min(10, Math.max(1, requested));
}

function eventTypeKey(eventType: string): string {
  return eventType.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function impactForEvent(eventType: string): { weight: ImpactWeight; reason: string } | null {
  switch (eventTypeKey(eventType)) {
    case "goal":
      return { weight: "high", reason: "Goal event changes match context." };
    case "red_card":
      return { weight: "high", reason: "Red card can materially change match pressure." };
    case "penalty":
      return { weight: "high", reason: "Penalty event is a high-impact match event." };
    case "var":
      return { weight: "medium", reason: "VAR event may indicate a reviewed match-changing moment." };
    case "yellow_card":
      return { weight: "medium", reason: "Card activity affects match control context." };
    case "substitution":
      return { weight: "low", reason: "Substitution changes team configuration context." };
    default:
      return { weight: "low", reason: "Known match event activity was recorded." };
  }
}

function impactLevel(
  context: MatchEventContext,
  keyEvents: EventImpactAssessment["key_impact_events"]
): EventImpactAssessment["impact_level"] {
  if (context.event_count === 0) return "none";
  if (
    keyEvents.some((event) => event.impact_weight === "high") ||
    context.pressure_context.level === "high"
  ) return "high";
  if (
    keyEvents.some((event) => event.impact_weight === "medium") ||
    context.pressure_context.level === "medium" ||
    keyEvents.length >= 3
  ) return "medium";
  return "low";
}

function labelForImpact(level: EventImpactAssessment["impact_level"]): string {
  switch (level) {
    case "high": return "High event impact";
    case "medium": return "Moderate event impact";
    case "low": return "Low event impact";
    default: return "No event impact available";
  }
}

export function buildEventImpactAssessment(
  context: MatchEventContext,
  options: { keyEventLimit?: number } = {}
): EventImpactAssessment {
  const keyEventLimit = normalizeKeyEventLimit(options.keyEventLimit);
  const keyEvents = context.recent_events
    .map((event) => ({ event, impact: impactForEvent(event.event_type) }))
    .filter((entry): entry is { event: MatchEventContext["recent_events"][number]; impact: { weight: ImpactWeight; reason: string } } => entry.impact !== null)
    .sort((left, right) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[right.impact.weight] - rank[left.impact.weight];
    })
    .slice(0, keyEventLimit)
    .map(({ event, impact }) => ({
      external_seq: event.external_seq,
      event_type: event.event_type,
      event_minute: event.event_minute,
      team_side: event.team_side,
      title: event.title,
      impact_reason: impact.reason,
      impact_weight: impact.weight,
      source_timestamp: event.source_timestamp
    }));
  const level = impactLevel(context, keyEvents);
  const summary = context.timeline_summary;

  return {
    fixture_id: context.fixture_id,
    status: context.status,
    event_count: context.event_count,
    latest_event_timestamp: context.latest_event_timestamp,
    impact_level: level,
    impact_label: labelForImpact(level),
    impact_summary: {
      goals: summary.goals,
      cards: summary.yellow_cards + summary.red_cards,
      red_cards: summary.red_cards,
      penalties: summary.penalties,
      var_events: summary.var_events,
      substitutions: summary.substitutions,
      pressure_level: context.pressure_context.level
    },
    key_impact_events: keyEvents,
    cues: context.pressure_context.cues.slice(0, 5),
    limitations: LIMITATIONS,
    safe_scope_note: SAFE_SCOPE_NOTE
  };
}

export async function getDbBackedEventImpactAssessment(
  fixtureId: string,
  options: { recentLimit?: number; keyEventLimit?: number } = {}
): Promise<EventImpactAssessment> {
  const context = await getDbBackedMatchEventContext(fixtureId, {
    recentLimit: options.recentLimit
  });
  return buildEventImpactAssessment(context, { keyEventLimit: options.keyEventLimit });
}
