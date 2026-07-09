import test from "node:test";
import assert from "node:assert/strict";
import type { CanonicalMatchState } from "./match-state-builder.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  buildAgentPresenterBrief,
  buildAvailableDataList,
  buildOddsReliabilityHintFromSignals,
  buildPressureHintFromSignals,
  buildFreshnessNote,
  buildMissingDataList,
  ODDS_RELIABILITY_HINT_SAFE_SCOPE_NOTE,
  PRESSURE_HINT_SAFE_SCOPE_NOTE,
  normalizeAgentPresenterOptions,
  sanitizeSignalsForBrief,
  type AgentPresenterPressureHint
} from "./agent-presenter-v0.js";
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
  message: string,
  details: Record<string, unknown> = { ignored: true }
): SignalCoreV0Signal {
  return {
    type,
    severity,
    title,
    message,
    details
  };
}

function createPressureSignal(details: Record<string, unknown>, severity: SignalCoreV0Signal["severity"] = "info"): SignalCoreV0Signal {
  return createSignal("PRESSURE_HINT_AVAILABLE", severity, "Pressure hint available", "Rule-based pressure hint is available from stored score data.", details);
}

function createOddsReliabilitySignal(
  details: Record<string, unknown>,
  severity: SignalCoreV0Signal["severity"] = "info"
): SignalCoreV0Signal {
  return createSignal(
    "ODDS_RELIABILITY_ASSESSED",
    severity,
    "Odds reliability assessed",
    "Stored odds reliability has been assessed from database-backed snapshots.",
    details
  );
}

const FORBIDDEN_PRESENTER_PROPERTY_KEYS = [
  "pressure_score",
  "adapter_status",
  "debug_lineage",
  "raw_payload",
  "primary_side",
  "formula",
  "probability",
  "confidence",
  "prediction",
  "recommendation",
  "recommended_bet",
  "bet",
  "wager",
  "stake",
  "expected_value",
  "edge",
  "winner",
  "profit",
  "payout",
  "wallet",
  "deposit"
];

const ALLOWED_PRESSURE_HINT_KEYS = [
  "evidence_count",
  "label",
  "level",
  "limitations",
  "safe_scope_note",
  "source"
];

function collectPropertyKeys(value: unknown): string[] {
  const keys: string[] = [];
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object") return;
    for (const [key, nested] of Object.entries(current)) {
      keys.push(key);
      visit(nested);
    }
  };
  visit(value);
  return keys;
}

function buildSignalCoreOutput(input: {
  fixtureId?: string;
  status: SignalCoreV0Response["data"]["summary"]["status"];
  hasFixture: boolean;
  hasScoreboard: boolean;
  hasOdds: boolean;
  latestDataTimestamp?: string | null;
  includeState?: boolean;
  signals?: SignalCoreV0Signal[];
}): SignalCoreV0Response {
  const state = buildState({
    status: input.status === "ready" ? "complete" : input.status,
    has_fixture: input.hasFixture,
    has_scoreboard: input.hasScoreboard,
    has_odds: input.hasOdds,
    issues: []
  });
  state.freshness.latest_data_timestamp = input.latestDataTimestamp ?? null;

  const signals = input.signals ?? [];
  const data: SignalCoreV0Response["data"] = {
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
    signals
  };

  if (input.includeState) {
    data.state = state;
  }

  return {
    data,
    meta: {
      status: input.status === "ready" ? "live" : input.status === "partial" ? "degraded" : "no_data",
      source: "signalcore",
      mode: "internal"
    }
  };
}

test("ready SignalCore output generates ready brief", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available.")]
    })
  );

  assert.equal(response.data.brief.status_label, "ready");
  assert.equal(response.data.brief.headline, "Match data is ready for safe display.");
});

test("partial SignalCore output generates partial brief", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "partial",
      hasFixture: true,
      hasScoreboard: false,
      hasOdds: true,
      signals: [createSignal("STATE_PARTIAL", "warning", "State partial", "State is incomplete.")]
    })
  );

  assert.equal(response.data.brief.status_label, "partial");
  assert.equal(response.data.brief.headline, "Match data is partially available.");
});

test("empty SignalCore output generates empty brief", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "empty",
      hasFixture: false,
      hasScoreboard: false,
      hasOdds: false,
      signals: [createSignal("STATE_EMPTY", "critical", "State empty", "No data is available.")]
    })
  );

  assert.equal(response.data.brief.status_label, "empty");
  assert.equal(response.data.brief.overview, "The system does not have enough persisted data to build a brief.");
});

