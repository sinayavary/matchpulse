type Counter = { started: number; count: number; concurrent: number };
export type RateLimitOptions = { windowMs?: number; max?: number; maxConcurrent?: number; bodyBytes?: number; responseBytes?: number; history?: number; sse?: number };
export function createApiRateLimiter(opts: RateLimitOptions = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 120;
  const maxConcurrent = opts.maxConcurrent ?? 10;
  const counters = new Map<string, Counter>();
  const cleanup = () => { const cutoff = Date.now() - windowMs * 2; for (const [key, value] of counters) if (value.started < cutoff && value.concurrent === 0) counters.delete(key); };
  return {
    begin(key: string) { cleanup(); const now = Date.now(); let c = counters.get(key); if (!c || now - c.started >= windowMs) { c = { started: now, count: 0, concurrent: 0 }; counters.set(key, c); } if (c.count >= max || c.concurrent >= maxConcurrent) return false; c.count++; c.concurrent++; return true; },
    end(key: string) { const c = counters.get(key); if (c) c.concurrent = Math.max(0, c.concurrent - 1); },
    limits: { bodyBytes: opts.bodyBytes ?? 1_000_000, responseBytes: opts.responseBytes ?? 5_000_000, history: opts.history ?? 100, sse: opts.sse ?? 1 },
    snapshot(key: string) { return counters.get(key) ?? { started: Date.now(), count: 0, concurrent: 0 }; }
  };
}
