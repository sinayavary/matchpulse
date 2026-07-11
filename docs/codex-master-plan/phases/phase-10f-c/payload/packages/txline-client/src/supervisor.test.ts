import assert from "node:assert/strict";
import test from "node:test";
import { TxlineStreamSupervisor, TxlineStreamSupervisorError, createTxlineOddsStreamSupervisor, createTxlineScoreStreamSupervisor } from "./supervisor.js";
import type { TxlineSseEvent } from "./client.js";

const event = (id: string | null, data = "ok", name: string | null = "score"): TxlineSseEvent => ({ id, data, event: name });
async function* values(...items: TxlineSseEvent[]) { yield* items; }
async function collect(source: AsyncIterable<TxlineSseEvent>, stop?: () => void) { const found: TxlineSseEvent[] = []; for await (const item of source) { found.push(item); stop?.(); } return found; }

test("initial lifecycle records event timing and stops on abort", async () => {
  const controller = new AbortController(); const states: string[] = []; let now = 10;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values(event("1")), now: () => ++now, onStateChange: s => states.push(s.status) });
  const result = await collect(supervisor.run(controller.signal), () => controller.abort());
  assert.deepEqual(result.map(v => v.id), ["1"]); assert.deepEqual(states.slice(0, 2), ["connecting", "connected"]); assert.equal(supervisor.getSnapshot().lastEventReceivedAtMs, 11); assert.equal(supervisor.getSnapshot().status, "stopped");
});

test("uses an exact bounded reconnect schedule and resets after valid events", async () => {
  const delays: number[] = []; let opens = 0; const controller = new AbortController();
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; if (opens < 4) throw new Error("x"); return values(event("ok")); }, sleep: async delay => { delays.push(delay); }, reconnectDelaysMs: [250, 500, 1000] });
  await collect(supervisor.run(controller.signal), () => controller.abort()); assert.deepEqual(delays, [250, 500, 1000]);
});

test("catch-up follows backoff and shares duplicate suppression", async () => {
  const order: string[] = []; let opens = 0; const controller = new AbortController();
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { order.push("open"); opens++; if (opens === 1) return values(event("1")); return values(event("2"), event("3")); }, sleep: async () => { order.push("backoff"); }, catchUp: async () => { order.push("catch-up"); return [event("1"), event("2")]; } });
  const result = await collect(supervisor.run(controller.signal), () => { if (order.includes("catch-up") && opens === 2) controller.abort(); });
  assert.deepEqual(result.map(v => v.id), ["1", "2", "3"]); assert.deepEqual(order, ["open", "backoff", "catch-up", "open"]);
});

test("resumes with last ID and clears an empty ID", async () => {
  const cursors: Array<string | null> = []; let opened = 0; const controller = new AbortController();
  const supervisor = new TxlineStreamSupervisor({ openStream: context => { cursors.push(context.lastEventId); opened++; return values(opened === 1 ? event("one") : event("")); }, sleep: async () => undefined });
  await collect(supervisor.run(controller.signal), () => { if (opened > 2) controller.abort(); }); assert.deepEqual(cursors.slice(0, 3), [null, "one", null]);
});

test("validates heartbeats and reconnects after invalid heartbeat", async () => {
  let opened = 0; const controller = new AbortController(); const supervisor = new TxlineStreamSupervisor({ openStream: () => values(opened++ === 0 ? event(null, "{\"Ts\":12345}", "heartbeat") : event("done")), sleep: async () => undefined, now: () => 99 });
  const result = await collect(supervisor.run(controller.signal), () => { if (opened > 1) controller.abort(); }); assert.equal(result[0]?.event, "heartbeat"); assert.equal(supervisor.getSnapshot().lastHeartbeatProviderTs, 12345);
  const bad = new TxlineStreamSupervisor({ openStream: () => values(event(null, "{\"Ts\":\"bad\"}", "heartbeat")), sleep: async () => undefined, reconnectDelaysMs: [1] });
  await assert.rejects(async () => { for await (const _ of bad.run()) { /* consume */ } }, (e: unknown) => e instanceof TxlineStreamSupervisorError && e.lastReason === "invalid_heartbeat");
});

test("timeout aborts the attempt and stream exhaustion is terminal", async () => {
  const delays: number[] = []; let calls = 0; const supervisor = new TxlineStreamSupervisor({ openStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => new Promise<IteratorResult<TxlineSseEvent>>(() => undefined), return: async () => ({ done: true, value: undefined }) }) }), nextWithTimeout: async () => ({ kind: "timeout" }), sleep: async delay => { delays.push(delay); }, reconnectDelaysMs: [1, 2] });
  await assert.rejects(async () => { for await (const _ of supervisor.run()) { calls++; } }, (e: unknown) => e instanceof TxlineStreamSupervisorError && e.kind === "reconnect_exhausted" && e.reconnectAttempts === 2 && e.lastReason === "heartbeat_timeout"); assert.deepEqual(delays, [1, 2]); assert.equal(calls, 0);
});

