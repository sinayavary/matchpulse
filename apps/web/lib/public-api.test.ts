import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiBaseUrl } from "./public-api.js";

test("production browser requests stay same-origin through the BFF", () => {
  assert.equal(
    resolveApiBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000" }, true),
    "/api/bff"
  );
});

test("development browser requests retain the configured API origin", () => {
  assert.equal(
    resolveApiBaseUrl({ NODE_ENV: "development", NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4000" }, true),
    "http://127.0.0.1:4000"
  );
});
