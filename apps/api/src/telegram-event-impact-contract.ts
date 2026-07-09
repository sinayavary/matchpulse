import type { PublicEventImpactSummary } from "./public-event-impact-contract.js";

export type TelegramEventImpactMessage = {
  status: "sendable" | "silent";
  title: string;
  body: string;
  severity: "none" | "low" | "medium" | "high";
  tags: string[];
  safe_scope_note: string;
};

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 280;
const MAX_SCOPE_NOTE_LENGTH = 240;
const FORBIDDEN_TEXT = /\b(?:bet|wager|stake|payout|profit|odds pick|guaranteed|lock|sure win)\b/gi;

function plainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\*_`~#[\]()>|]/g, "")
    .replace(FORBIDDEN_TEXT, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

function titleFor(level: PublicEventImpactSummary["level"]): string {
  if (level === "high") return "High match-event impact";
  if (level === "medium") return "Moderate match-event impact";
  if (level === "low") return "Low match-event impact";
  return "No major match-event impact";
}

function safeScopeNote(input: PublicEventImpactSummary): string {
  const note = plainText(input.safe_scope_note, MAX_SCOPE_NOTE_LENGTH);
  return note || "Stored match-event impact only. Not a prediction, probability, betting recommendation, or wagering instruction.";
}

function unavailableMessage(input: PublicEventImpactSummary): TelegramEventImpactMessage {
  return {
    status: "silent",
    title: "Event impact unavailable",
    body: "Stored match-event impact is not available yet.",
    severity: "none",
    tags: ["event-impact", "unavailable"],
    safe_scope_note: safeScopeNote(input)
  };
}

export function mapPublicEventImpactToTelegramMessage(
  input: PublicEventImpactSummary
): TelegramEventImpactMessage {
  if (input.status === "unavailable") return unavailableMessage(input);

  const title = titleFor(input.level);
  const body = plainText(
    `${input.label}. ${input.event_count_label}. ${input.pressure_label}.`,
    MAX_BODY_LENGTH
  );

  return {
    status: input.level === "medium" || input.level === "high" ? "sendable" : "silent",
    title: plainText(title, MAX_TITLE_LENGTH),
    body,
    severity: input.level,
    tags: ["event-impact", input.level],
    safe_scope_note: safeScopeNote(input)
  };
}
