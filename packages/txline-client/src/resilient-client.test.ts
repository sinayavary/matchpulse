import assert from "node:assert/strict";
import test from "node:test";
import { TxlineClientError, type TxlineRequest, type TxlineSseEvent } from "./client.js";
import { TxlineResilientClient } from "./resilient-client.js";
import { createTxlineLiveClient, TxlineLiveError } from "./live.js";

const config = { apiBaseUrl: "https://txline.example/api", httpTimeoutMs: 2500 };
async function* chunks(...values: string[]) { for (const value of values) yield value; }

test("resilient client preserves canonical provider request construction", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineResilientClient({
    config,
    request: async (request) => { seen.push(request); return {}; },
  });
  await client.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 });
  await client.getScoreSnapshot({ fixtureId: "a/b", asOf: 12 });
  await client.getOddsIntervalUpdates({ epochDay: 20608, hourOfDay: 9, interval: 4 });
  assert.deepEqual(seen, [
    { path: "/fixtures/snapshot", params: { competitionId: "430", startEpochDay: 20608 } },
    { path: "/scores/snapshot/a%2Fb", params: { asOf: 12 } },
    { path: "/odds/updates/20608/9/4", params: undefined },
  ]);
});

test("transient failures retry with deterministic bounded backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const client = new TxlineResilientClient({
    config,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 5, maxDelayMs: 20 },
    sleep: async (delay) => { delays.push(delay); },
    request: async (request) => {
      calls += 1;
      if (calls < 3) throw new TxlineClientError("server_error", request.path, "temporary", 503);
      return { ok: true };
    },
  });
  assert.deepEqual(await client.getScoreUpdates({ fixtureId: "42" }), { ok: true });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [5, 10]);
});

test("retry count is clamped and non-transient failures never retry", async () => {
  let transientCalls = 0;
  const bounded = new TxlineResilientClient({
    config,
    retryPolicy: { maxAttempts: 99, baseDelayMs: 0 },
    request: async (request) => {
      transientCalls += 1;
      throw new TxlineClientError("network", request.path, "offline");
    },
  });
  await assert.rejects(() => bounded.getOddsUpdates({ fixtureId: "42" }));
  assert.equal(transientCalls, 5);

  let forbiddenCalls = 0;
  const forbidden = new TxlineResilientClient({
    config,
    request: async (request) => {
      forbiddenCalls += 1;
      throw new TxlineClientError("forbidden", request.path, "denied", 403);
    },
  });
  await assert.rejects(
    () => forbidden.getOddsUpdates({ fixtureId: "42" }),
    (error: unknown) => error instanceof TxlineClientError && error.kind === "forbidden",
  );
  assert.equal(forbiddenCalls, 1);
});

