import assert from "node:assert/strict";
import test from "node:test";
import {
  mapAgentPresenterEventImpactToPublicSummary,
  PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE
} from "./public-event-impact-contract.js";
import type { AgentPresenterEventImpactHint } from "./agent-presenter-v0.js";

const APPROVED_KEYS = [
  "event_count_label",
  "label",
  "level",
  "pressure_label",
  "safe_scope_note",
  "source",
  "status"
];

const FORBIDDEN_KEYS = [
  "raw", "raw_payload", "debug", "debug_lineage", "formula", "signals", "state", "context",
  "internal_context", "insight", "probability", "prediction", "confidence", "winner",
  "recommended_bet", "bet", "expected_value", "EV", "edge", "wager", "stake", "profit",
  "payout", "wallet", "deposit"
];

function hint(overrides: Partial<AgentPresenterEventImpactHint> = {}): AgentPresenterEventImpactHint {
  return {
    status: "available",
    level: "high",
    label: "High stored-event impact",
    key_event_count: 2,
    pressure_level: "medium",
    source: "stored_events",
    ...overrides
  };
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
}

test("missing input returns unavailable summary", () => {
  assert.deepEqual(mapAgentPresenterEventImpactToPublicSummary(undefined), {
    status: "unavailable",
    level: "none",
    label: "No major match-event impact",
    event_count_label: "No key events",
    pressure_label: "No event pressure",
    source: "stored_events",
    safe_scope_note: PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE
  });
});

test("high impact maps to a public-safe summary", () => {
  assert.deepEqual(mapAgentPresenterEventImpactToPublicSummary(hint()), {
    status: "available",
    level: "high",
    label: "High match-event impact",
    event_count_label: "2 key events",
    pressure_label: "Moderate event pressure",
    source: "stored_events",
    safe_scope_note: PUBLIC_EVENT_IMPACT_SAFE_SCOPE_NOTE
  });
});

test("medium, low, and none levels map safely", () => {
  for (const level of ["medium", "low", "none"] as const) {
    const output = mapAgentPresenterEventImpactToPublicSummary(hint({ level, pressure_level: level }));
    assert.equal(output.status, "available");
    assert.equal(output.level, level);
    assert.equal(output.pressure_label, level === "medium"
      ? "Moderate event pressure"
      : level === "low"
        ? "Low event pressure"
        : "No event pressure");
  }
});

test("invalid level makes the summary unavailable and invalid pressure becomes none", () => {
  assert.equal(mapAgentPresenterEventImpactToPublicSummary({ ...hint(), level: "extreme" } as unknown as AgentPresenterEventImpactHint).status, "unavailable");
  assert.equal(mapAgentPresenterEventImpactToPublicSummary({ ...hint(), pressure_level: "extreme" } as unknown as AgentPresenterEventImpactHint).pressure_label, "No event pressure");
});

test("count is capped at 10+ key events", () => {
  assert.equal(mapAgentPresenterEventImpactToPublicSummary(hint({ key_event_count: 99 })).event_count_label, "10+ key events");
});

test("output has only approved public keys and no forbidden fields", () => {
  const output = mapAgentPresenterEventImpactToPublicSummary({
    ...hint(),
    raw: {}, raw_payload: {}, debug: {}, debug_lineage: [], formula: "x", signals: [], state: {}, context: {},
    internal_context: {}, insight: {}, probability: 0, prediction: "x", confidence: 1, winner: "x",
    recommended_bet: "x", bet: "x", expected_value: 0, EV: 0, edge: 0, wager: "x", stake: 0,
    profit: 0, payout: 0, wallet: "x", deposit: "x"
  } as unknown as AgentPresenterEventImpactHint);
  assert.deepEqual(Object.keys(output).sort(), APPROVED_KEYS);
  const keys = collectKeys(output).map((key) => key.toLowerCase());
  for (const forbidden of FORBIDDEN_KEYS) assert.equal(keys.includes(forbidden.toLowerCase()), false, forbidden);
});
