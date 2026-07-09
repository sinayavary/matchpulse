import type { Prisma } from "@prisma/client";
import { getDbClient } from "./db.js";
import { isRecord, parseFixtureId, readFiniteNumber, readString } from "./txline-normalizer.js";

export type NormalizedTxlineEvent = {
  fixtureId: string;
  externalSeq: string | null;
  eventType: string;
  eventMinute: number | null;
  teamSide: "home" | "away" | "neutral" | "unknown";
  title: string;
  description: string | null;
  sourceTimestamp: Date | null;
  raw: unknown;
};

export type TxlineEventNormalizationResult =
  | { event: NormalizedTxlineEvent; skipReason: null }
  | { event: null; skipReason: "not_an_object" | "missing_event_details" };

export type MatchEventUpsert = {
  where: { fixtureId_externalSeq: { fixtureId: string; externalSeq: string } };
  create: Prisma.MatchEventUncheckedCreateInput;
  update: Prisma.MatchEventUncheckedUpdateInput;
};

export type EventIngestionDbClient = {
  matchEvent: { upsert: (upsert: MatchEventUpsert) => Promise<unknown> };
};

export type TxlineMatchEventIngestionSummary = {
  fixture_id: string;
  fetched_count: number;
  mapped_count: number;
  upserted_count: number;
  skipped_count: number;
  failed_count: number;
  latest_event_timestamp: string | null;
};

function field(record: Record<string, unknown>, camel: string, pascal: string): unknown {
  return record[camel] ?? record[pascal];
}

function optionalString(value: unknown): string | null {
  return readString(value) ??
    (typeof value === "number" && Number.isFinite(value) ? String(value) : null);
}

function toTimestamp(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const number = readFiniteNumber(value);
  if (number === null) return null;
  const epochMs = number < 10_000_000_000 ? number * 1_000 : number;
  const date = new Date(epochMs);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeEventType(value: unknown): string {
  const raw = optionalString(value);
  if (raw === null) return "unknown";
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (key.includes("yellow")) return "yellow_card";
  if (key.includes("red")) return "red_card";
  if (key.includes("substitut")) return "substitution";
  if (key.includes("period") && (key.includes("start") || key.includes("kickoff"))) return "period_start";
  if (key.includes("period") && (key.includes("end") || key.includes("final"))) return "period_end";
  if (key.includes("goal")) return "goal";
  if (key.includes("var")) return "var";
  if (key.includes("penalty")) return "penalty";
  return key || "unknown";
}

function normalizeTeamSide(value: unknown): NormalizedTxlineEvent["teamSide"] {
  const key = optionalString(value)?.toLowerCase();
  if (["home", "h", "1", "participant1", "team1"].includes(key ?? "")) return "home";
  if (["away", "a", "2", "participant2", "team2"].includes(key ?? "")) return "away";
  if (["neutral", "n", "none"].includes(key ?? "")) return "neutral";
  return "unknown";
}

export function normalizeTxlineEvent(
  fixtureId: string,
  raw: unknown
): TxlineEventNormalizationResult {
  if (!isRecord(raw)) return { event: null, skipReason: "not_an_object" };

  const rawType = field(raw, "eventType", "EventType") ??
    field(raw, "type", "Type") ?? field(raw, "action", "Action");
  const title = optionalString(field(raw, "title", "Title")) ??
    optionalString(field(raw, "name", "Name")) ?? optionalString(rawType);
  if (title === null) return { event: null, skipReason: "missing_event_details" };

  const minute = readFiniteNumber(field(raw, "eventMinute", "EventMinute") ??
    field(raw, "minute", "Minute"));
  return {
    event: {
      fixtureId,
      externalSeq: optionalString(field(raw, "externalSeq", "ExternalSeq") ??
        field(raw, "seq", "Seq") ?? field(raw, "messageId", "MessageId") ??
        field(raw, "eventId", "EventId")),
      eventType: normalizeEventType(rawType),
      eventMinute: minute === null || minute < 0 ? null : Math.floor(minute),
      teamSide: normalizeTeamSide(field(raw, "teamSide", "TeamSide") ??
        field(raw, "side", "Side") ?? field(raw, "team", "Team")),
      title,
      description: optionalString(field(raw, "description", "Description") ??
        field(raw, "details", "Details")),
      sourceTimestamp: toTimestamp(field(raw, "sourceTimestamp", "SourceTimestamp") ??
        field(raw, "timestamp", "Timestamp") ?? field(raw, "ts", "Ts")),
      raw
    },
    skipReason: null
  };
}

function fallbackExternalSeq(event: NormalizedTxlineEvent, index: number): string {
  return `fallback:${event.eventType}:${event.eventMinute ?? "no-minute"}:${event.teamSide}:${event.sourceTimestamp?.toISOString() ?? "no-ts"}:${index}`;
}

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export function mapNormalizedEventToMatchEventUpsert(
  event: NormalizedTxlineEvent,
  index: number
): MatchEventUpsert {
  const externalSeq = event.externalSeq ?? fallbackExternalSeq(event, index);
  const raw = safeJson(event.raw);
  const values = {
    fixtureId: event.fixtureId,
    externalSeq,
    eventType: event.eventType,
    eventMinute: event.eventMinute,
    teamSide: event.teamSide,
    title: event.title,
    description: event.description,
    sourceTimestamp: event.sourceTimestamp,
    ...(raw === undefined ? {} : { raw })
  };
  return {
    where: { fixtureId_externalSeq: { fixtureId: event.fixtureId, externalSeq } },
    create: values,
    update: values
  };
}

export async function ingestTxlineMatchEvents(input: {
  fixtureId: string;
  rawEvents: unknown[];
  db?: EventIngestionDbClient;
  now?: () => Date;
}): Promise<TxlineMatchEventIngestionSummary> {
  const fixtureId = parseFixtureId(input.fixtureId);
  if (fixtureId === null) throw new TypeError("fixtureId is required.");
  const db = input.db ?? getDbClient();
  const result: TxlineMatchEventIngestionSummary = {
    fixture_id: fixtureId, fetched_count: input.rawEvents.length, mapped_count: 0,
    upserted_count: 0, skipped_count: 0, failed_count: 0, latest_event_timestamp: null
  };
  let latest: Date | null = null;

  for (let index = 0; index < input.rawEvents.length; index += 1) {
    const normalized = normalizeTxlineEvent(fixtureId, input.rawEvents[index]);
    if (normalized.event === null) {
      result.skipped_count += 1;
      continue;
    }
    result.mapped_count += 1;
    if (normalized.event.sourceTimestamp !== null &&
      (latest === null || normalized.event.sourceTimestamp > latest)) latest = normalized.event.sourceTimestamp;
    try {
      await db.matchEvent.upsert(mapNormalizedEventToMatchEventUpsert(normalized.event, index));
      result.upserted_count += 1;
    } catch {
      result.failed_count += 1;
    }
  }
  result.latest_event_timestamp = latest?.toISOString() ?? null;
  return result;
}
