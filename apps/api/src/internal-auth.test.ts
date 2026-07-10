import assert from "node:assert/strict";
import test from "node:test";
import {
  extractInternalTokenFromHeaders,
  getConfiguredInternalToken,
  verifyInternalRouteAuth
} from "./internal-auth.js";

const expectedToken = "internal-test-token";
const env = { MATCHPULSE_INTERNAL_TOKEN: expectedToken };

test("missing env token is not configured", () => {
  const result = verifyInternalRouteAuth({ headers: {}, env: {} });
  assert.deepEqual(result, { ok: false, configured: false, reason: "not_configured" });
});

test("empty env token is not configured", () => {
  assert.equal(getConfiguredInternalToken({ MATCHPULSE_INTERNAL_TOKEN: "   " }), null);
  assert.deepEqual(
    verifyInternalRouteAuth({ headers: {}, env: { MATCHPULSE_INTERNAL_TOKEN: "" } }),
    { ok: false, configured: false, reason: "not_configured" }
  );
});

test("correct custom header authorizes", () => {
  assert.deepEqual(
    verifyInternalRouteAuth({
      headers: { "x-matchpulse-internal-token": expectedToken },
      env
    }),
    { ok: true, configured: true, source: "x-matchpulse-internal-token" }
  );
});

test("correct bearer authorization authorizes", () => {
  assert.deepEqual(
    verifyInternalRouteAuth({
      headers: { authorization: `Bearer ${expectedToken}` },
      env
    }),
    { ok: true, configured: true, source: "authorization" }
  );
});

test("wrong token is rejected without secret material", () => {
  const provided = "wrong-token";
  const result = verifyInternalRouteAuth({
    headers: { authorization: `Bearer ${provided}` },
    env
  });
  assert.deepEqual(result, { ok: false, configured: true, reason: "invalid_token" });
  assert.equal(JSON.stringify(result).includes(expectedToken), false);
  assert.equal(JSON.stringify(result).includes(provided), false);
});

test("missing request token is rejected", () => {
  assert.deepEqual(verifyInternalRouteAuth({ headers: {}, env }), {
    ok: false,
    configured: true,
    reason: "missing_token"
  });
});

test("malformed authorization is rejected generically", () => {
  const result = verifyInternalRouteAuth({
    headers: { authorization: "Basic credentials" },
    env
  });
  assert.deepEqual(result, { ok: false, configured: true, reason: "malformed_authorization" });
  assert.equal(JSON.stringify(result).includes("credentials"), false);
});

test("single header array values are handled safely", () => {
  assert.deepEqual(
    verifyInternalRouteAuth({
      headers: { "x-matchpulse-internal-token": [expectedToken] },
      env
    }),
    { ok: true, configured: true, source: "x-matchpulse-internal-token" }
  );
  assert.deepEqual(
    verifyInternalRouteAuth({
      headers: { authorization: [`Bearer ${expectedToken}`] },
      env
    }),
    { ok: true, configured: true, source: "authorization" }
  );
  assert.deepEqual(
    verifyInternalRouteAuth({ headers: { authorization: ["Bearer a", "Bearer b"] }, env }),
    { ok: false, configured: true, reason: "malformed_authorization" }
  );
});

test("surrounding whitespace is normalized for configured and provided tokens", () => {
  assert.deepEqual(
    verifyInternalRouteAuth({
      headers: { authorization: `  Bearer   ${expectedToken}  ` },
      env: { MATCHPULSE_INTERNAL_TOKEN: `  ${expectedToken}  ` }
    }),
    { ok: true, configured: true, source: "authorization" }
  );
});

test("extraction never returns raw authorization when malformed", () => {
  const extracted = extractInternalTokenFromHeaders({ authorization: "not-a-bearer-token" });
  assert.deepEqual(extracted, {
    token: null,
    source: "authorization",
    malformed: true
  });
});

test("auth results never echo expected or provided tokens", () => {
  const provided = "wrong-provided-token";
  for (const result of [
    verifyInternalRouteAuth({ headers: {}, env }),
    verifyInternalRouteAuth({ headers: { authorization: `Bearer ${provided}` }, env }),
    verifyInternalRouteAuth({ headers: { authorization: "invalid" }, env })
  ]) {
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(expectedToken), false);
    assert.equal(serialized.includes(provided), false);
  }
});
