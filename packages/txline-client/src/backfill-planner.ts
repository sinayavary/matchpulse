export type BackfillRequest = { fixtureId: string; domain: "scores" | "odds"; epochDay: number; hourOfDay: number; interval: number };
export type BackfillPlan = { startEpochMs: number; endEpochMs: number; fixtures: readonly string[]; domains: readonly ("scores" | "odds")[]; maxIntervals: number };

export function enumerateBackfill(plan: BackfillPlan): BackfillRequest[] {
  if (!Number.isSafeInteger(plan.startEpochMs) || !Number.isSafeInteger(plan.endEpochMs) || plan.endEpochMs < plan.startEpochMs) throw new Error("Invalid backfill range");
  if (plan.fixtures.length === 0 || plan.domains.length === 0 || plan.maxIntervals < 1) return [];
  const result: BackfillRequest[] = [];
  for (let ts = plan.startEpochMs, count = 0; ts <= plan.endEpochMs && count < plan.maxIntervals; ts += 5 * 60_000, count++) {
    const date = new Date(ts);
    const epochDay = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
    const hourOfDay = date.getUTCHours();
    const interval = Math.floor(date.getUTCMinutes() / 5);
    for (const fixtureId of [...plan.fixtures].sort()) for (const domain of [...plan.domains].sort()) result.push({ fixtureId, domain, epochDay, hourOfDay, interval });
  }
  return result;
}

export async function runBackfill<T>(requests: readonly BackfillRequest[], worker: (request: BackfillRequest) => Promise<T>, concurrency = 2): Promise<T[]> {
  const limit = Math.max(1, Math.min(16, Math.trunc(concurrency)));
  const output: T[] = []; let cursor = 0;
  async function consume(): Promise<void> { while (cursor < requests.length) { const index = cursor++; output[index] = await worker(requests[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, requests.length) }, () => consume()));
  return output;
}
