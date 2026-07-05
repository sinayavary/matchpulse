import {
  buildCanonicalMatchState,
  getDbBackedMatchState,
  type CanonicalMatchState
} from "./match-state-builder.js";
import type {
  SignalCoreAllowedSignalSeverity,
  SignalCoreAllowedSignalType
} from "./signalcore-contract.js";

export type SignalCoreV0Signal = {
  type: SignalCoreAllowedSignalType;
  severity: SignalCoreAllowedSignalSeverity;
  title: string;
  message: string;
  details: Record<string, unknown>;
};

export type SignalCoreV0Options = {
  includeState?: boolean;
  oddsLimit?: number;
  staleAfterMinutes?: number;
};

export type NormalizedSignalCoreV0Options = {
  includeState: boolean;
  oddsLimit: number;
  staleAfterMinutes: number;
};

export type SignalCoreV0Summary = {
  status: "ready" | "partial" | "empty";
  signal_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  latest_data_timestamp: string | null;
};

export type SignalCoreV0Data = {
  fixture_id: string;
  summary: SignalCoreV0Summary;
  signals: SignalCoreV0Signal[];
  state?: CanonicalMatchState;
};

export type SignalCoreV0Response = {
  data: SignalCoreV0Data;
  meta: {
    status: "live" | "degraded" | "no_data";
    source: "signalcore";
    mode: "internal";
  };
};

export function normalizeSignalCoreOptions(
  options: SignalCoreV0Options = {}
): NormalizedSignalCoreV0Options {
  const requestedOddsLimit = typeof options.oddsLimit === "number" && Number.isFinite(options.oddsLimit)
    ? Math.trunc(options.oddsLimit)
    : 20;
  const requestedStaleAfterMinutes =
    typeof options.staleAfterMinutes === "number" && Number.isFinite(options.staleAfterMinutes)
      ? Math.trunc(options.staleAfterMinutes)
      : 180;

  return {
    includeState: options.includeState === true,
    oddsLimit: Math.min(50, Math.max(1, requestedOddsLimit)),
    staleAfterMinutes: Math.min(10080, Math.max(1, requestedStaleAfterMinutes))
  };
}

export function createSignal(
  type: SignalCoreAllowedSignalType,
  severity: SignalCoreAllowedSignalSeverity,
  title: string,
  message: string,
  details: Record<string, unknown>
): SignalCoreV0Signal {
  return { type, severity, title, message, details };
}

function toSummaryStatus(state: CanonicalMatchState): SignalCoreV0Summary["status"] {
  return state.quality.status === "complete"
    ? "ready"
    : state.quality.status === "partial" ? "partial" : "empty";
}

function toMetaStatus(status: SignalCoreV0Summary["status"]): SignalCoreV0Response["meta"]["status"] {
  return status === "ready" ? "live" : status === "partial" ? "degraded" : "no_data";
}

function getIdentityMissingFields(state: CanonicalMatchState): string[] {
  const missingFields: string[] = [];

  if (state.identity.home_team === null) missingFields.push("home_team");
  if (state.identity.away_team === null) missingFields.push("away_team");
  if (state.identity.competition === null) missingFields.push("competition");

  return missingFields;
}

function isFresh(latestDataTimestamp: string | null, staleAfterMinutes: number): boolean {
  if (latestDataTimestamp === null) return false;

  const latestTime = Date.parse(latestDataTimestamp);
  if (!Number.isFinite(latestTime)) return false;

  return Date.now() - latestTime <= staleAfterMinutes * 60_000;
}

export function summarizeSignals(
  signals: SignalCoreV0Signal[],
  state: CanonicalMatchState
): SignalCoreV0Summary {
  const criticalCount = signals.filter((signal) => signal.severity === "critical").length;
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;
  const infoCount = signals.filter((signal) => signal.severity === "info").length;

  return {
    status: toSummaryStatus(state),
    signal_count: signals.length,
    critical_count: criticalCount,
    warning_count: warningCount,
    info_count: infoCount,
    has_fixture: state.quality.has_fixture,
    has_scoreboard: state.quality.has_scoreboard,
    has_odds: state.quality.has_odds,
    latest_data_timestamp: state.freshness.latest_data_timestamp
  };
}

