import assert from "node:assert/strict";
import test from "node:test";
import {
  TxlineCompleteClient,
  TxlineClientError,
  parseTxlineSse,
  type TxlineRequest,
} from "./client.js";

const config = {
  apiBaseUrl: "https://txline.example/api",
  httpTimeoutMs: 2500,
};

async function* chunks(...values: string[]) {
  for (const value of values) yield value;
}

test("REST fixture request uses the canonical path and parameters", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({
    config,
    request: async (request) => {
      seen.push(request);
      return [{ FixtureId: 1 }];
    },
  });
  const result = await client.getFixtureSnapshot({ competitionId: "430", startEpochDay: 20608 });
  assert.deepEqual(result, [{ FixtureId: 1 }]);
  assert.deepEqual(seen, [{
    path: "/fixtures/snapshot",
    params: { competitionId: "430", startEpochDay: 20608 },
  }]);
});

test("REST score and odds paths encode fixture IDs", async () => {
  const seen: TxlineRequest[] = [];
  const client = new TxlineCompleteClient({
    config,
    request: async (request) => {
      seen.push(request);
      return {};
    },
  });
  await client.getScoreSnapshot({ fixtureId: "a/b", asOf: 12 });
  await client.getOddsSnapshot({ fixtureId: "a/b", asOf: 13 });
  assert.deepEqual(seen, [
    { path: "/scores/snapshot/a%2Fb", params: { asOf: 12 } },
    { path: "/odds/snapshot/a%2Fb", params: { asOf: 13 } },
  ]);
});

test("SSE parser handles chunk boundaries, comments, IDs, events, and multiline data", async () => {
  const events = [];
  for await (const event of parseTxlineSse(chunks(
    ": heartbeat\r\nid: 7\r\nevent: score\r\ndata: {\"a\":",
    "1}\r\ndata: next\r\n\r\n",
  ))) {
    events.push(event);
  }
  assert.deepEqual(events, [{
    event: "score",
    id: "7",
    data: "{\"a\":1}\nnext",
  }]);
});

test("SSE parser rejects a truncated final event", async () => {
  await assert.rejects(async () => {
    for await (const _event of parseTxlineSse(chunks("data: incomplete"))) {
      // consume
    }
  }, (error: unknown) => error instanceof TxlineClientError && error.kind === "invalid_stream");
});

test("stream passes secret headers only to the injected opener", async () => {
  let observedUrl = "";
  let observedHeaders: Readonly<Record<string, string>> = {};
  const client = new TxlineCompleteClient({
    config,
    credentials: { guestJwt: "guest-secret", apiToken: "api-secret" },
    request: async () => null,
    openSse: async (url, headers) => {
      observedUrl = url.toString();
      observedHeaders = headers;
      return chunks("event: fixture\ndata: ok\n\n");
    },
  });
  const events = [];
  for await (const event of client.stream("/stream/matches", { competitionId: 430 })) {
    events.push(event);
  }
  assert.equal(observedUrl, "https://txline.example/stream/matches?competitionId=430");
  assert.deepEqual(observedHeaders, {
    Authorization: "Bearer guest-secret",
    "X-Api-Token": "api-secret",
  });
  assert.deepEqual(events, [{ event: "fixture", id: null, data: "ok" }]);
});

test("fromEnv does not expose credential values", () => {
  const client = TxlineCompleteClient.fromEnv({
    TXLINE_API_BASE_URL: "https://txline.example/api",
    TXLINE_GUEST_JWT: "guest-secret",
    TXLINE_API_TOKEN: "api-secret",
  });
  assert.equal(JSON.stringify(client).includes("guest-secret"), false);
  assert.equal(JSON.stringify(client).includes("api-secret"), false);
});