test("401 refreshes the guest JWT at most once and replays the operation", async () => {
  let calls = 0;
  let refreshes = 0;
  const client = new TxlineResilientClient({
    config,
    credentials: { guestJwt: "old", apiToken: "api" },
    refreshGuestJwt: async () => {
      refreshes += 1;
      return "new";
    },
    request: async (request) => {
      calls += 1;
      if (calls === 1) throw new TxlineClientError("unauthorized", request.path, "expired", 401);
      return { ok: true };
    },
  });
  assert.deepEqual(await client.getFixtureUpdates({ epochDay: 20608, hourOfDay: 9 }), { ok: true });
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test("a second 401 after refresh stops without another refresh", async () => {
  let calls = 0;
  let refreshes = 0;
  const client = new TxlineResilientClient({
    config,
    refreshGuestJwt: async () => { refreshes += 1; return "new"; },
    request: async (request) => {
      calls += 1;
      throw new TxlineClientError("unauthorized", request.path, "expired", 401);
    },
  });
  await assert.rejects(
    () => client.getFixtureUpdates({ epochDay: 20608, hourOfDay: 9 }),
    (error: unknown) => error instanceof TxlineClientError && error.kind === "unauthorized",
  );
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test("refresh errors are sanitized", async () => {
  const client = new TxlineResilientClient({
    config,
    refreshGuestJwt: async () => { throw new Error("guest-secret-value"); },
    request: async (request) => {
      throw new TxlineClientError("unauthorized", request.path, "expired", 401);
    },
  });
  await assert.rejects(
    () => client.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 }),
    (error: unknown) => error instanceof TxlineClientError &&
      error.kind === "unauthorized" &&
      !error.message.includes("guest-secret-value"),
  );
});

test("request validation runs before transport", () => {
  let calls = 0;
  const client = new TxlineResilientClient({
    config,
    request: async () => { calls += 1; return null; },
  });
  assert.throws(() => client.getFixtureUpdates({ epochDay: 20608, hourOfDay: 24 }));
  assert.throws(() => client.getOddsIntervalUpdates({ epochDay: 20608, hourOfDay: 9, interval: 12 }));
  assert.throws(() => client.getScoreStatValidation({ fixtureId: "42", seq: 1, statKeys: [] }));
  assert.equal(calls, 0);
});

test("stream path cannot escape the configured TxLINE host", async () => {
  for (const endpointPath of [
    "https://evil.example/stream",
    "//evil.example/stream",
    "../stream",
    "scores\\stream",
  ]) {
    const client = new TxlineResilientClient({
      config,
      request: async () => null,
      openSse: async () => chunks("data: unexpected\n\n"),
    });
    await assert.rejects(async () => {
      for await (const _event of client.stream(endpointPath)) { /* consume */ }
    });
  }
});

test("stream open uses bounded retry and refreshed credentials", async () => {
  let calls = 0;
  let refreshes = 0;
  const headers: Readonly<Record<string, string>>[] = [];
  const client = new TxlineResilientClient({
    config,
    credentials: { guestJwt: "old", apiToken: "api" },
    refreshGuestJwt: async () => { refreshes += 1; return "new"; },
    request: async () => null,
    openSse: async (url, currentHeaders) => {
      calls += 1;
      headers.push(currentHeaders);
      if (calls === 1) throw new TxlineClientError("unauthorized", url.pathname, "expired", 401);
      return chunks("event: heartbeat\ndata: {}\n\n");
    },
  });
  const events: TxlineSseEvent[] = [];
  for await (const event of client.streamScores()) events.push(event);
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
  assert.equal(headers[0]?.Authorization, "Bearer old");
  assert.equal(headers[1]?.Authorization, "Bearer new");
  assert.deepEqual(events, [{ event: "heartbeat", id: null, data: "{}" }]);
});

test("stream failure after the first event is surfaced and not reconnected", async () => {
  let opens = 0;
  const client = new TxlineResilientClient({
    config,
    retryPolicy: { maxAttempts: 5, baseDelayMs: 0 },
    request: async () => null,
    openSse: async () => {
      opens += 1;
      return {
        async *[Symbol.asyncIterator]() {
          yield "event: score\ndata: first\n\n";
          throw new TxlineClientError("network", "scores/stream", "disconnected");
        },
      };
    },
  });
  const events: TxlineSseEvent[] = [];
  await assert.rejects(async () => {
    for await (const event of client.streamScores()) events.push(event);
  });
  assert.deepEqual(events, [{ event: "score", id: null, data: "first" }]);
  assert.equal(opens, 1);
});

test("live factory uses the resilient lifecycle and returns safe errors", async () => {
  let calls = 0;
  const live = createTxlineLiveClient(
    { TXLINE_NETWORK: "mainnet" },
    {
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0 },
      request: async (request) => {
        calls += 1;
        throw new TxlineClientError("network", request.path, "failed");
      },
    },
  );
  await assert.rejects(
    () => live.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 }),
    (error: unknown) => error instanceof TxlineLiveError &&
      error.safe.endpointHost === "txline.txodds.com" &&
      error.safe.kind === "network",
  );
  assert.equal(calls, 2);
});

test("resilient client does not serialize credentials", () => {
  const client = new TxlineResilientClient({
    config,
    credentials: { guestJwt: "guest-secret", apiToken: "api-secret" },
  });
  const serialized = JSON.stringify(client);
  assert.equal(serialized.includes("guest-secret"), false);
  assert.equal(serialized.includes("api-secret"), false);
});