test("available_data includes fixture when has_fixture=true", () => {
  assert.deepEqual(
    buildAvailableDataList({
      status: "ready",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: true,
      has_scoreboard: false,
      has_odds: false,
      latest_data_timestamp: null
    }),
    ["Fixture identity is available."]
  );
});

test("available_data includes scoreboard when has_scoreboard=true", () => {
  assert.ok(
    buildAvailableDataList({
      status: "ready",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: false,
      has_scoreboard: true,
      has_odds: false,
      latest_data_timestamp: null
    }).includes("Scoreboard data is available.")
  );
});

test("available_data includes odds when has_odds=true", () => {
  assert.ok(
    buildAvailableDataList({
      status: "ready",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: false,
      has_scoreboard: false,
      has_odds: true,
      latest_data_timestamp: null
    }).includes("Odds data is available.")
  );
});

test("missing_data includes fixture when has_fixture=false", () => {
  assert.ok(
    buildMissingDataList({
      status: "empty",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: false,
      has_scoreboard: true,
      has_odds: true,
      latest_data_timestamp: null
    }).includes("Fixture identity is missing.")
  );
});

test("missing_data includes scoreboard when has_scoreboard=false", () => {
  assert.ok(
    buildMissingDataList({
      status: "partial",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: true,
      has_scoreboard: false,
      has_odds: true,
      latest_data_timestamp: null
    }).includes("Scoreboard data is missing.")
  );
});

test("missing_data includes odds when has_odds=false", () => {
  assert.ok(
    buildMissingDataList({
      status: "partial",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: true,
      has_scoreboard: true,
      has_odds: false,
      latest_data_timestamp: null
    }).includes("Odds data is missing.")
  );
});

test("stale signal generates stale freshness note", () => {
  assert.equal(
    buildFreshnessNote(
      [createSignal("DATA_STALE", "warning", "Data stale", "Data is stale.")],
      {
        status: "partial",
        signal_count: 1,
        critical_count: 0,
        warning_count: 1,
        info_count: 0,
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        latest_data_timestamp: "2026-07-05T10:00:00.000Z"
      }
    ),
    "Latest persisted data is older than the freshness window."
  );
});

test("fresh signal generates fresh freshness note", () => {
  assert.equal(
    buildFreshnessNote(
      [createSignal("DATA_FRESH", "info", "Data fresh", "Data is fresh.")],
      {
        status: "ready",
        signal_count: 1,
        critical_count: 0,
        warning_count: 0,
        info_count: 1,
        has_fixture: true,
        has_scoreboard: true,
        has_odds: true,
        latest_data_timestamp: "2026-07-05T12:15:00.000Z"
      }
    ),
    "Latest persisted data is within the freshness window."
  );
});

test("no timestamp generates no timestamp note", () => {
  assert.equal(
    buildFreshnessNote([], {
      status: "empty",
      signal_count: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      has_fixture: false,
      has_scoreboard: false,
      has_odds: false,
      latest_data_timestamp: null
    }),
    "No latest data timestamp is available."
  );
});

test("signal list is sanitized to type severity title message only", () => {
  const sanitized = sanitizeSignalsForBrief([
    createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available.")
  ]);

  assert.deepEqual(sanitized, [
    {
      type: "DATA_READY",
      severity: "info",
      title: "Data ready",
      message: "Fixture and live data are available."
    }
  ]);
});

test("no pressure signal returns undefined", () => {
  const signals = [
    createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
    createSignal("ODDS_AVAILABLE", "info", "Odds available", "Odds data is available.")
  ];

  assert.equal(buildPressureHintFromSignals(signals), undefined);
});

test("no odds reliability signal returns undefined", () => {
  const signals = [
    createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available."),
    createSignal("ODDS_AVAILABLE", "info", "Odds available", "Odds data is available.")
  ];

  assert.equal(buildOddsReliabilityHintFromSignals(signals), undefined);
});

test("maps odds reliability safely", () => {
  const hint = buildOddsReliabilityHintFromSignals([
    createOddsReliabilitySignal({
      status: "limited",
      source: "database",
      snapshot_count: 4,
      market_count: 3,
      provider_count: 1,
      latest_timestamp: "2026-07-05T11:45:00.000Z",
      limitation_count: 2,
      raw_payload: { internal: true }
    })
  ]);

  assert.deepEqual(hint, {
    label: "odds_data_limited",
    status: "limited",
    source: "database",
    snapshot_count: 4,
    market_count: 3,
    provider_count: 1,
    latest_timestamp: "2026-07-05T11:45:00.000Z",
    limitation_count: 2,
    safe_scope_note: ODDS_RELIABILITY_HINT_SAFE_SCOPE_NOTE
  });
  assert.equal("raw_payload" in (hint ?? {}), false);
});

