import test from "node:test";
import assert from "node:assert/strict";
import {
  SIGNALCORE_ALLOWED_SIGNAL_TYPES,
  assertNoForbiddenSignalFields
} from "./signalcore-contract.js";
import {
  createPressureSignalFromAdapterOutput,
  generateSignalCoreV0,
  getSignalCoreV0ForFixture,
  normalizeSignalCoreOptions,
  summarizeSignals,
  type SignalCoreV0Signal
} from "./signalcore-v0.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import type { PressureEngineV1AdapterOutput } from "./pressure-engine-v1-adapter.js";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function makeState(overrides: DeepPartial<CanonicalMatchState> = {}): CanonicalMatchState {
  const base: CanonicalMatchState = {
    fixture_id: "17952170",
    identity: {
      fixture_id: "17952170",
      competition: "League",
      home_team: "Home",
      away_team: "Away",
      start_time_utc: "2026-07-05T12:00:00.000Z",
      status: "scheduled"
    },
    scoreboard: {
      available: true,
      home_score: 1,
      away_score: 1,
      phase: "live",
      last_data_received_at: "2026-07-05T11:55:00.000Z"
    },
    odds: {
      available: true,
      count: 1,
      markets: [{
        market_id: "m1",
        market_name: "Match result",
        selection_name: "Home",
        odds: 1.8,
        direction: "stable",
        source_timestamp: "2026-07-05T11:56:00.000Z"
      }]
    },
    freshness: {
      built_at: "2026-07-05T12:00:00.000Z",
      latest_score_timestamp: "2026-07-05T11:55:00.000Z",
      latest_odds_timestamp: "2026-07-05T11:56:00.000Z",
      latest_data_timestamp: "2026-07-05T11:56:00.000Z"
    },
    quality: {
      status: "complete",
      has_fixture: true,
      has_scoreboard: true,
      has_odds: true,
      issues: []
    }
  };

  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    scoreboard: { ...base.scoreboard, ...overrides.scoreboard },
    odds: {
      ...base.odds,
      ...overrides.odds,
      markets: overrides.odds?.markets === undefined
        ? base.odds.markets
        : overrides.odds.markets as CanonicalMatchState["odds"]["markets"]
    },
    freshness: { ...base.freshness, ...overrides.freshness },
    quality: { ...base.quality, ...overrides.quality }
  };
}

function hasSignal(signals: SignalCoreV0Signal[], type: string): boolean {
  return signals.some((signal) => signal.type === type);
}

function makePressureAdapterOutput(
  overrides: Partial<PressureEngineV1AdapterOutput> = {}
): PressureEngineV1AdapterOutput {
  const base: PressureEngineV1AdapterOutput = {
    adapter_version: "pressure-v1-stored-payload-adapter",
    fixture_id: "17952170",
    status: "available",
    source: "txline_raw_payloads",
    payload: {
      found: true,
      id: "payload-1",
      endpoint_type: "scores_snapshot",
      endpoint_path: "/scores_snapshot",
      as_of: "2026-07-05T11:54:00.000Z",
      provider_ts: "2026-07-05T11:55:00.000Z",
      received_at: "2026-07-05T11:55:30.000Z",
      stored_at: "2026-07-05T11:56:00.000Z",
      payload_hash: "hash-1",
      extracted_record_count: 2
    },
    pressure: {
      engine_version: "pressure-v1-rule-based",
      kind: "rule_based_pressure_hint",
      status: "available",
      pressure_level: "medium",
      pressure_score: 4,
      primary_side: "unknown",
      evaluated_records: 2,
      usable_records: 1,
      latest_seq: 12,
      latest_ts: 1720170960000,
      evidence: [
        {
          seq: 12,
          ts: 1720170960000,
          signal: "possessionType",
          value: "AttackPossession",
          weight: 2,
          reason: "possessionType=AttackPossession indicates a sparse pressure state"
        }
      ],
      limitations: [],
      debug_lineage: [
        {
          seq: 12,
          ts: 1720170960000,
          extracted_fields: ["seq", "ts", "possessionType"],
          used: true,
          reason: "possessionType evidence"
        }
      ],
      safe_scope_note:
        "This output is a rule-based pressure hint from available TxLINE score fields. It is not a prediction, probability, betting recommendation, or trained model output."
    },
    limitations: [],
    safe_scope_note:
      "This adapter reads stored TxLINE score snapshot payloads and returns a rule-based pressure hint. It does not call live APIs, write data, predict outcomes, produce probabilities, or provide betting guidance."
  };

  return {
    ...base,
    ...overrides,
    payload: { ...base.payload, ...overrides.payload },
    pressure: { ...base.pressure, ...overrides.pressure },
    limitations: overrides.limitations ?? base.limitations
  };
}

test("complete state generates DATA_READY", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.equal(hasSignal(result.signals, "DATA_READY"), true);
});

