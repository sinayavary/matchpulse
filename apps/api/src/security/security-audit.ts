import { pseudonym } from "./security-crypto.js";
const forbidden = /token|secret|signature|private.?key|seed|password|credential|provider.?payload|formula|weight|threshold|lineage/i;
function redact(value: unknown, key = ""): unknown {
  if (forbidden.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 30).map(([k, v]) => [k, redact(v, k)]));
  if (typeof value === "string" && value.length > 256) return value.slice(0, 256);
  return value;
}
export type AuditEvent = { event: string; actor?: string; route?: string; success: boolean; metadata?: Record<string, unknown> };
export function redactAuditEvent(event: AuditEvent) { return redact({ ...event, actor: event.actor ? pseudonym(event.actor) : undefined }) as AuditEvent; }
export function createSecurityAuditSink() { const events: AuditEvent[] = []; return { append(event: AuditEvent) { events.push(redactAuditEvent(event)); if (events.length > 1000) events.shift(); }, list() { return [...events]; } }; }