test("invalid odds reliability details are omitted", () => {
  assert.equal(
    buildOddsReliabilityHintFromSignals([
      createOddsReliabilitySignal({
        status: "available",
        source: "database",
        snapshot_count: Number.NaN,
        market_count: 3,
        provider_count: 1,
        latest_timestamp: null,
        limitation_count: 0
      })
    ]),
    undefined
  );
  assert.equal(
    buildOddsReliabilityHintFromSignals([
      createSignal(
        "ODDS_RELIABILITY_ASSESSED",
        "warning",
        "Odds reliability assessed",
        "Stored odds reliability has been assessed from database-backed snapshots.",
        null as unknown as Record<string, unknown>
      )
    ]),
    undefined
  );
});

test("maps low pressure safely", () => {
  const hint = buildPressureHintFromSignals([
    createPressureSignal({
      pressure_level: "low",
      source: "stored_scores_snapshot",
      evidence_count: 2,
      limitations: [],
      adapter_status: "available",
      pressure_score: 4,
      debug_lineage: [{ internal: true }]
    })
  ]) as AgentPresenterPressureHint | undefined;

  assert.deepEqual(hint, {
    label: "Low pressure hint",
    level: "low",
    source: "stored_scores_snapshot",
    evidence_count: 2,
    limitations: [],
    safe_scope_note: PRESSURE_HINT_SAFE_SCOPE_NOTE
  });
  assert.equal("pressure_score" in (hint ?? {}), false);
  assert.equal("debug_lineage" in (hint ?? {}), false);
  assert.equal("adapter_status" in (hint ?? {}), false);
});

test("warning maps to limited label", () => {
  const hint = buildPressureHintFromSignals([
    createPressureSignal({
      pressure_level: "high",
      source: "stored_scores_snapshot",
      evidence_count: 3,
      limitations: [],
      adapter_status: "available"
    }, "warning")
  ]);

  assert.deepEqual(hint, {
    label: "Limited pressure hint",
    level: "high",
    source: "stored_scores_snapshot",
    evidence_count: 3,
    limitations: [],
    safe_scope_note: PRESSURE_HINT_SAFE_SCOPE_NOTE
  });
});

test("invalid source returns undefined", () => {
  assert.equal(
    buildPressureHintFromSignals([
      createPressureSignal({
        pressure_level: "low",
        source: "other_source",
        evidence_count: 1,
        limitations: [],
        adapter_status: "available"
      })
    ]),
    undefined
  );
});

test("invalid details are sanitized", () => {
  const hint = buildPressureHintFromSignals([
    createPressureSignal({
      pressure_level: "unexpected",
      source: "stored_scores_snapshot",
      evidence_count: Number.NaN,
      limitations: ["limited"],
      adapter_status: "available"
    })
  ]);

  assert.deepEqual(hint, {
    label: "Limited pressure hint",
    level: "none",
    source: "stored_scores_snapshot",
    evidence_count: 0,
    limitations: ["limited"],
    safe_scope_note: PRESSURE_HINT_SAFE_SCOPE_NOTE
  });
});

test("output passes forbidden key scan", () => {
  const output = buildPressureHintFromSignals([
    createPressureSignal({
      pressure_level: "medium",
      source: "stored_scores_snapshot",
      evidence_count: 2,
      limitations: [],
      adapter_status: "available"
    })
  ]);

  const propertyKeys = new Set(collectPropertyKeys(output));
  for (const field of FORBIDDEN_PRESENTER_PROPERTY_KEYS) {
    assert.equal(propertyKeys.has(field), false);
  }
});

test("includeState=false omits state", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      includeState: true,
      signals: []
    }),
    { includeState: false }
  );

  assert.equal("state" in response.data, false);
});

test("includeState=true includes state", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      includeState: true,
      signals: []
    }),
    { includeState: true }
  );

  assert.ok(response.data.state);
});

test("format defaults to compact", () => {
  assert.equal(normalizeAgentPresenterOptions().format, "compact");
});

test("includePressure defaults to false", () => {
  assert.equal(normalizeAgentPresenterOptions({}).includePressure, false);
});

