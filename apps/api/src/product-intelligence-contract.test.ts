import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES,
  PRODUCT_INTELLIGENCE_ALLOWED_SOURCES,
  PRODUCT_INTELLIGENCE_ALLOWED_SEVERITIES,
  PRODUCT_INTELLIGENCE_FORBIDDEN_OUTPUT_FIELDS,
  PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE,
  assertNoForbiddenProductIntelligenceFields,
  createProductIntelligenceSignal,
  getProductIntelligenceContract,
  type ProductIntelligenceSignal
} from "./product-intelligence-contract.js";
import {
  assertNoForbiddenSignalFields,
  getSignalCoreContract
} from "./signalcore-contract.js";

function collectObjectKeys(value: unknown, seen = new WeakSet<object>()): string[] {
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item, seen));
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue, seen)
  ]);
}

test("allowed categories are exactly the approved set", () => {
  assert.deepEqual(PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES, [
    "DATA_QUALITY",
    "RUNTIME_FRESHNESS",
    "MARKET_DATA_AVAILABILITY",
    "PRESSURE_CONTEXT",
    "VERIFICATION_STATUS",
    "PRODUCT_READINESS"
  ]);
});

test("product intelligence signal only exposes safe fields", () => {
  const signal: ProductIntelligenceSignal = createProductIntelligenceSignal({
    category: "DATA_QUALITY",
    severity: "warning",
    title: "Data quality issue",
    message: "A required field is missing from the latest runtime snapshot.",
    evidence_count: 2,
    source: "runtime",
    safe_scope_note: PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE
  });

  assert.deepEqual(Object.keys(signal).sort(), [
    "category",
    "evidence_count",
    "message",
    "safe_scope_note",
    "severity",
    "source",
    "title"
  ]);
  assert.doesNotThrow(() => assertNoForbiddenProductIntelligenceFields(signal));
});

test("forbidden field names are not present", () => {
  const contract = getProductIntelligenceContract();
  const scannedKeys = collectObjectKeys(contract).map((key) => key.toLowerCase());

  for (const forbidden of PRODUCT_INTELLIGENCE_FORBIDDEN_OUTPUT_FIELDS) {
    assert.equal(scannedKeys.includes(forbidden), false, `unexpected field key: ${forbidden}`);
  }
});

test("safe note contains no betting recommendation claim", () => {
  const note = PRODUCT_INTELLIGENCE_SAFE_SCOPE_NOTE.toLowerCase();

  for (const term of ["recommended bet", "best bet", "betting advice", "place a bet"]) {
    assert.equal(note.includes(term), false);
  }
});

test("existing SignalCore contract still passes", () => {
  const contract = getSignalCoreContract();

  assert.ok(contract.allowed_signal_types.includes("DATA_READY"));
  assert.ok(contract.allowed_signal_types.includes("PRESSURE_HINT_AVAILABLE"));
  assert.doesNotThrow(() =>
    assertNoForbiddenSignalFields({
      signal_type: "DATA_READY",
      severity: "info",
      details: { fixture_available: true }
    })
  );
});

test("product intelligence contract uses safe source and severity vocabularies", () => {
  assert.deepEqual(PRODUCT_INTELLIGENCE_ALLOWED_SEVERITIES, ["info", "warning", "critical"]);
  assert.deepEqual(PRODUCT_INTELLIGENCE_ALLOWED_SOURCES, [
    "database",
    "txline",
    "signalcore",
    "verification",
    "runtime"
  ]);
});
