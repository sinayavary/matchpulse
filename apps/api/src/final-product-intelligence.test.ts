import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFinalProductIntelligencePublicSafe,
  mapProductAgentToFinalProductIntelligence
} from "./final-product-intelligence.js";
import type { ProductAgentV1Response } from "./product-agent-v1.js";

function input(overrides: Record<string, unknown> = {}): ProductAgentV1Response {
  return {
    data: {
      agent_version: "product-agent-v1",
      fixture_id: "fixture-1",
      status: "ready",
      headline: "Match intelligence is ready for display.",
      summary: "Fixture, scoreboard, and odds data are available.",
      readiness: { display_ready: true, has_fixture: true, has_scoreboard: true, has_odds: true, is_stale: false },
      data_quality: { level: "complete", issues: [] },
      freshness: { latest_data_timestamp: "2026-07-10T10:00:00.000Z", freshness_label: "fresh", note: "Latest data is fresh." },
      signal_brief: { total: 3, critical: 1, warning: 1, info: 1, top_signals: [{ type: "DATA_READY", severity: "info", title: "internal", message: "internal" }] },
      decision_context: { attention_level: "medium", readiness_level: "ready", market_reliability_level: "limited", event_pressure_level: "high", operator_guidance: ["internal"], limitations: ["internal"] },
      user_facing_notes: ["  First note.  ", "", 42 as never, "x".repeat(250), "Second note."],
      safe_scope_note: "Internal scope note."
    },
    meta: { status: "live", source: "product-agent", mode: "internal" },
    ...overrides
  } as ProductAgentV1Response;
}

test("maps Product Agent output to the final public-safe contract", () => {
  const output = mapProductAgentToFinalProductIntelligence(input());
  assert.equal(output.product_version, "matchpulse-final-v1");
  assert.equal(output.fixture_id, "fixture-1");
  assert.equal(output.status, "live");
  assert.equal(output.readiness.level, "ready");
  assert.deepEqual(output.market_data, { status: "limited", label: "Market data is limited." });
  assert.deepEqual(output.match_activity, { level: "high", label: "Match activity pressure is high." });
  assert.deepEqual(output.signal_counts, { total: 3, critical: 1, warning: 1, info: 1 });
  assert.equal(output.public_notes.length, 3);
  assert.equal(output.public_notes[0], "First note.");
  assert.equal(output.public_notes[1].length, 240);
  assert.equal(output.safety_note.includes("predictions"), true);
});

test("exposes only the final public fields", () => {
  const output = mapProductAgentToFinalProductIntelligence(input());
  for (const field of ["product_version", "fixture_id", "status", "headline", "summary", "readiness", "data_quality", "freshness", "market_data", "match_activity", "signal_counts", "public_notes", "safety_note"]) assert.equal(field in output, true, field);
  for (const field of ["decision_context", "signal_brief", "top_signals", "signals", "state", "internal_context", "raw_payload", "debug_lineage"]) assert.equal(field in output, false, field);
});

test("maps stale and unavailable readiness safely", () => {
  const stale = mapProductAgentToFinalProductIntelligence(input({ meta: { status: "stale", source: "product-agent", mode: "internal" } }));
  assert.equal(stale.readiness.level, "stale");
  const unavailable = mapProductAgentToFinalProductIntelligence(input({ data: { ...input().data, readiness: { ...input().data.readiness, display_ready: false }, data_quality: { level: "empty", issues: [] } } }));
  assert.equal(unavailable.readiness.level, "unavailable");
});

for (const key of ["prediction", "probability", "recommended_bet", "wallet", "decision_context", "internal_context"]) {
  test(`rejects forbidden structured key ${key}`, () => {
    assert.throws(() => assertFinalProductIntelligencePublicSafe({ nested: { [key.toUpperCase()]: true } }), TypeError);
  });
}

test("allows forbidden words in disclaimer text", () => {
  assert.doesNotThrow(() => assertFinalProductIntelligencePublicSafe({ safety_note: "No prediction, probability, or betting recommendation is provided." }));
});
