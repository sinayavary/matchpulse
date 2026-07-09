import test from "node:test";
import assert from "node:assert/strict";
import type { CanonicalMatchState } from "./match-state-builder.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  buildProductAgentV1,
  buildProductAgentV1Insight,
  buildProductAgentV1InsightSummary
} from "./product-agent-v1.js";
import type { SignalCoreV0Response, SignalCoreV0Signal } from "./signalcore-v0.js";

function buildState(overrides: Partial<CanonicalMatchState["quality"]> = {}): CanonicalMatchState {
  return {
    fixture_id: "17952170",
    identity: {
      fixture_id: "17952170",
      competition: "International Friendly",
      home_team: "Slovenia",
      away_team: "Cyprus",
      start_time_utc: "2026-07-05T12:00:00.000Z",
      status: "LIVE"
    },
    scoreboard: {
      available: true,
      home_score: 1,
      away_score: 1,
      phase: "2H",
      last_data_received_at: "2026-07-05T12:15:00.000Z"
    },
    odds: {
      available: true,
      count: 1,
      markets: [
        {
          market_id: "1x2",
          market_name: "Match Result",
          selection_name: "Home",
          odds: 2.1,
          direction: "stable",
          source_timestamp: "2026-07-05T12:14:00.000Z"
        }
      ]
    },
    freshness: {
      built_at: "2026-07-05T12:16:00.000Z",
      latest_score_timestamp: "2026-07-05T12:15:00.000Z",
      latest_odds_timestamp: "2026-07-05T12:14:00.000Z",
      latest_data_timestamp: "2026-07-05T12:15:00.000Z"
    },
    quality: {
      status: "complete",
      has_fixture: true,
      has_scoreboard: true,
      has_odds: true,
      issues: [],
      ...overrides
    }
  };
}

function createSignal(
  type: SignalCoreV0Signal["type"],
  severity: SignalCoreV0Signal["severity"],
  title: string,
  message: string
): SignalCoreV0Signal {
  return {
    type,
    severity,
    title,
    message,
    details: {}
  };
}

function buildSignalCoreOutput(input: {
  fixtureId?: string;
  status: SignalCoreV0Response["data"]["summary"]["status"];
  hasFixture: boolean;
  hasScoreboard: boolean;
  hasOdds: boolean;
  latestDataTimestamp?: string | null;
  signals?: SignalCoreV0Signal[];
  state?: CanonicalMatchState;
}): SignalCoreV0Response {
  const state = input.state ?? buildState({
    status: input.status === "ready" ? "complete" : input.status,
    has_fixture: input.hasFixture,
    has_scoreboard: input.hasScoreboard,
    has_odds: input.hasOdds
  });
  state.freshness.latest_data_timestamp = input.latestDataTimestamp ?? null;
  state.quality.issues = [
    ...(input.hasFixture ? [] : ["fixture_missing"]),
    ...(input.hasScoreboard ? [] : ["scoreboard_missing"]),
    ...(input.hasOdds ? [] : ["odds_missing"]),
    ...(input.status === "empty" ? ["no_persisted_data"] : [])
  ];

  const signals = input.signals ?? [];

  return {
    data: {
      fixture_id: input.fixtureId ?? "17952170",
      summary: {
        status: input.status,
        signal_count: signals.length,
        critical_count: signals.filter((signal) => signal.severity === "critical").length,
        warning_count: signals.filter((signal) => signal.severity === "warning").length,
        info_count: signals.filter((signal) => signal.severity === "info").length,
        has_fixture: input.hasFixture,
        has_scoreboard: input.hasScoreboard,
        has_odds: input.hasOdds,
        latest_data_timestamp: input.latestDataTimestamp ?? null
      },
      signals,
      state
    },
    meta: {
      status: input.status === "ready" ? "live" : input.status === "partial" ? "degraded" : "no_data",
      source: "signalcore",
      mode: "internal"
    }
  };
}

function collectKeys(value: unknown): string[] {
  const keys: string[] = [];
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object") return;
    for (const [key, nested] of Object.entries(current)) {
      keys.push(key.toLowerCase());
      visit(nested);
    }
  };
  visit(value);
  return keys;
}