export function generateSignalCoreV0(input: {
  state: CanonicalMatchState;
  options?: SignalCoreV0Options;
}): SignalCoreV0Data {
  const normalized = normalizeSignalCoreOptions(input.options);
  const { state } = input;
  const signals: SignalCoreV0Signal[] = [];

  if (state.quality.status === "complete") {
    signals.push(
      createSignal(
        "DATA_READY",
        "info",
        "Data ready",
        "Fixture and at least one live data component are available.",
        {
          fixture_id: state.fixture_id,
          latest_data_timestamp: state.freshness.latest_data_timestamp
        }
      )
    );
  } else if (state.quality.status === "partial") {
    signals.push(
      createSignal(
        "STATE_PARTIAL",
        "warning",
        "State partial",
        "Canonical match state is available but incomplete.",
        {
          fixture_id: state.fixture_id,
          issue: state.quality.issues.join(", ") || "partial_state",
          latest_data_timestamp: state.freshness.latest_data_timestamp
        }
      )
    );
  } else {
    signals.push(
      createSignal(
        "STATE_EMPTY",
        "critical",
        "State empty",
        "No canonical match data is currently available.",
        {
          fixture_id: state.fixture_id,
          issue: state.quality.issues.join(", ") || "no_persisted_data",
          latest_data_timestamp: state.freshness.latest_data_timestamp
        }
      )
    );
  }

  signals.push(
    state.quality.has_fixture
      ? createSignal(
        "FIXTURE_AVAILABLE",
        "info",
        "Fixture available",
        "Fixture identity data is available.",
        { fixture_id: state.fixture_id }
      )
      : createSignal(
        "FIXTURE_MISSING",
        state.quality.status === "empty" ? "critical" : "warning",
        "Fixture missing",
        "Fixture identity data is missing.",
        { fixture_id: state.fixture_id, issue: "fixture_missing" }
      )
  );

  signals.push(
    state.quality.has_scoreboard
      ? createSignal(
        "SCORE_AVAILABLE",
        "info",
        "Score available",
        "Scoreboard data is available.",
        {
          fixture_id: state.fixture_id,
          latest_data_timestamp: state.scoreboard.last_data_received_at
        }
      )
      : createSignal(
        "SCOREBOARD_MISSING",
        "warning",
        "Scoreboard missing",
        "Scoreboard data is missing.",
        { fixture_id: state.fixture_id, issue: "scoreboard_missing" }
      )
  );

  signals.push(
    state.quality.has_odds
      ? createSignal(
        "ODDS_AVAILABLE",
        "info",
        "Odds available",
        "Odds data is available.",
        {
          fixture_id: state.fixture_id,
          latest_data_timestamp: state.freshness.latest_odds_timestamp
        }
      )
      : createSignal(
        "ODDS_MISSING",
        "warning",
        "Odds missing",
        "Odds data is missing.",
        { fixture_id: state.fixture_id, issue: "odds_missing" }
      )
  );

  const identityMissingFields = getIdentityMissingFields(state);
  if (identityMissingFields.length > 0) {
    signals.push(
      createSignal(
        "IDENTITY_INCOMPLETE",
        "warning",
        "Identity incomplete",
        "Fixture identity is missing one or more required fields.",
        {
          fixture_id: state.fixture_id,
          issue: "identity_incomplete",
          missing_fields: identityMissingFields
        }
      )
    );
  }

  signals.push(
    isFresh(state.freshness.latest_data_timestamp, normalized.staleAfterMinutes)
      ? createSignal(
        "DATA_FRESH",
        "info",
        "Data fresh",
        "The latest data timestamp is within the freshness window.",
        {
          fixture_id: state.fixture_id,
          latest_data_timestamp: state.freshness.latest_data_timestamp
        }
      )
      : createSignal(
        "DATA_STALE",
        "warning",
        "Data stale",
        state.freshness.latest_data_timestamp === null
          ? "No data timestamp is available for freshness checks."
          : "The latest data timestamp is older than the freshness window.",
        {
          fixture_id: state.fixture_id,
          latest_data_timestamp: state.freshness.latest_data_timestamp,
          issue: state.freshness.latest_data_timestamp === null
            ? "latest_data_timestamp_missing"
            : "latest_data_timestamp_stale"
        }
      )
  );

  const data: SignalCoreV0Data = {
    fixture_id: state.fixture_id,
    summary: summarizeSignals(signals, state),
    signals
  };

  if (normalized.includeState) {
    data.state = state;
  }

  return data;
}

export async function getSignalCoreV0ForFixture(
  fixtureId: string,
  options: SignalCoreV0Options = {}
): Promise<SignalCoreV0Response> {
  const normalized = normalizeSignalCoreOptions(options);

  let state: CanonicalMatchState;
  if (!process.env.DATABASE_URL) {
    state = buildCanonicalMatchState({
      fixtureId,
      fixture: null,
      scoreboard: null,
      odds: [],
      includeOdds: true
    });
  } else {
    try {
      state = await getDbBackedMatchState(fixtureId, {
        includeOdds: true,
        oddsLimit: normalized.oddsLimit
      });
    } catch {
      state = buildCanonicalMatchState({
        fixtureId,
        fixture: null,
        scoreboard: null,
        odds: [],
        includeOdds: true
      });
    }
  }

  const data = generateSignalCoreV0({ state, options: normalized });

  return {
    data,
    meta: {
      status: toMetaStatus(data.summary.status),
      source: "signalcore",
      mode: "internal"
    }
  };
}
