import type { AgentPresenterEventImpactHint } from "./agent-presenter-v0.js";

export type PublicEventImpactSummary = {
  status: "available" | "unavailable";
  level: "none" | "low" | "medium" | "high";
  label: string;
  event_count_label: string;
  pressure_label: string;
  source: "stored_events";
  safe_scope_note: string;
};

export const PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE =
  "This summary describes stored match events only. It is not a prediction, probability, betting recommendation, or wagering instruction.";

const LEVELS = ["none", "low", "medium", "high"] as const;
type EventImpactLevel = PublicEventImpactSummary["level"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLevel(value: unknown): value is EventImpactLevel {
  return typeof value === "string" && LEVELS.includes(value as EventImpactLevel);
}

function impactLabel(level: EventImpactLevel): string {
  if (level === "high") return "High match-event impact";
  if (level === "medium") return "Moderate match-event impact";
  if (level === "low") return "Low match-event impact";
  return "No major match-event impact";
}

function pressureLabel(level: EventImpactLevel): string {
  if (level === "high") return "High event pressure";
  if (level === "medium") return "Moderate event pressure";
  if (level === "low") return "Low event pressure";
  return "No event pressure";
}

function eventCountLabel(count: number): string {
  if (count === 0) return "No key events";
  if (count === 1) return "1 key event";
  if (count >= 10) return "10+ key events";
  return `${count} key events`;
}

function unavailableSummary(): PublicEventImpactSummary {
  return {
    status: "unavailable",
    level: "none",
    label: impactLabel("none"),
    event_count_label: "No key events",
    pressure_label: pressureLabel("none"),
    source: "stored_events",
    safe_scope_note: PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE
  };
}

export function mapAgentPresenterEventImpactToPublicSummary(
  input: AgentPresenterEventImpactHint | undefined
): PublicEventImpactSummary {
  if (!isRecord(input) ||
    input.status !== "available" ||
    !isLevel(input.level) ||
    input.source !== "stored_events" ||
    typeof input.key_event_count !== "number" ||
    !Number.isInteger(input.key_event_count) ||
    !Number.isFinite(input.key_event_count) ||
    input.key_event_count < 0) {
    return unavailableSummary();
  }

  const pressureLevel = isLevel(input.pressure_level) ? input.pressure_level : "none";
  const count = Math.min(10, input.key_event_count);

  return {
    status: "available",
    level: input.level,
    label: impactLabel(input.level),
    event_count_label: eventCountLabel(count),
    pressure_label: pressureLabel(pressureLevel),
    source: "stored_events",
    safe_scope_note: PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE
  };
}
