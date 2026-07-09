import assert from "node:assert/strict";
import test from "node:test";
import type { PublicEventImpactSummary } from "./public-event-impact-contract.js";
import { mapPublicEventImpactToTelegramMessage } from "./telegram-event-impact-contract.js";

const FORBIDDEN_KEYS = [
  "event_impact_hint", "EVENT_IMPACT_ASSESSED", "signals", "state", "context", "internal_context",
  "insight", "raw", "raw_payload", "debug", "debug_lineage", "formula", "probability", "prediction",
  "confidence", "winner", "recommended_bet", "bet", "expected_value", "EV", "edge", "wager", "stake",
  "profit", "payout", "wallet", "deposit"
];

const SAFE_NOTE = "This summary describes stored match events only. It is not a prediction, probability, betting recommendation, or wagering instruction.";

function summary(level: PublicEventImpactSummary["level"] = "high"): PublicEventImpactSummary {
  return {
    status: "available",
    level,
    label: `${level} match-event impact`,
    event_count_label: "2 key events",
    pressure_label: "Moderate event pressure",
    source: "stored_events",
    safe_scope_note: SAFE_NOTE
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

test("unavailable summary is silent", () => {
  assert.deepEqual(mapPublicEventImpactToTelegramMessage({ ...summary(), status: "unavailable" }), {
    status: "silent",
    title: "Event impact unavailable",
    body: "Stored match-event impact is not available yet.",
    severity: "none",
    tags: ["event-impact", "unavailable"],
    safe_scope_note: SAFE_NOTE
  });
});

test("none and low are silent, medium and high are sendable", () => {
  assert.equal(mapPublicEventImpactToTelegramMessage(summary("none")).status, "silent");
  assert.equal(mapPublicEventImpactToTelegramMessage(summary("low")).status, "silent");
  assert.equal(mapPublicEventImpactToTelegramMessage(summary("medium")).status, "sendable");
  assert.equal(mapPublicEventImpactToTelegramMessage(summary("high")).status, "sendable");
});

test("available levels use compact safe titles and bodies", () => {
  assert.deepEqual(mapPublicEventImpactToTelegramMessage(summary("high")), {
    status: "sendable",
    title: "High match-event impact",
    body: "high match-event impact. 2 key events. Moderate event pressure.",
    severity: "high",
    tags: ["event-impact", "high"],
    safe_scope_note: SAFE_NOTE
  });
});

test("output has only approved keys and no forbidden fields", () => {
  const output = mapPublicEventImpactToTelegramMessage(summary());
  assert.deepEqual(Object.keys(output).sort(), ["body", "safe_scope_note", "severity", "status", "tags", "title"]);
  const keys = collectKeys(output).map((key) => key.toLowerCase());
  for (const forbidden of FORBIDDEN_KEYS) assert.equal(keys.includes(forbidden.toLowerCase()), false, forbidden);
});

test("text is plain, bounded, and neutralizes hostile formatting", () => {
  const output = mapPublicEventImpactToTelegramMessage({
    ...summary("medium"),
    label: "<b>Impact</b>\n\n[click](https://example.com) **bet** " + "x".repeat(500),
    event_count_label: "\n\n100 key events\n",
    pressure_label: "`pressure` | <script>alert(1)</script>"
  });

  assert.equal(output.status, "sendable");
  assert.equal(output.title.length <= 80, true);
  assert.equal(output.body.length <= 280, true);
  assert.equal(output.body.includes("\n"), false);
  assert.equal(output.body.includes("<"), false);
  assert.equal(output.body.includes(")"), false);
  assert.equal(output.body.toLowerCase().includes("bet"), false);
  assert.equal(output.safe_scope_note.includes("\n"), false);
});