test("abort during backoff skips catch-up and configuration is validated", async () => {
  const controller = new AbortController(); let catchups = 0; let opens = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; throw new Error("x"); }, sleep: async (_delay, signal) => { controller.abort(); if (signal.aborted) throw new DOMException("aborted", "AbortError"); throw new Error("Expected propagated abort signal."); }, catchUp: async () => { catchups++; return []; } });
  await collect(supervisor.run(controller.signal)); assert.equal(catchups, 0); assert.equal(opens, 1); assert.equal(supervisor.getSnapshot().status, "stopped");
  for (const options of [{ reconnectDelaysMs: [] }, { reconnectDelaysMs: [-1] }, { reconnectDelaysMs: [1.5] }, { reconnectDelaysMs: [NaN] }, { heartbeatTimeoutMs: 0 }, { heartbeatTimeoutMs: 1.5 }, { dedupeCapacity: 0 }, { dedupeCapacity: 1.5 }]) assert.throws(() => new TxlineStreamSupervisor({ openStream: () => values(), ...options }), TypeError);
});

test("FIFO dedupe, null IDs, isolated snapshots, and bound factories", async () => {
  const controller = new AbortController(); const snapshots: Array<{ status: string }> = []; let delivered = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values(event("1"), event("2"), event("3"), event("1"), event(null), event(null)), dedupeCapacity: 2, onStateChange: s => { snapshots.push(s); (s as { status: string }).status = "bad"; } });
  const result = await collect(supervisor.run(controller.signal), () => { delivered++; if (delivered === 6) controller.abort(); }); assert.deepEqual(result.map(v => v.id), ["1", "2", "3", "1", null, null]); assert.notEqual(supervisor.getSnapshot().status, "bad"); snapshots[0]!.status = "bad"; assert.notEqual(supervisor.getSnapshot().status, "bad");
  const scoreCalls: unknown[] = []; const oddsCalls: unknown[] = [];
  const score = createTxlineScoreStreamSupervisor({ streamScores: options => { scoreCalls.push(options); return values(event("x")); } }, {}); const odds = createTxlineOddsStreamSupervisor({ streamOdds: options => { oddsCalls.push(options); return values(event("x")); } }, {});
  const signal = new AbortController(); await collect(score.run(signal.signal), () => signal.abort()); const signal2 = new AbortController(); await collect(odds.run(signal2.signal), () => signal2.abort()); assert.equal((scoreCalls[0] as { signal: AbortSignal }).signal, signal.signal); assert.equal((oddsCalls[0] as { signal: AbortSignal }).signal, signal2.signal);
});

test("initial snapshot is idle", () => {
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values() });
  assert.equal(supervisor.getSnapshot().status, "idle");
});

test("state changes include connecting and connected", async () => {
  const controller = new AbortController(); const states: string[] = [];
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values(event("one")), onStateChange: state => states.push(state.status) });
  await collect(supervisor.run(controller.signal), () => controller.abort());
  assert.deepEqual(states.slice(0, 2), ["connecting", "connected"]);
});

test("three bounded failures use exact 250 500 1000 delays", async () => {
  const delays: number[] = []; let opens = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; throw new Error("offline"); }, sleep: async delay => { delays.push(delay); }, reconnectDelaysMs: [250, 500, 1000] });
  await assert.rejects(async () => { for await (const _event of supervisor.run()) { /* none */ } }, TxlineStreamSupervisorError);
  assert.equal(opens, 4); assert.deepEqual(delays, [250, 500, 1000]);
});

test("duplicate valid events reset the reconnect counter", async () => {
  const controller = new AbortController(); const delays: number[] = []; let opens = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; return values(event("same")); }, reconnectDelaysMs: [11, 22], sleep: async (delay, signal) => { delays.push(delay); if (delays.length === 2) { controller.abort(); if (signal.aborted) throw new DOMException("aborted", "AbortError"); throw new Error("Expected propagated abort signal."); } } });
  await collect(supervisor.run(controller.signal));
  assert.equal(opens, 2); assert.deepEqual(delays, [11, 11]); assert.equal(supervisor.getSnapshot().status, "stopped");
});

test("catch-up is not called for the initial stream", async () => {
  const controller = new AbortController(); let called = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values(event("one")), catchUp: async () => { called++; return []; } });
  await collect(supervisor.run(controller.signal), () => controller.abort());
  assert.equal(called, 0);
});

test("null IDs are never deduplicated", async () => {
  const controller = new AbortController(); let seen = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values(event(null), event(null)) });
  const found = await collect(supervisor.run(controller.signal), () => { seen++; if (seen === 2) controller.abort(); });
  assert.equal(found.length, 2);
});

