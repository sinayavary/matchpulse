import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export const LIVE_SCHEMA_VERSION = "matchpulse-live-v1" as const;
export const LIVE_EVENT_TYPES = ["fixture.snapshot", "fixture.state", "fixture.event", "fixture.odds", "fixture.agent", "fixture.prediction", "stream.reset"] as const;
export type LiveEventType = typeof LIVE_EVENT_TYPES[number];
export type PublicLiveEnvelope = { schema_version: typeof LIVE_SCHEMA_VERSION; id: string; type: LiveEventType; fixture_id: string | null; occurred_at: string; data: Record<string, unknown>; meta: { source: "database"; mode: "live" } };
const FORBIDDEN_PUBLIC_KEY = /(^|_)(raw|secret|token|password|authorization|private|debug|weights?|coefficients?|thresholds?|provider_payload|internal)(_|$)/i;
const MAX_PUBLIC_PAYLOAD_BYTES = 262_144;

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export function publicPayloadHash(payload: Record<string, unknown>): string { return createHash("sha256").update(stableJson(payload)).digest("hex"); }
export function assertPublicLivePayload(payload: unknown): asserts payload is Record<string, unknown> {
  const seen = new WeakSet<object>();
  let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (value === null || typeof value === "boolean" || typeof value === "number") return;
    if (typeof value === "string") { if (value.length > 16_384) throw new Error("invalid_public_live_payload"); return; }
    if (typeof value !== "object" || depth > 12 || ++nodes > 5_000 || seen.has(value)) throw new Error("invalid_public_live_payload");
    seen.add(value);
    if (Array.isArray(value)) { if (value.length > 1_000) throw new Error("invalid_public_live_payload"); for (const item of value) visit(item, depth + 1); return; }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key.length > 128 || FORBIDDEN_PUBLIC_KEY.test(key)) throw new Error("invalid_public_live_payload");
      visit(item, depth + 1);
    }
  };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_public_live_payload");
  visit(payload, 0);
  if (Buffer.byteLength(stableJson(payload), "utf8") > MAX_PUBLIC_PAYLOAD_BYTES) throw new Error("invalid_public_live_payload");
}
export function buildDedupeKey(input: { eventType: Exclude<LiveEventType, "stream.reset">; fixtureId?: string | null; sourceRecordId: string; sourceVersion: string; payloadHash: string }): string {
  return [input.eventType, input.fixtureId ?? "system", input.sourceRecordId, input.sourceVersion, input.payloadHash].join("|");
}
export function assertLiveEventType(value: unknown): value is LiveEventType { return typeof value === "string" && (LIVE_EVENT_TYPES as readonly string[]).includes(value); }
export function parseLiveCursor(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("invalid_live_cursor");
  return BigInt(value);
}

export async function appendPublicLiveEvent(db: PrismaClient, input: { eventType: Exclude<LiveEventType, "stream.reset">; fixtureId?: string | null; sourceRecordId: string; sourceVersion: string; payload: Record<string, unknown>; occurredAt?: Date; retentionHours?: number }): Promise<{ id: bigint; inserted: boolean }> {
  assertPublicLivePayload(input.payload);
  const payloadHash = publicPayloadHash(input.payload);
  const dedupeKey = buildDedupeKey({ ...input, payloadHash });
  const retentionHours = Math.min(168, Math.max(1, input.retentionHours ?? Number(process.env.MATCHPULSE_SSE_RETENTION_HOURS ?? 24)));
  const existing = await db.publicLiveEvent.findUnique({ where: { dedupeKey }, select: { id: true } });
  const row = await db.publicLiveEvent.upsert({ where: { dedupeKey }, create: { fixtureId: input.fixtureId ?? null, eventType: input.eventType, dedupeKey, payload: input.payload as Prisma.InputJsonObject, payloadHash, occurredAt: input.occurredAt ?? new Date(), expiresAt: new Date(Date.now() + retentionHours * 3600000) }, update: {} });
  return { id: row.id, inserted: existing === null };
}
export type PublicLivePublishInput = Omit<Parameters<typeof appendPublicLiveEvent>[1], "eventType">;
export function publishFixtureSnapshot(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.snapshot" }); }
export function publishFixtureState(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.state" }); }
export function publishFixtureEvent(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.event" }); }
export function publishFixtureOdds(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.odds" }); }
export function publishFixtureAgent(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.agent" }); }
export function publishFixturePrediction(db: PrismaClient, input: PublicLivePublishInput) { return appendPublicLiveEvent(db, { ...input, eventType: "fixture.prediction" }); }
export async function safelyAppendPublicLiveEvent(db: PrismaClient, input: Parameters<typeof appendPublicLiveEvent>[1]): Promise<{ ok: true; id: bigint; inserted: boolean } | { ok: false; error: "outbox_write_failed" }> {
  try { const result = await appendPublicLiveEvent(db, input); return { ok: true, ...result }; } catch { return { ok: false, error: "outbox_write_failed" }; }
}
export async function reconcilePublicLiveEvents(db: PrismaClient, sources: Array<Parameters<typeof appendPublicLiveEvent>[1]>, limit = 100): Promise<{ attempted: number; published: number; failed: number }> {
  const bounded = sources.slice(0, Math.min(500, Math.max(1, limit))); let published = 0; let failed = 0;
  for (const source of bounded) { const result = await safelyAppendPublicLiveEvent(db, source); if (result.ok) published += result.inserted ? 1 : 0; else failed += 1; }
  return { attempted: bounded.length, published, failed };
}
export async function cleanupPublicLiveEvents(db: PrismaClient, limit = 500): Promise<number> {
  const rows = await db.publicLiveEvent.findMany({ where: { expiresAt: { lt: new Date() } }, select: { id: true }, orderBy: { id: "asc" }, take: Math.min(5000, Math.max(1, limit)) });
  if (!rows.length) return 0;
  return (await db.publicLiveEvent.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })).count;
}
export function toLiveEnvelope(row: { id: bigint; eventType: string; fixtureId: string | null; occurredAt: Date; payload: unknown }): PublicLiveEnvelope {
  if (!assertLiveEventType(row.eventType) || row.eventType === "stream.reset") throw new Error("invalid_stored_live_event");
  assertPublicLivePayload(row.payload);
  return { schema_version: LIVE_SCHEMA_VERSION, id: row.id.toString(), type: row.eventType, fixture_id: row.fixtureId, occurred_at: row.occurredAt.toISOString(), data: row.payload, meta: { source: "database", mode: "live" } };
}
