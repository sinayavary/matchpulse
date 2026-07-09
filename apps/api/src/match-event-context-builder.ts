import { getDbClient } from "./db.js";
import { parseFixtureId } from "./txline-normalizer.js";

export type MatchEventContext = {
  fixture_id: string;
  status: "empty" | "available";
  event_count: number;
  latest_event_timestamp: string | null;
  timeline_summary: {
    goals: number;
    yellow_cards: number;
    red_cards: number;
    substitutions: number;
    penalties: number;
    var_events: number;
    other_events: number;
  };
  recent_events: Array<{
    external_seq: string | null;
    event_type: string;
    event_minute: number | null;
    team_side: "home" | "away" | "neutral" | "unknown";
    title: string;
    description: string | null;
    source_timestamp: string | null;
  }>;
  pressure_context: {
    level: "none" | "low" | "medium" | "high";
    label: string;
    evidence_count: number;
    cues: string[];
    limitations: string[];
    safe_scope_note: string;
  };
};

type MatchEventRow = {
  externalSeq: string | null;
  eventType: string;
  eventMinute: number | null;
  teamSide: string;
  title: string;
  description: string | null;
  sourceTimestamp: Date | null;
  createdAt: Date;
};

type MatchEventContextDbClient = {
  matchEvent: {
    findMany: (args: {
      where: { fixtureId: string };
      orderBy: Array<{ sourceTimestamp: "desc" } | { createdAt: "desc" }>;
      select: {
        externalSeq: boolean;
        eventType: boolean;
        eventMinute: boolean;
        teamSide: boolean;
        title: boolean;
        description: boolean;
        sourceTimestamp: boolean;
        createdAt: boolean;
      };
    }) => Promise<MatchEventRow[]>;
  };
};

type PressureClassification = {
  level: MatchEventContext["pressure_context"]["level"];
  label: string;
  evidenceCount: number;
  cues: string[];
};

const PRESSURE_LIMITATIONS = [
  "This context is based only on stored match events.",
  "It does not predict match outcomes.",
  "It does not provide betting advice."
];

const SAFE_SCOPE_NOTE = "Internal summary of stored match events only.";

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function normalizeRecentLimit(recentLimit: number | undefined): number {
  const requested = typeof recentLimit === "number" && Number.isFinite(recentLimit)
    ? Math.trunc(recentLimit)
    : 10;
  return Math.min(25, Math.max(1, requested));
}

