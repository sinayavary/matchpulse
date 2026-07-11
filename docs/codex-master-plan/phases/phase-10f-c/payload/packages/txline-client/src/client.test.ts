import assert from "node:assert/strict";
import test from "node:test";
import {
  TxlineCompleteClient,
  TxlineClientError,
  parseTxlineSse,
  type TxlineRequest,
} from "./client.js";
import { createTxlineLiveClient, TxlineLiveError } from "./live.js";

const config = { apiBaseUrl: "https://txline.example/api", httpTimeoutMs: 2500 };
async function* chunks(...values: string[]) { for (const value of values) yield value; }

test("REST fixture request uses the canonical path and parameters", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({ config, request: async (request) => { seen.push(request); return [{ FixtureId: 1 }]; } });
  const result = await client.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 });
  assert.deepEqual(result, [{ FixtureId: 1 }]);
  assert.deepEqual(seen, [{ path: "/fixtures/snapshot", params: { competitionId: "430", startEpochDay: 20608 } }]);
});

test("REST score and odds snapshot paths encode fixture IDs", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({ config, request: async (request) => { seen.push(request); return {}; } });
  await client.getScoreSnapshot({ fixtureId: "a/b", asOf: 12 });
  await client.getOddsSnapshot({ fixtureId: "a/b", asOf: 13 });
  assert.deepEqual(seen, [
    { path: "/scores/snapshot/a%2Fb", params: { asOf: 12 } },
    { path: "/odds/snapshot/a%2Fb", params: { asOf: 13 } },
  ]);
});

test("fixture, score, and odds update methods use documented paths", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({ config, request: async (request) => { seen.push(request); return []; } });
  await client.getFixtureUpdates({ epochDay: 20608, hourOfDay: 9 });
  await client.getScoreUpdates({ fixtureId: "a/b" });
  await client.getScoreHistorical({ fixtureId: "a/b" });
  await client.getScoreIntervalUpdates({ epochDay: 20608, hourOfDay: 9, interval: 4, fixtureId: "42" });
  await client.getOddsUpdates({ fixtureId: "a/b" });
  await client.getOddsIntervalUpdates({ epochDay: 20608, hourOfDay: 9, interval: 4 });
  assert.deepEqual(seen, [
    { path: "/fixtures/updates/20608/9" },
    { path: "/scores/updates/a%2Fb" },
    { path: "/scores/historical/a%2Fb" },
    { path: "/scores/updates/20608/9/4", params: { fixtureId: "42" } },
    { path: "/odds/updates/a%2Fb" },
    { path: "/odds/updates/20608/9/4", params: undefined },
  ]);
});

test("proof request methods preserve exact documented query names", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({ config, request: async (request) => { seen.push(request); return {}; } });
  await client.getFixtureValidation({ fixtureId: "77", timestamp: 1234 });
  await client.getFixtureBatchValidation({ epochDay: 20608, hourOfDay: 9 });
  await client.getOddsValidation({ messageId: "message-1", ts: 5678 });
  await client.getScoreStatValidation({ fixtureId: "77", seq: 941, statKey: 1002, statKey2: 1001 });
  await client.getScoreStatValidation({ fixtureId: "77", seq: 941, statKeys: [1001, 1002, 7] });
  assert.deepEqual(seen, [
    { path: "/fixtures/validation", params: { fixtureId: "77", timestamp: 1234 } },
    { path: "/fixtures/batch-validation", params: { epochDay: 20608, hourOfDay: 9 } },
    { path: "/odds/validation", params: { messageId: "message-1", ts: 5678 } },
    { path: "/scores/stat-validation", params: { fixtureId: "77", seq: 941, statKey: 1002, statKey2: 1001 } },
    { path: "/scores/stat-validation", params: { fixtureId: "77", seq: 941, statKeys: "1001,1002,7" } },
  ]);
});

