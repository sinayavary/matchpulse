import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import test from "node:test";
import {
  INTERNAL_ROUTE_PREFIX,
  isInternalRoutePath,
  registerInternalAuthBoundary
} from "./internal-auth-boundary.js";

const token = "boundary-test-token";

async function createTestApp() {
  const app = Fastify();
  let handlerCalls = 0;
  registerInternalAuthBoundary(app, { env: { MATCHPULSE_INTERNAL_TOKEN: token } });
  app.get("/api/internal/test", async () => {
    handlerCalls += 1;
    return { ok: true };
  });
  app.post("/api/internal/write", async () => {
    handlerCalls += 1;
    return { ok: true };
  });
  app.get("/api/public-test", async () => ({ ok: true }));
  return { app, getHandlerCalls: () => handlerCalls };
}

test("internal route classification is exact and query-safe", () => {
  assert.equal(INTERNAL_ROUTE_PREFIX, "/api/internal/");
  assert.equal(isInternalRoutePath("/api/internal"), true);
  assert.equal(isInternalRoutePath("/api/internal/test"), true);
  assert.equal(isInternalRoutePath("/api/internality/test"), false);
  assert.equal(isInternalRoutePath("/api/public-test"), false);
});

test("missing credential returns 401 before internal handler", async () => {
  const { app, getHandlerCalls } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/internal/test" });
  assert.equal(response.statusCode, 401);
  assert.equal(getHandlerCalls(), 0);
  assert.equal(response.body.includes(token), false);
  await app.close();
});

test("invalid and malformed credentials return 401 before POST handler", async () => {
  const { app, getHandlerCalls } = await createTestApp();
  for (const headers of [
    { authorization: "Bearer wrong" },
    { authorization: "Basic credentials" },
    { "x-matchpulse-internal-token": "wrong" }
  ]) {
    const response = await app.inject({ method: "POST", url: "/api/internal/write", headers });
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.includes(token), false);
    assert.equal(response.body.includes("wrong"), false);
  }
  assert.equal(getHandlerCalls(), 0);
  await app.close();
});

test("missing server configuration fails closed with 503", async () => {
  const app = Fastify();
  let handlerCalls = 0;
  registerInternalAuthBoundary(app, { env: {} });
  app.get("/api/internal/test", async () => {
    handlerCalls += 1;
    return { ok: true };
  });
  const response = await app.inject({ method: "GET", url: "/api/internal/test" });
  assert.equal(response.statusCode, 503);
  assert.equal(handlerCalls, 0);
  assert.equal(response.body.includes("MATCHPULSE_INTERNAL_TOKEN"), false);
  await app.close();
});

test("valid internal credential reaches the handler", async () => {
  const { app, getHandlerCalls } = await createTestApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/internal/test",
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(getHandlerCalls(), 1);
  await app.close();
});

test("public route remains accessible without internal credential", async () => {
  const { app } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/public-test" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  await app.close();
});

test("registered internal route inventory stays behind the central boundary", () => {
  const sourceFiles = [
    "server.ts",
    "server-agent-presenter-route.ts",
    "server-product-agent-route.ts",
    "server-signalcore-route.ts",
    "server-competition-prediction-route.ts",
    "txline-runtime-audit-routes.ts"
  ];
  const routes = sourceFiles.flatMap((file) => {
    const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");
    return [...source.matchAll(/app\.(?:get|post|put|patch|delete)\("([^"]+)/g)]
      .map((match) => match[1])
      .filter((path): path is string => path !== undefined && path.startsWith("/api/internal"));
  });
  assert.ok(routes.length >= 30);
  assert.equal(routes.every(isInternalRoutePath), true);

  const serverSource = readFileSync(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
  assert.ok(serverSource.indexOf("registerInternalAuthBoundary(app)") < serverSource.indexOf("app.get(\"/api/internal"));
});