function eventTypeKey(eventType: string): string {
  return eventType.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function countMatching(rows: MatchEventRow[], predicate: (row: MatchEventRow) => boolean): number {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function latestTimestamp(rows: MatchEventRow[]): string | null {
  for (const row of rows) {
    if (row.sourceTimestamp !== null) return row.sourceTimestamp.toISOString();
  }
  return null;
}

function summarizePressure(
  recentEvents: MatchEventContext["recent_events"]
): PressureClassification {
  if (recentEvents.length === 0) {
    return {
      level: "none",
      label: "No event pressure context",
      evidenceCount: 0,
      cues: []
    };
  }

  const eventTypes = recentEvents.map((event) => event.event_type);
  const goals = eventTypes.filter((type) => type === "goal").length;
  const yellowCards = eventTypes.filter((type) => type === "yellow_card").length;
  const redCards = eventTypes.filter((type) => type === "red_card").length;
  const penalties = eventTypes.filter((type) => type === "penalty").length;
  const cardCount = yellowCards + redCards;
  const relevantCount = recentEvents.filter((event) =>
    ["goal", "yellow_card", "red_card", "penalty", "var"].includes(event.event_type)
  ).length;
  const clustered = hasClusteredEvents(recentEvents);
  const densityHigh = recentEvents.length >= 5 || (recentEvents.length >= 4 && clustered);

  if (redCards > 0 || densityHigh) {
    const cues = unique([
      ...(redCards > 0 ? ["Red card event found."] : []),
      ...(densityHigh ? ["Several recent events are clustered."] : []),
      ...(goals > 0 ? ["Recent goal event found."] : []),
      ...(penalties > 0 ? ["Recent penalty event found."] : []),
      ...(cardCount > 1 ? ["Multiple card events found."] : [])
    ]);
    return {
      level: "high",
      label: "High event pressure context",
      evidenceCount: Math.max(redCards, recentEvents.length),
      cues
    };
  }

  if (goals > 0 || penalties > 0 || cardCount > 1 || clustered || relevantCount >= 3) {
    const cues = unique([
      ...(goals > 0 ? ["Recent goal event found."] : []),
      ...(penalties > 0 ? ["Recent penalty event found."] : []),
      ...(cardCount > 1 ? ["Multiple card events found."] : []),
      ...(clustered ? ["Several recent events are clustered."] : []),
      ...(relevantCount >= 3 ? ["Several relevant events are close together."] : [])
    ]);
    return {
      level: "medium",
      label: "Moderate event pressure context",
      evidenceCount: Math.max(relevantCount, cardCount, goals + penalties),
      cues
    };
  }

  return {
    level: "low",
    label: "Low event activity",
    evidenceCount: recentEvents.length,
    cues: ["Recent match event activity found."]
  };
}

function hasClusteredEvents(
  recentEvents: MatchEventContext["recent_events"]
): boolean {
  const minuteValues = recentEvents
    .map((event) => event.event_minute)
    .filter((minute): minute is number => typeof minute === "number" && Number.isFinite(minute))
    .sort((left, right) => left - right);
  if (minuteValues.length >= 3) {
    for (let index = 0; index <= minuteValues.length - 3; index += 1) {
      if (minuteValues[index + 2] - minuteValues[index] <= 15) return true;
    }
  }

  const timestampValues = recentEvents
    .map((event) => event.source_timestamp)
    .filter((timestamp): timestamp is string => typeof timestamp === "string" && timestamp.length > 0)
    .map((timestamp) => new Date(timestamp).getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right);
  if (timestampValues.length >= 3) {
    for (let index = 0; index <= timestampValues.length - 3; index += 1) {
      if (timestampValues[index + 2] - timestampValues[index] <= 15 * 60 * 1000) return true;
    }
  }

  return false;
}

function buildContextFromRows(
  fixtureId: string,
  rows: MatchEventRow[],
  recentLimit: number | undefined
): MatchEventContext {
  const limit = normalizeRecentLimit(recentLimit);
  const eventCount = rows.length;
  const recentRows = rows.slice(0, limit);

  const timelineSummary = {
    goals: countMatching(rows, (row) => eventTypeKey(row.eventType) === "goal"),
    yellow_cards: countMatching(rows, (row) => eventTypeKey(row.eventType) === "yellow_card"),
    red_cards: countMatching(rows, (row) => eventTypeKey(row.eventType) === "red_card"),
    substitutions: countMatching(rows, (row) => eventTypeKey(row.eventType) === "substitution"),
    penalties: countMatching(rows, (row) => eventTypeKey(row.eventType) === "penalty"),
    var_events: countMatching(rows, (row) => eventTypeKey(row.eventType) === "var"),
    other_events: 0
  };
  timelineSummary.other_events = Math.max(
    0,
    eventCount - (
      timelineSummary.goals +
      timelineSummary.yellow_cards +
      timelineSummary.red_cards +
      timelineSummary.substitutions +
      timelineSummary.penalties +
      timelineSummary.var_events
    )
  );

  const recentEvents = recentRows.map((row) => ({
    external_seq: row.externalSeq,
    event_type: row.eventType,
    event_minute: row.eventMinute,
    team_side: normalizeTeamSide(row.teamSide),
    title: row.title,
    description: row.description,
    source_timestamp: iso(row.sourceTimestamp)
  }));

  const pressure = summarizePressure(recentEvents);

  return {
    fixture_id: fixtureId,
    status: eventCount > 0 ? "available" : "empty",
    event_count: eventCount,
    latest_event_timestamp: latestTimestamp(rows),
    timeline_summary: timelineSummary,
    recent_events: recentEvents,
    pressure_context: {
      level: pressure.level,
      label: pressure.label,
      evidence_count: pressure.evidenceCount,
      cues: pressure.cues,
      limitations: PRESSURE_LIMITATIONS,
      safe_scope_note: SAFE_SCOPE_NOTE
    }
  };
}

function normalizeTeamSide(value: string): "home" | "away" | "neutral" | "unknown" {
  const key = value.trim().toLowerCase();
  if (key === "home" || key === "h" || key === "1" || key === "participant1" || key === "team1") {
    return "home";
  }
  if (key === "away" || key === "a" || key === "2" || key === "participant2" || key === "team2") {
    return "away";
  }
  if (key === "neutral" || key === "n" || key === "none") return "neutral";
  return "unknown";
}

export function buildMatchEventContextFromRows(
  fixtureId: string,
  rows: MatchEventRow[],
  options: { recentLimit?: number } = {}
): MatchEventContext {
  const normalizedFixtureId = parseFixtureId(fixtureId);
  if (normalizedFixtureId === null) {
    throw new TypeError("fixtureId is required.");
  }
  return buildContextFromRows(normalizedFixtureId, rows, options.recentLimit);
}

export async function getDbBackedMatchEventContext(
  fixtureId: string,
  options: {
    recentLimit?: number;
  } = {}
): Promise<MatchEventContext> {
  const normalizedFixtureId = parseFixtureId(fixtureId);
  if (normalizedFixtureId === null) {
    throw new TypeError("fixtureId is required.");
  }

  const db: MatchEventContextDbClient = getDbClient();
  const rows = await db.matchEvent.findMany({
    where: { fixtureId: normalizedFixtureId },
    orderBy: [{ sourceTimestamp: "desc" }, { createdAt: "desc" }],
    select: {
      externalSeq: true,
      eventType: true,
      eventMinute: true,
      teamSide: true,
      title: true,
      description: true,
      sourceTimestamp: true,
      createdAt: true
    }
  });

  return buildContextFromRows(normalizedFixtureId, rows, options.recentLimit);
}