test("official score and odds stream bindings retain the API base path", async () => {
  const urls: string[] = [];
  const client = new TxlineCompleteClient({
    config,
    request: async () => null,
    openSse: async (url) => {
      urls.push(url.toString());
      return chunks("event: heartbeat\ndata: {\"Ts\":12345}\n\n");
    },
  });
  const scoreEvents = [];
  for await (const event of client.streamScores()) scoreEvents.push(event);
  const oddsEvents = [];
  for await (const event of client.streamOdds()) oddsEvents.push(event);
  assert.deepEqual(urls, [
    "https://txline.example/api/scores/stream",
    "https://txline.example/api/odds/stream",
  ]);
  assert.deepEqual(scoreEvents, [{ event: "heartbeat", id: null, data: "{\"Ts\":12345}" }]);
  assert.deepEqual(oddsEvents, [{ event: "heartbeat", id: null, data: "{\"Ts\":12345}" }]);
});

test("SSE parser handles chunk boundaries, comments, IDs, events, and multiline data", async () => {
  const events = [];
  for await (const event of parseTxlineSse(chunks(": heartbeat\r\nid: 7\r\nevent: score\r\ndata: {\"a\":", "1}\r\ndata: next\r\n\r\n"))) events.push(event);
  assert.deepEqual(events, [{ event: "score", id: "7", data: "{\"a\":1}\nnext" }]);
});

test("SSE parser handles CRLF pairs split across chunks", async () => {
  const events = [];
  for await (const event of parseTxlineSse(chunks("event: score\r", "\nid: 9\r", "\ndata: ok\r", "\n\r", "\n"))) events.push(event);
  assert.deepEqual(events, [{ event: "score", id: "9", data: "ok" }]);
});

test("SSE parser rejects a truncated final event", async () => {
  await assert.rejects(async () => { for await (const _event of parseTxlineSse(chunks("data: incomplete"))) { /* consume */ } },
    (error: unknown) => error instanceof TxlineClientError && error.kind === "invalid_stream");
});

test("stream passes secret headers only to the injected opener", async () => {
  let observedUrl = "";
  let observedHeaders: Readonly<Record<string, string>> = {};
  const client = new TxlineCompleteClient({
    config, credentials: { guestJwt: "guest-secret", apiToken: "api-secret" }, request: async () => null,
    openSse: async (url, headers) => { observedUrl = url.toString(); observedHeaders = headers; return chunks("event: fixture\ndata: ok\n\n"); },
  });
  const events = [];
  for await (const event of client.stream("/stream/matches", { competitionId: 430 })) events.push(event);
  assert.equal(observedUrl, "https://txline.example/stream/matches?competitionId=430");
  assert.deepEqual(observedHeaders, { Authorization: "Bearer guest-secret", "X-Api-Token": "api-secret" });
  assert.deepEqual(events, [{ event: "fixture", id: null, data: "ok" }]);
});

test("live wrapper reports the network-resolved endpoint host", async () => {
  const live = createTxlineLiveClient(
    { TXLINE_NETWORK: "mainnet" },
    { request: async (request) => { throw new TxlineClientError("network", request.path, "failed"); } },
  );
  await assert.rejects(
    () => live.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 }),
    (error: unknown) => error instanceof TxlineLiveError && error.safe.endpointHost === "txline.txodds.com",
  );
});

test("fromEnv does not expose credential values", () => {
  const client = TxlineCompleteClient.fromEnv({ TXLINE_API_BASE_URL: "https://txline.example/api", TXLINE_GUEST_JWT: "guest-secret", TXLINE_API_TOKEN: "api-secret" });
  assert.equal(JSON.stringify(client).includes("guest-secret"), false);
  assert.equal(JSON.stringify(client).includes("api-secret"), false);
});

test("stream resume headers and signal are propagated without mutating credential headers", async () => {
  let headers: Readonly<Record<string, string>> = {}; let signal: AbortSignal | undefined;
  const controller = new AbortController();
  const client = new TxlineCompleteClient({ config, credentials: { guestJwt: "guest", apiToken: "api" }, request: async () => null,
    openSse: async (_url, received, options) => { headers = received; signal = options?.signal; return chunks("data: ok\n\n"); } });
  for await (const _event of client.streamScores({ signal: controller.signal, lastEventId: "42" })) { /* consume */ }
  assert.deepEqual(headers, { Authorization: "Bearer guest", "X-Api-Token": "api", "Last-Event-ID": "42" }); assert.equal(signal, controller.signal);
});

