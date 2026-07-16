import test from "node:test";
import assert from "node:assert/strict";
import { createStreamCheckpoint, TxlineStreamSupervisor } from "./stream-supervisor.js";
import { enumerateBackfill, runBackfill } from "./backfill-planner.js";

test("supervisor resumes from checkpoint and deduplicates events", async () => {
  const opened: (string | null)[] = []; const events: string[] = [];
  const supervisor = new TxlineStreamSupervisor({ streamKind: "scores", maxReconnects: 1, sleep: async () => {}, random: () => 0,
    open: async function* (last) { opened.push(last); yield { event: "score", id: "1", data: "a" }; if (opened.length === 1) throw new Error("drop"); },
    onEvent: (event) => { events.push(event.data); } });
  const result = await supervisor.run();
  assert.deepEqual(events, ["a"]); assert.deepEqual(opened, [null, "1"]); assert.equal(result.status, "failed"); assert.equal(result.reconnectCount, 2);
});

test("backfill is deterministic, bounded, and concurrency limited", async () => {
  const plan = enumerateBackfill({ startEpochMs: Date.UTC(2026, 0, 1), endEpochMs: Date.UTC(2026, 0, 1, 0, 10), fixtures: ["b", "a"], domains: ["odds", "scores"], maxIntervals: 2 });
  assert.deepEqual(plan.map((item) => `${item.fixtureId}:${item.domain}:${item.interval}`), ["a:odds:0", "a:scores:0", "b:odds:0", "b:scores:0", "a:odds:1", "a:scores:1", "b:odds:1", "b:scores:1"]);
  let active = 0; let peak = 0; const result = await runBackfill(plan, async (item) => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return item.fixtureId; }, 2);
  assert.equal(peak, 2); assert.equal(result.length, 8);
});

test("checkpoint has explicit resumable lifecycle fields", () => { const checkpoint = createStreamCheckpoint("odds", 123); assert.equal(checkpoint.status, "idle"); assert.equal(checkpoint.lastSseId, null); });