test("partial state generates STATE_PARTIAL", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      quality: {
        status: "partial",
        has_fixture: true,
        has_scoreboard: false,
        has_odds: true,
        issues: ["scoreboard_missing"]
      },
      scoreboard: {
        available: false,
        home_score: null,
        away_score: null,
        phase: null,
        last_data_received_at: null
      }
    })
  });
  assert.equal(hasSignal(result.signals, "STATE_PARTIAL"), true);
});

test("empty state generates STATE_EMPTY", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      quality: {
        status: "empty",
        has_fixture: false,
        has_scoreboard: false,
        has_odds: false,
        issues: ["no_persisted_data"]
      },
      identity: {
        competition: null,
        home_team: null,
        away_team: null,
        start_time_utc: null,
        status: null
      },
      scoreboard: {
        available: false,
        home_score: null,
        away_score: null,
        phase: null,
        last_data_received_at: null
      },
      odds: {
        available: false,
        count: 0,
        markets: []
      },
      freshness: {
        built_at: "2026-07-05T12:00:00.000Z",
        latest_score_timestamp: null,
        latest_odds_timestamp: null,
        latest_data_timestamp: null
      }
    })
  });
  assert.equal(hasSignal(result.signals, "STATE_EMPTY"), true);
});

test("fixture present generates FIXTURE_AVAILABLE", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.equal(hasSignal(result.signals, "FIXTURE_AVAILABLE"), true);
});

test("fixture missing generates FIXTURE_MISSING", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      quality: {
        status: "partial",
        has_fixture: false,
        has_scoreboard: true,
        has_odds: true,
        issues: ["fixture_missing"]
      }
    })
  });
  assert.equal(hasSignal(result.signals, "FIXTURE_MISSING"), true);
});

test("scoreboard present generates SCORE_AVAILABLE", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.equal(hasSignal(result.signals, "SCORE_AVAILABLE"), true);
});

test("scoreboard missing generates SCOREBOARD_MISSING", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      quality: {
        status: "partial",
        has_fixture: true,
        has_scoreboard: false,
        has_odds: true,
        issues: ["scoreboard_missing"]
      },
      scoreboard: {
        available: false,
        home_score: null,
        away_score: null,
        phase: null,
        last_data_received_at: null
      }
    })
  });
  assert.equal(hasSignal(result.signals, "SCOREBOARD_MISSING"), true);
});

test("odds present generates ODDS_AVAILABLE", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.equal(hasSignal(result.signals, "ODDS_AVAILABLE"), true);
});

test("odds missing generates ODDS_MISSING", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      quality: {
        status: "partial",
        has_fixture: true,
        has_scoreboard: true,
        has_odds: false,
        issues: ["odds_missing"]
      },
      odds: {
        available: false,
        count: 0,
        markets: []
      },
      freshness: {
        built_at: "2026-07-05T12:00:00.000Z",
        latest_score_timestamp: "2026-07-05T11:55:00.000Z",
        latest_odds_timestamp: null,
        latest_data_timestamp: "2026-07-05T11:55:00.000Z"
      }
    })
  });
  assert.equal(hasSignal(result.signals, "ODDS_MISSING"), true);
});

test("incomplete identity generates IDENTITY_INCOMPLETE", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      identity: {
        home_team: null,
        away_team: "Away",
        competition: null
      }
    })
  });
  assert.equal(hasSignal(result.signals, "IDENTITY_INCOMPLETE"), true);
});

test("fresh data generates DATA_FRESH", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      freshness: {
        built_at: new Date().toISOString(),
        latest_score_timestamp: new Date(Date.now() - 60_000).toISOString(),
        latest_odds_timestamp: new Date(Date.now() - 30_000).toISOString(),
        latest_data_timestamp: new Date(Date.now() - 30_000).toISOString()
      }
    }),
    options: { staleAfterMinutes: 180 }
  });
  assert.equal(hasSignal(result.signals, "DATA_FRESH"), true);
});

test("stale data generates DATA_STALE", () => {
  const result = generateSignalCoreV0({
    state: makeState({
      freshness: {
        built_at: "2026-07-05T12:00:00.000Z",
        latest_score_timestamp: null,
        latest_odds_timestamp: null,
        latest_data_timestamp: null
      }
    }),
    options: { staleAfterMinutes: 180 }
  });
  assert.equal(hasSignal(result.signals, "DATA_STALE"), true);
});

test("summary counts severities correctly", () => {
  const state = makeState();
  const signals: SignalCoreV0Signal[] = [
    { type: "DATA_READY", severity: "info", title: "a", message: "a", details: {} },
    { type: "ODDS_MISSING", severity: "warning", title: "b", message: "b", details: {} },
    { type: "STATE_EMPTY", severity: "critical", title: "c", message: "c", details: {} }
  ];
  const summary = summarizeSignals(signals, state);

  assert.equal(summary.signal_count, 3);
  assert.equal(summary.info_count, 1);
  assert.equal(summary.warning_count, 1);
  assert.equal(summary.critical_count, 1);
});