test("empty stream cursor does not add a resume header", async () => {
  let headers: Readonly<Record<string, string>> = {};
  const client = new TxlineCompleteClient({ config, request: async () => null, openSse: async (_url, received) => { headers = received; return chunks("data: ok\n\n"); } });
  for await (const _event of client.streamOdds({ lastEventId: "" })) { /* consume */ }
  assert.equal("Last-Event-ID" in headers, false);
});

test("aborted stream opener is sanitized", async () => {
  const client = new TxlineCompleteClient({ config, request: async () => null, openSse: async () => { throw new DOMException("secret", "AbortError"); } });
  await assert.rejects(async () => { for await (const _event of client.streamScores()) { /* consume */ } }, (error: unknown) => error instanceof TxlineClientError && error.kind === "aborted" && !error.message.includes("secret"));
});

test("live stream wrapper sanitizes asynchronous client errors", async () => {
  const live = createTxlineLiveClient({ TXLINE_API_BASE_URL: "https://txline.example/api" }, { openSse: async () => ({ async *[Symbol.asyncIterator]() { throw new TxlineClientError("network", "scores/stream", "secret failure"); } }) });
  await assert.rejects(async () => { for await (const _event of live.streamScores()) { /* consume */ } }, (error: unknown) => error instanceof TxlineLiveError && error.safe.kind === "network" && !JSON.stringify(error.safe).includes("secret"));
});

test("injected async iterable abort is sanitized during stream iteration", async () => {
  const client = new TxlineCompleteClient({ config, request: async () => null, openSse: async () => ({ async *[Symbol.asyncIterator]() { throw new DOMException("sensitive raw message", "AbortError"); } }) });
  await assert.rejects(async () => { for await (const _event of client.streamScores()) { /* consume */ } },
    (error: unknown) => error instanceof TxlineClientError && error.kind === "aborted" && error.message === "The TxLINE request was cancelled." && !error.message.includes("sensitive raw message"));
});

test("generic injected iteration errors are safely wrapped", async () => {
  const client = new TxlineCompleteClient({ config, request: async () => null, openSse: async () => ({ async *[Symbol.asyncIterator]() { throw new Error("provider secret detail"); } }) });
  await assert.rejects(async () => { for await (const _event of client.streamScores()) { /* consume */ } },
    (error: unknown) => error instanceof TxlineClientError && error.kind === "unknown" && !error.message.includes("provider secret detail"));
});

test("live wrapper sanitizes asynchronous abort errors", async () => {
  const live = createTxlineLiveClient({ TXLINE_API_BASE_URL: "https://txline.example/api" }, { openSse: async () => ({ async *[Symbol.asyncIterator]() { throw new DOMException("sensitive raw message", "AbortError"); } }) });
  await assert.rejects(async () => { for await (const _event of live.streamScores()) { /* consume */ } },
    (error: unknown) => error instanceof TxlineLiveError && error.safe.kind === "aborted" && !error.safe.message.includes("sensitive raw message"));
});

test("default SSE reader is cancelled and released when the consumer stops early", async () => {
  const originalFetch = globalThis.fetch; let cancelled = 0; let released = 0;
  const reader = { read: async () => ({ done: false, value: new TextEncoder().encode("data: first\n\ndata: second\n\n") }), cancel: async () => { cancelled++; }, releaseLock: () => { released++; } };
  globalThis.fetch = async () => ({ ok: true, status: 200, body: { getReader: () => reader } } as unknown as Response);
  try {
    const client = new TxlineCompleteClient({ config, request: async () => null });
    for await (const _event of client.streamScores()) break;
    assert.equal(cancelled, 1); assert.equal(released, 1);
  } finally { globalThis.fetch = originalFetch; }
});
