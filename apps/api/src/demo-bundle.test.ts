import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { AgentPresenterResponse } from "./agent-presenter-v0.js";
import {
  buildDemoBundle,
  normalizeDemoBundleOptions,
  sanitizeDemoSignals
} from "./demo-bundle.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";

function presenterOutput(input: {
  status?: "ready" | "partial" | "empty";
  fixture?: boolean;
  scoreboard?: boolean;
  odds?: boolean;
  signalTypes?: Array<"DATA_READY" | "STATE_PARTIAL" | "STATE_EMPTY" | "DATA_STALE" | "IDENTITY_INCOMPLETE">;
  state?: boolean;
} = {}): AgentPresenterResponse {
  const status = input.status ?? "ready";
  const hasFixture = input.fixture ?? status !== "empty";
  const hasScoreboard = input.scoreboard ?? status === "ready";
  const hasOdds = input.odds ?? status === "ready";
  const types = input.signalTypes ?? [
    status === "ready" ? "DATA_READY" : status === "partial" ? "STATE_PARTIAL" : "STATE_EMPTY"
  ];
  const signals = types.map((type) => ({
    type,
    severity: type === "STATE_EMPTY" ? "critical" as const : "info" as const,
    title: type,
    message: `${type} message`
  }));
  const output: AgentPresenterResponse = {
    data: {
      fixture_id: "fixture-1",
      agent_version: "presenter-v0",
      brief: {
        status_label: status,
        headline: "Safe headline",
        overview: "Availability overview",
        available_data: [],
        missing_data: [],
        freshness_note: "Freshness note",
        quality_notes: [],
        safe_scope_note: "Availability and quality only."
      },
      signal_summary: {
        status,
        signal_count: signals.length,
        critical_count: signals.filter((signal) => signal.severity === "critical").length,
        warning_count: 0,
        info_count: signals.filter((signal) => signal.severity === "info").length,
        has_fixture: hasFixture,
        has_scoreboard: hasScoreboard,
        has_odds: hasOdds,
        latest_data_timestamp: status === "empty" ? null : "2026-01-01T00:00:00.000Z"
      },
      signals
    },
    meta: {
      status: status === "ready" ? "live" : status === "partial" ? "degraded" : "no_data",
      source: "agent-presenter",
      mode: "internal"
    }
  };
  if (input.state !== false) {
    output.data.state = { fixture_id: "fixture-1" } as AgentPresenterResponse["data"]["state"];
  }
  return output;
}

test("ready, partial, and empty presenter outputs retain their readiness", () => {
  for (const status of ["ready", "partial", "empty"] as const) {
    const bundle = buildDemoBundle({ agentPresenterOutput: presenterOutput({ status }) });
    assert.equal(bundle.data.readiness.status, status);
    assert.equal(bundle.meta.status, status === "ready" ? "live" : status === "partial" ? "degraded" : "no_data");
  }
});

test("state inclusion follows includeState", () => {
  assert.notEqual(buildDemoBundle({ agentPresenterOutput: presenterOutput() }).data.state, null);
  assert.equal(buildDemoBundle({
    agentPresenterOutput: presenterOutput(),
    options: { includeState: false }
  }).data.state, null);
});

test("signal inclusion follows includeSignals", () => {
  const included = buildDemoBundle({ agentPresenterOutput: presenterOutput() });
  assert.notEqual(included.data.signal_summary, null);
  assert.equal(included.data.signals.length, 1);
  const omitted = buildDemoBundle({
    agentPresenterOutput: presenterOutput(),
    options: { includeSignals: false }
  });
  assert.equal(omitted.data.signal_summary, null);
  assert.deepEqual(omitted.data.signals, []);
  assert.ok(omitted.data.readiness.issues.includes("signals_missing"));
});

test("brief inclusion follows includeBrief", () => {
  assert.notEqual(buildDemoBundle({ agentPresenterOutput: presenterOutput() }).data.brief, null);
  const omitted = buildDemoBundle({
    agentPresenterOutput: presenterOutput(),
    options: { includeBrief: false }
  });
  assert.equal(omitted.data.brief, null);
  assert.ok(omitted.data.readiness.issues.includes("brief_missing"));
});

