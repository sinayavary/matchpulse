import test from "node:test";
import assert from "node:assert/strict";
import {
  SIGNALCORE_ALLOWED_SIGNAL_TYPES,
  assertNoForbiddenSignalFields
} from "./signalcore-contract.js";
import {
  generateSignalCoreV0,
  getSignalCoreV0ForFixture,
  normalizeSignalCoreOptions,
  summarizeSignals,
  type SignalCoreV0Signal
} from "./signalcore-v0.js";
import type { CanonicalMatchState } from "./match-state-builder.js";

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

test("staleAfterMinutes caps safely", () => {
  const options = normalizeSignalCoreOptions({ staleAfterMinutes: 99_999 });
  assert.equal(options.staleAfterMinutes, 10080);
});

test("output passes assertNoForbiddenSignalFields", () => {
  const result = generateSignalCoreV0({ state: makeState() });
  assert.doesNotThrow(() => assertNoForbiddenSignalFields(result));
});

test("output does not include forbidden terms", () => {
  const result = generateSignalCoreV0({ state: makeState(), options: { includeState: true } });
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
