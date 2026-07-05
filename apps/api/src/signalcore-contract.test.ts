import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SIGNALCORE_ALLOWED_AGENT_TOOLS,
  SIGNALCORE_ALLOWED_SIGNAL_TYPES,
  SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS,
  SIGNALCORE_MVP_PRODUCT_OPTIONS,
  assertNoForbiddenSignalFields,
  getSignalCoreContract
} from "./signalcore-contract.js";

test("contract includes DATA_READY", () => {
  assert.ok(SIGNALCORE_ALLOWED_SIGNAL_TYPES.includes("DATA_READY"));
});

test("contract includes STATE_PARTIAL", () => {
  assert.ok(SIGNALCORE_ALLOWED_SIGNAL_TYPES.includes("STATE_PARTIAL"));
});

test("contract includes ODDS_AVAILABLE", () => {
  assert.ok(SIGNALCORE_ALLOWED_SIGNAL_TYPES.includes("ODDS_AVAILABLE"));
});

test("forbidden output fields include required safety boundaries", () => {
  for (const field of [
    "probability",
    "confidence",
    "recommendation",
    "bet",
    "wager",
    "stake",
    "wallet"
  ]) {
    assert.ok(SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS.includes(
      field as typeof SIGNALCORE_FORBIDDEN_OUTPUT_FIELDS[number]
    ));
  }
});

test("allowed tools exclude direct infrastructure and secret access", () => {
  const tools = SIGNALCORE_ALLOWED_AGENT_TOOLS.map((tool) => tool.toLowerCase());
  for (const forbiddenTerm of ["db", "txline", "secret", "wallet", "solana", "env"]) {
    assert.equal(tools.some((tool) => tool.includes(forbiddenTerm)), false);
  }
});

test("assertNoForbiddenSignalFields accepts a safe object", () => {
  assert.doesNotThrow(() => assertNoForbiddenSignalFields({
    signal_type: "DATA_READY",
    severity: "info",
    details: { fixture_available: true }
  }));
});

test("assertNoForbiddenSignalFields rejects probability", () => {
  assert.throws(
    () => assertNoForbiddenSignalFields({ probability: 0.5 }),
    /Forbidden SignalCore output field: probability/
  );
});

test("assertNoForbiddenSignalFields rejects nested recommended_bet", () => {
  assert.throws(
    () => assertNoForbiddenSignalFields({ details: { recommended_bet: "home" } }),
    /Forbidden SignalCore output field: details\.recommended_bet/
  );
});

test("product options include the current MVP surfaces", () => {
  assert.ok(SIGNALCORE_MVP_PRODUCT_OPTIONS.includes("match_intelligence_card"));
  assert.ok(SIGNALCORE_MVP_PRODUCT_OPTIONS.includes("data_quality_dashboard"));
});

test("prohibited concepts are not exposed as allowed outputs", () => {
  const contract = getSignalCoreContract();
  const allowedOutputs = [
    ...contract.allowed_signal_types,
    ...contract.allowed_signal_severities,
    ...contract.product_options
  ].map((value) => value.toLowerCase());

  for (const prohibited of ["prediction", "winner", "betting_advice", "wager"]) {
    assert.equal(allowedOutputs.some((value) => value.includes(prohibited)), false);
  }
});

test("contract module has no database or TxLINE dependency", async () => {
  const source = await readFile(new URL("./signalcore-contract.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:db|txline)[^"']*["']/i);
});