test("display readiness requires non-empty output, brief, and signals", () => {
  assert.equal(buildDemoBundle({ agentPresenterOutput: presenterOutput() }).data.readiness.display_ready, true);
  assert.equal(buildDemoBundle({ agentPresenterOutput: presenterOutput({ status: "partial" }) }).data.readiness.display_ready, true);
  assert.equal(buildDemoBundle({ agentPresenterOutput: presenterOutput({ status: "empty" }) }).data.readiness.display_ready, false);
  assert.equal(buildDemoBundle({
    agentPresenterOutput: presenterOutput(),
    options: { includeBrief: false }
  }).data.readiness.display_ready, false);
});

test("availability and quality issues are derived from approved fields", () => {
  const bundle = buildDemoBundle({
    agentPresenterOutput: presenterOutput({
      status: "partial",
      scoreboard: false,
      odds: false,
      signalTypes: ["STATE_PARTIAL", "DATA_STALE", "IDENTITY_INCOMPLETE"]
    })
  });
  assert.ok(bundle.data.readiness.issues.includes("scoreboard_missing"));
  assert.ok(bundle.data.readiness.issues.includes("odds_missing"));
  assert.ok(bundle.data.readiness.issues.includes("data_stale"));
  assert.ok(bundle.data.readiness.issues.includes("identity_incomplete"));
  assert.equal(bundle.data.readiness.issue_count, bundle.data.readiness.issues.length);
});

test("empty output reports missing persisted data", () => {
  const readiness = buildDemoBundle({
    agentPresenterOutput: presenterOutput({ status: "empty", state: false })
  }).data.readiness;
  assert.ok(readiness.issues.includes("fixture_missing"));
  assert.ok(readiness.issues.includes("state_missing"));
  assert.ok(readiness.issues.includes("no_persisted_data"));
});

test("signals are reduced to approved display fields", () => {
  const signal = {
    type: "DATA_READY" as const,
    severity: "info" as const,
    title: "Ready",
    message: "Ready message",
    extra: "removed"
  };
  assert.deepEqual(sanitizeDemoSignals([signal]), [{
    type: "DATA_READY",
    severity: "info",
    title: "Ready",
    message: "Ready message"
  }]);
});

test("numeric options use safe defaults and caps", () => {
  assert.deepEqual(normalizeDemoBundleOptions({ oddsLimit: 500, staleAfterMinutes: 50000 }), {
    includeState: true,
    includeSignals: true,
    includeBrief: true,
    oddsLimit: 50,
    staleAfterMinutes: 10080,
    format: "full"
  });
  assert.equal(normalizeDemoBundleOptions({ oddsLimit: -1 }).oddsLimit, 1);
  assert.equal(normalizeDemoBundleOptions({ staleAfterMinutes: -1 }).staleAfterMinutes, 1);
});

test("bundle passes forbidden-field validation and has no unsafe field names", () => {
  const bundle = buildDemoBundle({ agentPresenterOutput: presenterOutput() });
  assert.doesNotThrow(() => assertNoForbiddenSignalFields(bundle));
  const keys: string[] = [];
  const collectKeys = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key.toLowerCase());
      collectKeys(nested);
    }
  };
  collectKeys(bundle);
  for (const forbidden of [
    "probability", "confidence", "recommendation", "bet", "wager", "stake",
    "wallet", "prediction", "winner", "edge", "expected_value"
  ]) {
    assert.ok(!keys.includes(forbidden));
  }
  assert.ok(!keys.includes("reasoning"));
  assert.ok(!keys.includes("tools"));
});

test("pure bundle module has no TxLINE, ingestion runner, or database write dependency", async () => {
  const source = await readFile(new URL("./demo-bundle.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /txline|ingestion-runner|runFixtureIngestionPipeline/i);
  assert.doesNotMatch(source, /\.(create|update|upsert|delete|executeRaw)\s*\(/);
});
