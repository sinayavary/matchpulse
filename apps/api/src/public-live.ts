import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getDbClient } from "./db.js";
import { assertLiveEventType, parseLiveCursor, toLiveEnvelope } from "./public-live-events.js";

const numberConfig = (name: string, fallback: number, min: number, max: number) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback; };
const pollMs = () => numberConfig("MATCHPULSE_SSE_POLL_INTERVAL_MS", 1000, 100, 30000);
const heartbeatMs = () => numberConfig("MATCHPULSE_SSE_HEARTBEAT_MS", 15000, 1000, 120000);
const batchSize = () => numberConfig("MATCHPULSE_SSE_BATCH_SIZE", 100, 1, 500);
const maxConnections = () => numberConfig("MATCHPULSE_SSE_MAX_CONNECTIONS_PER_PROCESS", 500, 1, 10000);
let activeConnections = 0;
const connectionsByIp = new Map<string, number>();

function write(reply: FastifyReply, value: string): boolean { if (reply.raw.destroyed || reply.raw.writableEnded) return false; try { return reply.raw.write(value); } catch { return false; } }
function reject(reply: FastifyReply, code: number, error: string) { reply.code(code).type("application/json"); return { error, message: "The request could not be completed." }; }
export function registerPublicLiveRoutes(app: FastifyInstance): void {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (activeConnections >= maxConnections()) return reject(reply, 429, "live_stream_unavailable");
    const params = request.params as { fixtureId?: string };
    const query = request.query as { fixtureId?: unknown; types?: unknown; cursor?: unknown };
    const fixtureId = params.fixtureId ?? (typeof query.fixtureId === "string" ? query.fixtureId : undefined);
    if (fixtureId !== undefined && !/^[A-Za-z0-9:_-]{1,128}$/.test(fixtureId)) return reject(reply, 400, "invalid_fixture_id");
    let cursor: bigint | undefined;
    try { cursor = parseLiveCursor(request.headers["last-event-id"] ?? query.cursor); } catch { return reject(reply, 400, "invalid_live_cursor"); }
    const types = query.types === undefined ? undefined : String(query.types).split(",").map((value) => value.trim()).filter(Boolean);
    if (types && types.some((type) => !assertLiveEventType(type) || type === "stream.reset")) return reject(reply, 400, "invalid_live_types");
    const ip = request.ip || "unknown"; const ipCount = connectionsByIp.get(ip) ?? 0;
    if (ipCount >= numberConfig("MATCHPULSE_SSE_MAX_CONNECTIONS_PER_IP", 10, 1, 1000)) return reject(reply, 429, "live_stream_unavailable");
    const db = getDbClient(); const client = reply.raw; activeConnections += 1; connectionsByIp.set(ip, ipCount + 1);
    reply.hijack(); client.setHeader("Content-Type", "text/event-stream; charset=utf-8"); client.setHeader("Cache-Control", "no-cache, no-transform"); client.setHeader("Connection", "keep-alive"); client.setHeader("X-Accel-Buffering", "no"); client.flushHeaders?.();
    let closed = false; let timer: NodeJS.Timeout | undefined; let heartbeat: NodeJS.Timeout | undefined;
    const close = (endResponse = false) => { if (closed) return; closed = true; if (timer) clearTimeout(timer); if (heartbeat) clearInterval(heartbeat); activeConnections = Math.max(0, activeConnections - 1); const next = (connectionsByIp.get(ip) ?? 1) - 1; if (next > 0) connectionsByIp.set(ip, next); else connectionsByIp.delete(ip); if (endResponse && !client.destroyed && !client.writableEnded) client.end(); };
    request.raw.once("close", close); request.raw.once("error", close);
    try {
      const latest = await db.publicLiveEvent.findFirst({ where: { expiresAt: { gt: new Date() }, ...(fixtureId ? { fixtureId } : {}) }, orderBy: { id: "desc" }, select: { id: true } });
      if (!write(reply, `retry: ${numberConfig("MATCHPULSE_SSE_RETRY_MS", 3000, 100, 60000)}\n\nevent: stream.ready\ndata: ${JSON.stringify({ schema_version: "matchpulse-live-v1", connected_at: new Date().toISOString(), heartbeat_interval_ms: heartbeatMs(), retention_hours: numberConfig("MATCHPULSE_SSE_RETENTION_HOURS", 24, 1, 168), latest_event_id: latest?.id.toString() ?? null })}\n\n`)) { close(true); return reply; }
    } catch { close(true); return reply; }
    heartbeat = setInterval(() => { if (!write(reply, `: heartbeat ${new Date().toISOString()}\n\n`)) close(true); }, heartbeatMs());
    const poll = async () => { if (closed) return; try {
      const earliest = await db.publicLiveEvent.findFirst({ where: { expiresAt: { gt: new Date() }, ...(fixtureId ? { fixtureId } : {}) }, orderBy: { id: "asc" }, select: { id: true } });
      if (cursor !== undefined && earliest && cursor < earliest.id - 1n) { write(reply, `event: stream.reset\ndata: ${JSON.stringify({ reason: "cursor_expired", latest_event_id: earliest.id.toString(), snapshot_required: true })}\n\n`); cursor = earliest.id - 1n; }
      const rows = await db.publicLiveEvent.findMany({ where: { id: cursor === undefined ? undefined : { gt: cursor }, expiresAt: { gt: new Date() }, ...(fixtureId ? { fixtureId } : {}), ...(types?.length ? { eventType: { in: types } } : {}) }, orderBy: { id: "asc" }, take: batchSize() });
      for (const row of rows) { if (!write(reply, `id: ${row.id.toString()}\nevent: ${row.eventType}\ndata: ${JSON.stringify(toLiveEnvelope(row))}\n\n`)) return close(); cursor = row.id; }
    } catch { close(true); return; } timer = setTimeout(() => void poll(), pollMs()); };
    void poll();
    return reply;
  };
  app.get("/api/public/live", handler); app.get("/api/public/matches/:fixtureId/live", handler);
}