test("complete ready state produces a display-ready product insight", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: [
        createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
        createSignal("DATA_FRESH", "info", "Data fresh", "The latest data timestamp is within the freshness window.")
      ]
    })
  );

  assert.equal(response.data.status, "ready");
  assert.equal(response.data.readiness.display_ready, true);
  assert.equal(response.data.data_quality.level, "complete");
  assert.equal(response.data.freshness.freshness_label, "fresh");
  assert.equal(response.data.decision_context.readiness_level, "ready");
  assert.equal(response.data.decision_context.attention_level, "low");
});

test("partial state captures missing odds while preserving safe notes", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "partial",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: false,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: [
        createSignal("STATE_PARTIAL", "warning", "State partial", "Canonical match state is available but incomplete."),
        createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing."),
        createSignal("DATA_FRESH", "info", "Data fresh", "The latest data timestamp is within the freshness window.")
      ]
    })
  );

  assert.equal(response.data.status, "partial");
  assert.equal(response.data.data_quality.level, "partial");
  assert.equal(response.data.data_quality.issues.includes("odds_missing"), true);
  assert.equal(response.data.user_facing_notes.includes("Odds data is missing."), true);
  assert.equal(response.data.decision_context.readiness_level, "limited");
  assert.equal(response.data.decision_context.market_reliability_level, "unavailable");
});

test("odds missing prefers product-facing partial data quality even when summary is ready", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: false,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: [
        createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
        createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing.")
      ],
      state: buildState({
        status: "complete",
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issues: ["odds_missing"]
      })
    })
  );

  assert.equal(response.data.data_quality.level, "partial");
  assert.equal(response.data.data_quality.issues.includes("odds_missing"), true);
});

test("empty state reports no persisted data", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "empty",
      hasFixture: false,
      hasScoreboard: false,
      hasOdds: false,
      latestDataTimestamp: null,
      signals: [
        createSignal("STATE_EMPTY", "critical", "State empty", "No canonical match data is currently available."),
        createSignal("DATA_STALE", "warning", "Data stale", "No data timestamp is available for freshness checks.")
      ]
    })
  );

  assert.equal(response.data.status, "empty");
  assert.equal(response.data.readiness.display_ready, false);
  assert.equal(response.data.data_quality.level, "empty");
  assert.equal(response.data.data_quality.issues.includes("no_persisted_data"), true);
  assert.equal(response.data.decision_context.readiness_level, "not_ready");
  assert.equal(response.data.decision_context.attention_level, "high");
});

test("stale state upgrades status and freshness label", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T08:00:00.000Z",
      signals: [
        createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
        createSignal("DATA_STALE", "warning", "Data stale", "The latest data timestamp is older than the freshness window.")
      ]
    })
  );

  assert.equal(response.data.status, "stale");
  assert.equal(response.data.readiness.is_stale, true);
  assert.equal(response.data.freshness.freshness_label, "stale");
  assert.equal(response.meta.status, "stale");
  assert.equal(response.data.decision_context.attention_level, "high");
  assert.equal(response.data.decision_context.limitations.includes("Stale data."), true);
});

test("stale plus missing odds does not produce complete data quality", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: false,
      latestDataTimestamp: "2026-07-05T08:00:00.000Z",
      signals: [
        createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
        createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing."),
        createSignal("DATA_STALE", "warning", "Data stale", "The latest data timestamp is older than the freshness window.")
      ],
      state: buildState({
        status: "complete",
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issues: ["odds_missing"]
      })
    })
  );

  assert.equal(response.data.status, "stale");
  assert.equal(response.data.data_quality.level, "partial");
  assert.notEqual(response.data.data_quality.level, "complete");
});

test("signal brief includes counts and top signals", () => {
  const insight = buildProductAgentV1Insight({
    fixture_id: "17952170",
    summary: {
      status: "partial",
      signal_count: 3,
      critical_count: 1,
      warning_count: 1,
      info_count: 1,
      has_fixture: true,
      has_scoreboard: true,
      has_odds: false,
      latest_data_timestamp: "2026-07-05T12:15:00.000Z"
    },
    signals: [
      createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
      createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing."),
      createSignal("STATE_EMPTY", "critical", "State empty", "No canonical match data is currently available.")
    ],
    state: buildState({
      status: "partial",
      has_odds: false
    })
  });

  assert.equal(insight.signal_brief.total, 3);
  assert.equal(insight.signal_brief.critical, 1);
  assert.equal(insight.signal_brief.top_signals[0].severity, "critical");
  assert.deepEqual(Object.keys(insight.signal_brief.top_signals[0]).sort(), [
    "message",
    "severity",
    "title",
    "type"
  ]);
});

