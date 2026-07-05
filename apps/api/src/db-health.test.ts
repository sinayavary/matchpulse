import assert from "node:assert/strict";
import test from "node:test";
import { checkDbHealth } from "./db-health.js";

const checkedAt = "2026-07-05T12:00:00.000Z";
const now = () => new Date(checkedAt);

test("returns an unconfigured result without querying the database", async () => {
  let queryCalled = false;

  const result = await checkDbHealth({
    databaseUrl: null,
    now,
    query: async () => {
      queryCalled = true;
    }
  });

  assert.deepEqual(result, {
    configured: false,
    connected: false,
    checkedAt
  });
  assert.equal(queryCalled, false);
});

test("returns a connected result when the health query succeeds", async () => {
  const result = await checkDbHealth({
    databaseUrl: "configured-for-test",
    now,
    query: async () => 1
  });

  assert.deepEqual(result, {
    configured: true,
    connected: true,
    checkedAt
  });
});

test("returns a degraded connection result when the health query fails", async () => {
  const result = await checkDbHealth({
    databaseUrl: "configured-for-test",
    now,
    query: async () => {
      throw new Error("connection failed");
    }
  });

  assert.deepEqual(result, {
    configured: true,
    connected: false,
    checkedAt
  });
});