for (const [label, data] of [["non JSON", "bad"], ["empty object", "{}"], ["string timestamp", '{"Ts":"123"}'], ["negative timestamp", '{"Ts":-1}'], ["fractional timestamp", '{"Ts":1.5}']] as const) {
  test(`invalid heartbeat ${label} reconnects deterministically`, async () => {
    let opens = 0; const delays: number[] = [];
    const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; return values(event(null, data, "heartbeat")); }, sleep: async delay => { delays.push(delay); }, reconnectDelaysMs: [1] });
    await assert.rejects(async () => { for await (const _event of supervisor.run()) { /* none */ } }, (error: unknown) => error instanceof TxlineStreamSupervisorError && error.lastReason === "invalid_heartbeat");
    assert.equal(opens, 2); assert.deepEqual(delays, [1]);
  });
}

test("external abort during catch-up stops without a terminal error", async () => {
  const controller = new AbortController(); let opens = 0; let catchups = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; throw new Error("offline"); }, sleep: async () => undefined, catchUp: async () => { catchups++; controller.abort(); throw new DOMException("raw", "AbortError"); } });
  const result = await collect(supervisor.run(controller.signal));
  assert.deepEqual(result, []); assert.equal(catchups, 1); assert.equal(opens, 1); assert.equal(supervisor.getSnapshot().status, "stopped");
});

test("non-abort catch-up failure is terminal", async () => {
  let opens = 0;
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; throw new Error("offline"); }, sleep: async () => undefined, catchUp: async () => { throw new Error("provider secret"); } });
  await assert.rejects(async () => { for await (const _event of supervisor.run()) { /* none */ } }, (error: unknown) => error instanceof TxlineStreamSupervisorError && error.kind === "catch_up_failed");
  assert.equal(opens, 1); assert.equal(supervisor.getSnapshot().status, "failed");
});

test("snapshot reads are isolated from callers", () => {
  const supervisor = new TxlineStreamSupervisor({ openStream: () => values() });
  const snapshot = supervisor.getSnapshot() as { status: string }; snapshot.status = "failed";
  assert.equal(supervisor.getSnapshot().status, "idle");
});

test("stream ended reconnect exhaustion has bounded opens and sleeps", async () => {
  let opens = 0; const delays: number[] = [];
  const supervisor = new TxlineStreamSupervisor({ openStream: () => { opens++; return values(); }, sleep: async delay => { delays.push(delay); }, reconnectDelaysMs: [7] });
  await assert.rejects(async () => { for await (const _event of supervisor.run()) { /* none */ } }, (error: unknown) => error instanceof TxlineStreamSupervisorError && error.lastReason === "stream_ended");
  assert.equal(opens, 2); assert.deepEqual(delays, [7]);
});

test("score factory resumes with its cursor across reconnects", async () => {
  const calls: Array<{ signal?: AbortSignal; lastEventId?: string }> = []; const active: boolean[] = []; const controller = new AbortController();
  const supervisor = createTxlineScoreStreamSupervisor({ streamScores: options => { calls.push(options!); active.push(options!.signal instanceof AbortSignal && !options!.signal.aborted); if (calls.length === 2) controller.abort(); return values(event("score-cursor")); } }, { sleep: async () => undefined });
  await collect(supervisor.run(controller.signal));
  assert.equal(calls.length, 2); assert.equal(calls[0]!.lastEventId, undefined); assert.equal(calls[1]!.lastEventId, "score-cursor"); assert.ok(calls[0]!.signal instanceof AbortSignal); assert.ok(calls[1]!.signal instanceof AbortSignal); assert.deepEqual(active, [true, true]); assert.equal(supervisor.getSnapshot().status, "stopped");
});

test("odds factory resumes with its cursor across reconnects", async () => {
  const calls: Array<{ signal?: AbortSignal; lastEventId?: string }> = []; const active: boolean[] = []; const controller = new AbortController();
  const supervisor = createTxlineOddsStreamSupervisor({ streamOdds: options => { calls.push(options!); active.push(options!.signal instanceof AbortSignal && !options!.signal.aborted); if (calls.length === 2) controller.abort(); return values(event("odds-cursor")); } }, { sleep: async () => undefined });
  await collect(supervisor.run(controller.signal));
  assert.equal(calls.length, 2); assert.equal(calls[0]!.lastEventId, undefined); assert.equal(calls[1]!.lastEventId, "odds-cursor"); assert.ok(calls[0]!.signal instanceof AbortSignal); assert.ok(calls[1]!.signal instanceof AbortSignal); assert.deepEqual(active, [true, true]); assert.equal(supervisor.getSnapshot().status, "stopped");
});