test("includeOddsReliability defaults to false", () => {
  assert.equal(normalizeAgentPresenterOptions({}).includeOddsReliability, false);
});

test("pressure options clamp safely", () => {
  const options = normalizeAgentPresenterOptions({
    includePressure: true,
    pressureWindowSize: 999,
    pressureMaxEvidence: 999,
    pressureMaxPayloadAgeMinutes: 999999
  });

  assert.equal(options.includePressure, true);
  assert.equal(options.pressureWindowSize, 50);
  assert.equal(options.pressureMaxEvidence, 20);
  assert.equal(options.pressureMaxPayloadAgeMinutes, 10080);
});

test("oddsLimit caps at 50", () => {
  assert.equal(normalizeAgentPresenterOptions({ oddsLimit: 999 }).oddsLimit, 50);
});

test("staleAfterMinutes caps safely", () => {
  assert.equal(normalizeAgentPresenterOptions({ staleAfterMinutes: 999999 }).staleAfterMinutes, 10080);
});

test("output passes assertNoForbiddenSignalFields", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: []
    })
  );

  assert.doesNotThrow(() => assertNoForbiddenSignalFields(response));
});

test("output with pressure_hint passes assertNoForbiddenSignalFields", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createPressureSignal({
          pressure_level: "medium",
          source: "stored_scores_snapshot",
          evidence_count: 4,
          limitations: [],
          adapter_status: "available",
          pressure_score: 7,
          debug_lineage: [{ internal: true }]
        })
      ]
    }),
    { includePressure: true }
  );

  assert.doesNotThrow(() => assertNoForbiddenSignalFields(response));
});

test("output does not contain forbidden fields", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "partial",
      hasFixture: true,
      hasScoreboard: false,
      hasOdds: true,
      signals: []
    })
  );

  const serialized = JSON.stringify(response).toLowerCase();
  for (const field of [
    "probability",
    "confidence",
    "recommendation",
    "bet",
    "wager",
    "stake",
    "wallet",
    "prediction",
    "winner",
    "edge",
    "expected_value"
  ]) {
    assert.equal(serialized.includes(`"${field}"`), false);
  }
});

test("presenter does not add autonomous reasoning fields", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: []
    })
  );

  assert.equal("analysis" in response.data, false);
  assert.equal("reasoning" in response.data, false);
  assert.equal("scenario" in response.data, false);
});

test("presenter does not use unapproved signal types as new outputs", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [createSignal("DATA_READY", "info", "Data ready", "Fixture and live data are available.")]
    })
  );

  assert.deepEqual(Object.keys(response.data.signals[0]).sort(), ["message", "severity", "title", "type"]);
});

test("includePressure false does not add pressure_hint when pressure signal is present", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createPressureSignal({
          pressure_level: "medium",
          source: "stored_scores_snapshot",
          evidence_count: 4,
          limitations: [],
          adapter_status: "available",
          pressure_score: 7
        })
      ]
    }),
    { includePressure: false }
  );

  assert.equal("pressure_hint" in response.data, false);
  assert.deepEqual(response.data.signals.map((signal) => signal.type), ["PRESSURE_HINT_AVAILABLE"]);
  assert.deepEqual(Object.keys(response.data.signals[0]).sort(), ["message", "severity", "title", "type"]);
});

test("includePressure true adds compact pressure_hint", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createPressureSignal({
          pressure_level: "medium",
          source: "stored_scores_snapshot",
          evidence_count: 4,
          limitations: [],
          adapter_status: "available",
          pressure_score: 7,
          debug_lineage: [{ internal: true }],
          raw_payload: { internal: true }
        })
      ]
    }),
    { includePressure: true }
  );

  assert.deepEqual(response.data.pressure_hint, {
    label: "Medium pressure hint",
    level: "medium",
    source: "stored_scores_snapshot",
    evidence_count: 4,
    limitations: [],
    safe_scope_note: PRESSURE_HINT_SAFE_SCOPE_NOTE
  });
  assert.equal("pressure_score" in (response.data.pressure_hint ?? {}), false);
  assert.equal("adapter_status" in (response.data.pressure_hint ?? {}), false);
  assert.equal("debug_lineage" in (response.data.pressure_hint ?? {}), false);
  assert.equal("raw_payload" in (response.data.pressure_hint ?? {}), false);
});

