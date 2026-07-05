import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDemoBridgeBundle,
  buildDemoBridgeNotFoundResponse,
  getDemoBridgeMatches,
  isAllowedDemoFixtureId,
  normalizeDemoBridgeOptions
} from "./demo-bridge.js";
import type { DemoBundleResponse } from "./demo-bundle.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";

test("returns exactly the allowlisted demo fixtures", () => {
  const output = getDemoBridgeMatches();
  assert.deepEqual(output.data.map(({ fixture_id }) => fixture_id), ["17952170", "17588223"]);
  assert.equal(output.meta.source, "demo-bridge");
  assert.equal(output.meta.mode, "public-demo");
});

test("recognizes only allowlisted fixture IDs", () => {
  assert.equal(isAllowedDemoFixtureId("17952170"), true);
  assert.equal(isAllowedDemoFixtureId("17588223"), true);
  assert.equal(isAllowedDemoFixtureId("not-real"), false);
});

test("builds a safe not-found response", () => {
  const output = buildDemoBridgeNotFoundResponse("not-real");
  assert.deepEqual(output, {
    data: null,
    meta: {
      status: "no_data",
      source: "demo-bridge",
      mode: "public-demo",
      message: "Demo fixture not found."
    }
  });
  assertNoForbiddenSignalFields(output);
});

test("normalizes defaults and caps numeric options", () => {
  assert.deepEqual(normalizeDemoBridgeOptions(), {
    includeState: true,
    includeSignals: true,
    includeBrief: true,
    oddsLimit: 20,
    staleAfterMinutes: 180,
    format: "full"
  });
  assert.equal(normalizeDemoBridgeOptions({ oddsLimit: 500 }).oddsLimit, 50);
  assert.equal(
    normalizeDemoBridgeOptions({ staleAfterMinutes: 50000 }).staleAfterMinutes,
    10080
  );
});

test("public bundle output is validated and contains no forbidden fields", () => {
  const internalBundle: DemoBundleResponse = {
    data: {
      fixture_id: "17952170",
      demo_version: "bundle-v0",
      readiness: {
        status: "ready",
        display_ready: true,
        has_state: false,
        has_brief: true,
        has_signals: true,
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issue_count: 2,
        issues: ["odds_missing", "data_stale"]
      },
      brief: null,
      signal_summary: null,
      signals: [],
      state: null
    },
    meta: { status: "live", source: "demo-bundle", mode: "internal" }
  };
  const output = buildDemoBridgeBundle(internalBundle);
  assertNoForbiddenSignalFields(output);
  const serialized = JSON.stringify(output).toLowerCase();
  for (const field of [
    "probability", "confidence", "recommendation", "bet", "wager", "stake",
    "wallet", "prediction", "winner", "edge", "expected_value"
  ]) {
    assert.equal(serialized.includes(`\"${field}\"`), false);
  }
  assert.equal(output.meta.source, "demo-bridge");
  assert.equal(output.meta.mode, "public-demo");
});

test("bridge source has no TxLINE, ingestion, or database-write dependencies", async () => {
  const source = await readFile(new URL("./demo-bridge.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /txline/i);
  assert.doesNotMatch(source, /ingestion-runner/i);
  assert.doesNotMatch(source, /\.(create|update|upsert|delete|executeRaw)\s*\(/);
});
