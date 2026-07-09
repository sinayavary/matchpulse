import {
  buildCanonicalMatchState,
  getDbBackedMatchState,
  type CanonicalMatchState
} from "./match-state-builder.js";
import {
  getOddsReliabilityAssessmentForFixture,
  type OddsReliabilityAssessment
} from "./odds-reliability-foundation.js";
import {
  getPressureEngineV1FromStoredScores,
  type PressureEngineV1AdapterOutput
} from "./pressure-engine-v1-adapter.js";
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
  includePressure?: boolean;
  includeOddsReliability?: boolean;
  oddsLimit?: number;
  staleAfterMinutes?: number;
  pressureWindowSize?: number;
  pressureMaxEvidence?: number;
  pressureMaxPayloadAgeMinutes?: number;
};

export type NormalizedSignalCoreV0Options = {
  includeState: boolean;
  includePressure: boolean;
  includeOddsReliability: boolean;
  oddsLimit: number;
  staleAfterMinutes: number;
  pressureWindowSize: number;
  pressureMaxEvidence: number;
  pressureMaxPayloadAgeMinutes: number | null;
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

export type SignalCoreV0Dependencies = {
  getOddsReliabilityAssessmentForFixture?: (
    fixtureId: string
  ) => Promise<OddsReliabilityAssessment>;
};

export type OddsReliabilitySignalDetails = {
  fixture_id: string;
  reliability_status: OddsReliabilityAssessment["status"];
  snapshot_count: number;
  market_count: number;
  provider_count: number;
  latest_timestamp: string | null;
  limitation_count: number;
  source: "database";
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
  const requestedPressureWindowSize =
    typeof options.pressureWindowSize === "number" && Number.isFinite(options.pressureWindowSize)
      ? Math.trunc(options.pressureWindowSize)
      : 10;
  const requestedPressureMaxEvidence =
    typeof options.pressureMaxEvidence === "number" && Number.isFinite(options.pressureMaxEvidence)
      ? Math.trunc(options.pressureMaxEvidence)
      : 8;
  const requestedPressureMaxPayloadAgeMinutes =
    typeof options.pressureMaxPayloadAgeMinutes === "number" && Number.isFinite(options.pressureMaxPayloadAgeMinutes)
      ? Math.trunc(options.pressureMaxPayloadAgeMinutes)
      : null;

  return {
    includeState: options.includeState === true,
    includePressure: options.includePressure === true,
    includeOddsReliability: options.includeOddsReliability === true,
    oddsLimit: Math.min(50, Math.max(1, requestedOddsLimit)),
    staleAfterMinutes: Math.min(10080, Math.max(1, requestedStaleAfterMinutes)),
    pressureWindowSize: Math.min(50, Math.max(1, requestedPressureWindowSize)),
    pressureMaxEvidence: Math.min(20, Math.max(1, requestedPressureMaxEvidence)),
    pressureMaxPayloadAgeMinutes: requestedPressureMaxPayloadAgeMinutes === null
      ? null
      : Math.min(10080, Math.max(1, requestedPressureMaxPayloadAgeMinutes))
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

const PRESSURE_AVAILABLE_MESSAGE =
  "Rule-based pressure hint is available from stored score data.";
const PRESSURE_LIMITED_MESSAGE =
  "Rule-based pressure hint is limited by stored score data availability.";

function hasPressureLimitation(
  limitations: string[],
  patterns: readonly string[]
): boolean {
  const normalizedLimitations = limitations.map((limitation) => limitation.toLowerCase());
  return patterns.some((pattern) =>
    normalizedLimitations.some((limitation) => limitation.includes(pattern))
  );
}

export function createPressureSignalFromAdapterOutput(
  fixtureId: string,
  pressureOutput: PressureEngineV1AdapterOutput
): SignalCoreV0Signal | null {
  const evidenceCount = pressureOutput.pressure.evidence.length;
  if (
    evidenceCount === 0 ||
    pressureOutput.pressure.evaluated_records === 0 ||
    (pressureOutput.status === "unavailable" && pressureOutput.pressure.status === "unavailable")
  ) {
    return null;
  }

  const limitations = pressureOutput.limitations;
  const hasLimitation = hasPressureLimitation(limitations, [
    "older than the requested freshness window",
    "no stored scores_snapshot payload was found",
    "did not contain score-like records",
    "failed to read stored score snapshot payload",
    "adapter unavailable"
  ]);
  const severity =
    pressureOutput.status === "error" || hasLimitation ? "warning" : "info";
  const message = severity === "info"
    ? PRESSURE_AVAILABLE_MESSAGE
    : PRESSURE_LIMITED_MESSAGE;

  return createSignal(
    "PRESSURE_HINT_AVAILABLE",
    severity,
    "Pressure hint available",
    message,
    {
      fixture_id: fixtureId,
      pressure_kind: "rule_based_pressure_hint",
      pressure_level: pressureOutput.pressure.pressure_level,
      pressure_score: pressureOutput.pressure.pressure_score,
      source: "stored_scores_snapshot",
      adapter_status: pressureOutput.status,
      evidence_count: evidenceCount,
      evaluated_records: pressureOutput.pressure.evaluated_records,
      usable_records: pressureOutput.pressure.usable_records,
      latest_seq: pressureOutput.pressure.latest_seq,
      latest_ts: pressureOutput.pressure.latest_ts,
      limitations
    }
  );
}

export function createOddsReliabilitySignalFromAssessment(
  assessment: OddsReliabilityAssessment
): SignalCoreV0Signal {
  const status = assessment.status;
  const severity = status === "available" ? "info" : "warning";
  const title =
    status === "available"
      ? "Odds reliability assessed"
      : status === "limited"
        ? "Odds reliability assessment limited"
        : "Odds reliability assessment unavailable";
  const message =
    status === "available"
      ? "Stored odds reliability has been assessed from database-backed snapshots."
      : status === "limited"
        ? "Stored odds reliability assessment is available, but with limitations."
        : "Stored odds reliability assessment could not be completed for this fixture.";

  return createSignal(
    "ODDS_RELIABILITY_ASSESSED",
    severity,
    title,
    message,
    {
      fixture_id: assessment.fixture_id,
      reliability_status: status,
      snapshot_count: assessment.snapshot_count,
      market_count: assessment.market_count,
      provider_count: assessment.provider_count,
      latest_timestamp: assessment.latest_timestamp,
      limitation_count: assessment.limitations.length,
      source: assessment.source
    }
  );
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
  pressureOutput?: PressureEngineV1AdapterOutput | null;
  oddsReliabilityAssessment?: OddsReliabilityAssessment | null;
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

  if (normalized.includePressure && input.pressureOutput !== undefined && input.pressureOutput !== null) {
    const pressureSignal = createPressureSignalFromAdapterOutput(state.fixture_id, input.pressureOutput);
    if (pressureSignal !== null) {
      signals.push(pressureSignal);
    }
  }

  if (normalized.includeOddsReliability) {
    const oddsReliabilitySignal = createOddsReliabilitySignalFromAssessment(
      input.oddsReliabilityAssessment ?? {
        fixture_id: state.fixture_id,
        status: "unavailable",
        source: "database",
        snapshot_count: 0,
        market_count: 0,
        provider_count: 0,
        latest_timestamp: null,
        limitations: [],
        signals: [],
        safe_scope_note:
          "Stored odds reliability assessment could not be completed for this fixture."
      }
    );
    signals.push(oddsReliabilitySignal);
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
  options: SignalCoreV0Options = {},
  deps: SignalCoreV0Dependencies = {}
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

  let pressureOutput: PressureEngineV1AdapterOutput | null = null;
  if (normalized.includePressure) {
    try {
      pressureOutput = await getPressureEngineV1FromStoredScores(fixtureId, {
        windowSize: normalized.pressureWindowSize,
        maxEvidence: normalized.pressureMaxEvidence,
        maxPayloadAgeMinutes: normalized.pressureMaxPayloadAgeMinutes ?? undefined
      });
    } catch {
      pressureOutput = null;
    }
  }

  let oddsReliabilityAssessment: OddsReliabilityAssessment | null | undefined;
  if (normalized.includeOddsReliability) {
    const getOddsReliabilityAssessmentForFixtureImpl =
      deps.getOddsReliabilityAssessmentForFixture ?? getOddsReliabilityAssessmentForFixture;
    try {
      oddsReliabilityAssessment = await getOddsReliabilityAssessmentForFixtureImpl(fixtureId);
    } catch {
      oddsReliabilityAssessment = {
        fixture_id: fixtureId,
        status: "unavailable",
        source: "database",
        snapshot_count: 0,
        market_count: 0,
        provider_count: 0,
        latest_timestamp: null,
        limitations: ["Odds reliability assessment could not be completed."],
        signals: [],
        safe_scope_note:
          "Stored odds reliability assessment could not be completed for this fixture."
      };
    }
  }

  const data = generateSignalCoreV0({
    state,
    options: {
      ...normalized,
      pressureMaxPayloadAgeMinutes: normalized.pressureMaxPayloadAgeMinutes ?? undefined
    },
    pressureOutput,
    oddsReliabilityAssessment
  });

  return {
    data,
    meta: {
      status: toMetaStatus(data.summary.status),
      source: "signalcore",
      mode: "internal"
    }
  };
}