test("includePressure true does not add pressure_hint for invalid source", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createPressureSignal({
          pressure_level: "medium",
          source: "other_source",
          evidence_count: 4,
          limitations: [],
          adapter_status: "available"
        })
      ]
    }),
    { includePressure: true }
  );

  assert.equal("pressure_hint" in response.data, false);
});

test("includeOddsReliability false does not change presenter output", () => {
  const signalCoreOutput = buildSignalCoreOutput({
    status: "ready",
    hasFixture: true,
    hasScoreboard: true,
    hasOdds: true,
    signals: [
      createOddsReliabilitySignal({
        status: "available",
        source: "database",
        snapshot_count: 9,
        market_count: 4,
        provider_count: 2,
        latest_timestamp: "2026-07-05T11:58:00.000Z",
        limitation_count: 0
      })
    ]
  });

  const baseline = buildAgentPresenterBrief(signalCoreOutput);
  const withExplicitFalse = buildAgentPresenterBrief(signalCoreOutput, {
    includeOddsReliability: false
  });

  assert.deepEqual(withExplicitFalse, baseline);
  assert.equal("odds_reliability_hint" in withExplicitFalse.data, false);
});

test("includeOddsReliability true adds compact odds_reliability_hint", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createOddsReliabilitySignal({
          status: "available",
          source: "database",
          snapshot_count: 12,
          market_count: 5,
          provider_count: 3,
          latest_timestamp: "2026-07-05T11:58:00.000Z",
          limitation_count: 0
        })
      ]
    }),
    { includeOddsReliability: true }
  );

  assert.deepEqual(response.data.odds_reliability_hint, {
    label: "odds_data_available",
    status: "available",
    source: "database",
    snapshot_count: 12,
    market_count: 5,
    provider_count: 3,
    latest_timestamp: "2026-07-05T11:58:00.000Z",
    limitation_count: 0,
    safe_scope_note: ODDS_RELIABILITY_HINT_SAFE_SCOPE_NOTE
  });
  assert.equal("raw_payload" in (response.data.odds_reliability_hint ?? {}), false);
  assert.equal("probability" in (response.data.odds_reliability_hint ?? {}), false);
});

test("includeOddsReliability true omits malformed odds reliability signal", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createOddsReliabilitySignal({
          status: "available",
          source: "database",
          snapshot_count: "invalid",
          market_count: 5,
          provider_count: 3,
          latest_timestamp: "2026-07-05T11:58:00.000Z",
          limitation_count: 0
        })
      ]
    }),
    { includeOddsReliability: true }
  );

  assert.equal("odds_reliability_hint" in response.data, false);
});

test("presenter response with pressure_hint passes forbidden property key scan", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createPressureSignal({
          pressure_level: "high",
          source: "stored_scores_snapshot",
          evidence_count: 5,
          limitations: [],
          adapter_status: "available",
          pressure_score: 9,
          primary_side: "home",
          debug_lineage: [{ internal: true }],
          raw_payload: { internal: true },
          formula: "internal"
        })
      ]
    }),
    { includePressure: true }
  );

  assert.deepEqual(
    Object.keys(response.data.pressure_hint ?? {}).sort(),
    ALLOWED_PRESSURE_HINT_KEYS
  );

  const propertyKeys = new Set(collectPropertyKeys(response));
  for (const field of FORBIDDEN_PRESENTER_PROPERTY_KEYS) {
    assert.equal(propertyKeys.has(field), false);
  }
});

test("presenter response with odds_reliability_hint passes forbidden property key scan", () => {
  const response = buildAgentPresenterBrief(
    buildSignalCoreOutput({
      status: "ready",
      hasFixture: true,
      hasScoreboard: true,
      hasOdds: true,
      signals: [
        createOddsReliabilitySignal({
          status: "available",
          source: "database",
          snapshot_count: 12,
          market_count: 5,
          provider_count: 3,
          latest_timestamp: "2026-07-05T11:58:00.000Z",
          limitation_count: 0
        })
      ]
    }),
    { includeOddsReliability: true }
  );

  assert.deepEqual(
    Object.keys(response.data.odds_reliability_hint ?? {}).sort(),
    [
      "label",
      "latest_timestamp",
      "limitation_count",
      "market_count",
      "provider_count",
      "safe_scope_note",
      "snapshot_count",
      "source",
      "status"
    ]
  );

  const propertyKeys = new Set(collectPropertyKeys(response));
  for (const field of FORBIDDEN_PRESENTER_PROPERTY_KEYS) {
    assert.equal(propertyKeys.has(field), false);
  }
});