test("includeState false does not include state", () => {
  const result = generateSignalCoreV0({
    state: makeState(),
    options: { includeState: false }
  });
  assert.equal("state" in result, false);
});

test("oddsLimit caps at 50", () => {
  const options = normalizeSignalCoreOptions({ oddsLimit: 999 });
  assert.equal(options.oddsLimit, 50);
});

test("includePressure defaults false", () => {
  const options = normalizeSignalCoreOptions({});
  assert.equal(options.includePressure, false);
});

test("pressure options clamp safely", () => {
  const options = normalizeSignalCoreOptions({
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

test("staleAfterMinutes caps safely", () => {
  const options = normalizeSignalCoreOptions({ staleAfterMinutes: 99_999 });
  assert.equal(options.staleAfterMinutes, 10080);
});

test("contract allows pressure signal type", () => {
  assert.equal(
    SIGNALCORE_ALLOWED_SIGNAL_TYPES.includes("PRESSURE_HINT_AVAILABLE"),
    true
  );
});

test("pressure signal maps approved details shape", () => {
  const pressureOutput = makePressureAdapterOutput();
  const signal = createPressureSignalFromAdapterOutput("17952170", pressureOutput);

  assert.ok(signal);
  assert.equal(signal.type, "PRESSURE_HINT_AVAILABLE");
  assert.equal(signal.severity === "info" || signal.severity === "warning", true);
  assert.equal(signal.title, "Pressure hint available");

  const keys = Object.keys(signal.details).sort();
  assert.deepEqual(keys, [
    "adapter_status",
    "evaluated_records",
    "evidence_count",
    "fixture_id",
    "latest_seq",
    "latest_ts",
    "limitations",
    "pressure_kind",
    "pressure_level",
    "pressure_score",
    "source",
    "usable_records"
  ]);
  assert.doesNotThrow(() => assertNoForbiddenSignalFields(signal));
  assert.equal("debug_lineage" in signal.details, false);
  assert.equal("payload" in signal.details, false);
});

test("unavailable pressure returns null", () => {
  const signal = createPressureSignalFromAdapterOutput(
    "17952170",
    makePressureAdapterOutput({
      status: "unavailable",
      pressure: {
        ...makePressureAdapterOutput().pressure,
        status: "unavailable",
        evidence: [],
        evaluated_records: 0,
        usable_records: 0,
        latest_seq: null,
        latest_ts: null,
        limitations: []
      }
    })
  );

  assert.equal(signal, null);
});

test("includePressure false preserves existing output", () => {
  const result = generateSignalCoreV0({
    state: makeState(),
    options: { includePressure: false },
    pressureOutput: makePressureAdapterOutput()
  });

  assert.equal(hasSignal(result.signals, "PRESSURE_HINT_AVAILABLE"), false);
});

test("output passes assertNoForbiddenSignalFields", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.doesNotThrow(() => assertNoForbiddenSignalFields(result));
});

test("output does not include forbidden terms", () => {
  const result = generateSignalCoreV0({
    state: makeState(),
    options: { includeState: true, includePressure: true },
    pressureOutput: makePressureAdapterOutput()
  });
  const serialized = JSON.stringify(result).toLowerCase();
  const forbiddenTerms = [
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
  ];

  forbiddenTerms.forEach((term) => {
    assert.equal(serialized.includes(`"${term}"`), false);
  });
});

test("pressure output does not expose forbidden property keys", () => {
  const result = generateSignalCoreV0({
    state: makeState(),
    options: { includePressure: true },
    pressureOutput: makePressureAdapterOutput()
  });
  const serialized = JSON.stringify(result);
  const forbiddenPropertyKeys = [
    "\"confidence\":",
    "\"probability\":",
    "\"recommendation\":",
    "\"recommended_bet\":",
    "\"bet\":",
    "\"wager\":",
    "\"stake\":",
    "\"expected_value\":",
    "\"edge\":",
    "\"prediction\":",
    "\"winner\":"
  ];

  forbiddenPropertyKeys.forEach((key) => {
    assert.equal(serialized.includes(key), false);
  });
});

test("no agent reasoning fields exist", () => {
  const result = generateSignalCoreV0({ state: makeState(), options: { includeState: true } });
  const serialized = JSON.stringify(result).toLowerCase();

  ["reasoning", "analysis", "recommended_action"].forEach((term) => {
    assert.equal(serialized.includes(`"${term}"`), false);
  });
});

test("no signalcore output uses unapproved signal types", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  result.signals.forEach((signal) => {
    assert.equal(SIGNALCORE_ALLOWED_SIGNAL_TYPES.includes(signal.type), true);
  });
});

test("fixture response falls back safely without database configuration", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const result = await getSignalCoreV0ForFixture("17588223", { includeState: true });
    assert.equal(result.data.fixture_id, "17588223");
    assert.equal(result.meta.source, "signalcore");
    assert.equal(result.meta.mode, "internal");
    assert.equal(result.data.state?.fixture_id, "17588223");
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});
