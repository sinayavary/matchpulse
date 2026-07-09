import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductAgentInternalRoutePayloadSafe,
  getProductAgentInternalRouteContract,
  normalizeProductAgentInternalRouteQuery,
  PRODUCT_AGENT_INTERNAL_ROUTE_PATH
} from "./product-agent-route-contract.js";

test("defines an authenticated internal-only Product Agent route contract", () => {
  const contract = getProductAgentInternalRouteContract();
  assert.equal(PRODUCT_AGENT_INTERNAL_ROUTE_PATH, "/api/internal/product-agent/matches/:fixtureId/insight");
  assert.equal(contract.auth_required, true);
  assert.equal(contract.public_exposure_allowed, false);
  assert.equal(contract.decision_context_exposure, "internal-only");
  assert.deepEqual(contract.allowed_query_params.sort(), [
    "includeEventImpact",
    "includeOddsReliability",
    "oddsLimit",
    "staleAfterMinutes"
  ]);
});

test("normalizes safe query defaults and booleans", () => {
  assert.deepEqual(normalizeProductAgentInternalRouteQuery({}), {
    includeEventImpact: true,
    includeOddsReliability: true,
    staleAfterMinutes: 180,
    oddsLimit: 20
  });
  assert.deepEqual(normalizeProductAgentInternalRouteQuery({
    includeEventImpact: "false",
    includeOddsReliability: "true"
  }), {
    includeEventImpact: false,
    includeOddsReliability: true,
    staleAfterMinutes: 180,
    oddsLimit: 20
  });
});

test("clamps numeric query parameters to the documented bounds", () => {
  assert.deepEqual(normalizeProductAgentInternalRouteQuery({
    staleAfterMinutes: 0,
    oddsLimit: 999
  }), {
    includeEventImpact: true,
    includeOddsReliability: true,
    staleAfterMinutes: 1,
    oddsLimit: 50
  });
  assert.deepEqual(normalizeProductAgentInternalRouteQuery({
    staleAfterMinutes: 20000,
    oddsLimit: -4
  }), {
    includeEventImpact: true,
    includeOddsReliability: true,
    staleAfterMinutes: 10080,
    oddsLimit: 1
  });
});

test("rejects unknown query parameters", () => {
  assert.throws(
    () => normalizeProductAgentInternalRouteQuery({ includeState: true }),
    /Unknown Product Agent route query parameter/
  );
});

test("accepts a safe internal response and negative disclaimer text", () => {
  assert.doesNotThrow(() => assertProductAgentInternalRoutePayloadSafe({
    data: {
      fixture_id: "fixture-1",
      decision_context: { attention_level: "low" },
      safe_scope_note: "This is not a prediction or betting recommendation."
    },
    meta: { status: "live", source: "product-agent", mode: "internal" }
  }));
});

for (const field of ["raw_payload", "internal_context", "prediction", "wallet", "token"]) {
  test(`rejects forbidden structured field: ${field}`, () => {
    assert.throws(
      () => assertProductAgentInternalRoutePayloadSafe({ data: { [field]: "blocked" } }),
      /Forbidden Product Agent route field/
    );
  });
}