test("insight summary stays compact while preserving status quality and top signal types", () => {
  const insight = buildProductAgentV1Insight({
    fixture_id: "17952170",
    summary: {
      status: "ready",
      signal_count: 3,
      critical_count: 0,
      warning_count: 3,
      info_count: 0,
      has_fixture: true,
      has_scoreboard: true,
      has_odds: false,
      latest_data_timestamp: "2026-07-05T08:00:00.000Z"
    },
    signals: [
      createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing."),
      createSignal("DATA_STALE", "warning", "Data stale", "The latest data timestamp is older than the freshness window."),
      createSignal("IDENTITY_INCOMPLETE", "warning", "Identity incomplete", "Fixture identity is missing one or more required fields.")
    ],
    state: buildState({
      status: "complete",
      has_fixture: true,
      has_scoreboard: true,
      has_odds: false,
      issues: ["odds_missing"]
    })
  });

  const summary = buildProductAgentV1InsightSummary(insight);

  assert.deepEqual(summary, {
    agent_version: "product-agent-v1",
    status: "stale",
    quality: "partial",
    freshness: "stale",
    issue_count: 3,
    issues: ["odds_missing", "identity_incomplete", "data_stale"],
    top_signal_types: ["DATA_STALE", "IDENTITY_INCOMPLETE", "ODDS_MISSING"],
    display_ready: true
  });
});

test("event impact context raises safe attention without exposing event details", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: [
        {
          ...createSignal("EVENT_IMPACT_ASSESSED", "warning", "Event impact assessed", "Stored events were assessed."),
          details: { impact_level: "high" }
        }
      ]
    })
  );

  assert.equal(response.data.decision_context.event_pressure_level, "high");
  assert.equal(response.data.decision_context.attention_level, "high");
  assert.equal(response.data.decision_context.limitations.includes("Event impact is based on stored events only."), true);
  assert.equal(response.data.decision_context.operator_guidance.includes(
    "Highlight the stored-event impact notice with its data limitation."
  ), true);
});

test("medium event impact and limited reliability use optional precomputed safe inputs", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: []
    }),
    { event_impact_level: "medium", odds_reliability_status: "limited" }
  );

  assert.equal(response.data.decision_context.event_pressure_level, "medium");
  assert.equal(response.data.decision_context.market_reliability_level, "limited");
  assert.equal(response.data.decision_context.attention_level, "medium");
  assert.equal(response.data.decision_context.operator_guidance.includes("Show the odds coverage limitation."), true);
});

test("no event impact stays at none with bounded operator guidance", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: []
    })
  );

  assert.equal(response.data.decision_context.event_pressure_level, "none");
  assert.equal(response.data.decision_context.operator_guidance[0], "Use the standard match intelligence card.");
});

test("safe scope note explicitly excludes predictions probabilities recommendations and betting guidance", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: []
    })
  );

  assert.equal(
    response.data.safe_scope_note,
    "This insight covers data availability, freshness, data quality, and approved signal activity only. It does not provide predictions, probabilities, recommendations, or betting guidance."
  );
});

test("forbidden words and keys are absent from Product Agent v1 output", () => {
  const response = buildProductAgentV1(
    buildSignalCoreOutput({
      status: "partial",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: false,
      latestDataTimestamp: "2026-07-05T12:15:00.000Z",
      signals: [
        createSignal("ODDS_MISSING", "warning", "Odds missing", "Odds data is missing.")
      ]
    })
  );

  const serialized = JSON.stringify(response).toLowerCase();
  const keys = collectKeys(response);
  for (const field of [
    "prediction",
    "probability",
    "confidence",
    "formula",
    "raw",
    "raw_payload",
    "debug",
    "debug_lineage",
    "recommendation",
    "recommended_bet",
    "bet",
    "wager",
    "stake",
    "expected_value",
    "ev",
    "edge",
    "winner",
    "deposit",
    "payout",
    "wallet"
  ]) {
    assert.equal(keys.includes(field), false);
    assert.equal(serialized.includes(`\"${field}\"`), false);
  }
  assert.doesNotThrow(() => assertNoForbiddenSignalFields(response));
});
