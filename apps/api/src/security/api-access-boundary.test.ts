import test from "node:test";
import assert from "node:assert/strict";
import { scopeForRoute } from "./free-access-contract.js";
import { authorizeExternal } from "./api-access-boundary.js";

test("external scope mapping is centralized and default deny", () => {
  assert.equal(scopeForRoute("GET", "/api/matches"), "matches:read");
  assert.equal(scopeForRoute("POST", "/api/matches"), undefined);
  assert.equal(scopeForRoute("GET", "/api/internal/foo"), undefined);
  assert.equal(scopeForRoute("GET", "/api/unknown"), undefined);
});

test("bearer authentication and quota are awaited", async () => {
  let authenticated = false;
  let consumed = false;
  const reply = { code: () => reply, send: () => reply, header: () => reply } as any;
  const request = { url: "/api/matches", method: "GET", ip: "test-await", headers: { authorization: "Bearer deferred-token" }, raw: { once: () => undefined } } as any;
  const auth = { authenticate: async () => { await Promise.resolve(); authenticated = true; return { applicationId: "app-await", scopes: ["matches:read"], hash: "h", expiresAt: Date.now() + 1000 }; }, createCredential: async () => undefined, issueToken: async () => undefined, revokeCredential: async () => undefined, revokeApplication: async () => undefined, revokeToken: async () => undefined };
  const ok = await authorizeExternal(request, reply, undefined, auth, { consume: async () => { consumed = true; return true; } });
  assert.equal(ok, true);
  assert.equal(authenticated, true);
  assert.equal(consumed, true);
});

test("quota rejection returns 429 with Retry-After", async () => {
  const reply = { status: 0, headers: new Map<string, string>(), code(n: number) { this.status = n; return this; }, header(k: string, v: string) { this.headers.set(k, v); return this; }, send() { return this; } } as any;
  const request = { url: "/api/matches", method: "GET", ip: "test-quota", headers: { authorization: "Bearer quota-token" }, raw: { once: () => undefined } } as any;
  const auth = { authenticate: async () => ({ applicationId: "app-quota", scopes: ["matches:read"], hash: "h", expiresAt: Date.now() + 1000 }), createCredential: async () => undefined, issueToken: async () => undefined, revokeCredential: async () => undefined, revokeApplication: async () => undefined, revokeToken: async () => undefined };
  assert.equal(await authorizeExternal(request, reply, undefined, auth, { consume: async () => false }), false);
  assert.equal(reply.status, 429);
  assert.equal(reply.headers.get("retry-after"), "86400");
});
