import type { CanonicalMatchState } from "./match-state-builder.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  getSignalCoreV0ForFixture,
  type SignalCoreV0Options,
  type SignalCoreV0Response,
  type SignalCoreV0Signal
} from "./signalcore-v0.js";

export type AgentPresenterFormat = "compact" | "full";

export type AgentPresenterOptions = SignalCoreV0Options & {
  format?: AgentPresenterFormat;
};

export type NormalizedAgentPresenterOptions = {
  includeState: boolean;
  includePressure: boolean;
  includeOddsReliability: boolean;
  includeEventImpact: boolean;
  oddsLimit: number;
  staleAfterMinutes: number;
  pressureWindowSize: number;
  pressureMaxEvidence: number;
  pressureMaxPayloadAgeMinutes: number | null;
  format: AgentPresenterFormat;
};

export type AgentPresenterSignal = {
  type: SignalCoreV0Signal["type"];
  severity: SignalCoreV0Signal["severity"];
  title: string;
  message: string;
};

export type AgentPresenterPressureHintLabel =
  | "No pressure hint"
  | "Low pressure hint"
  | "Medium pressure hint"
  | "High pressure hint"
  | "Limited pressure hint";

export type AgentPresenterPressureHintLevel =
  | "none"
  | "low"
  | "medium"
  | "high";

export type AgentPresenterPressureHint = {
  label: AgentPresenterPressureHintLabel;
  level: AgentPresenterPressureHintLevel;
  source: "stored_scores_snapshot";
  evidence_count: number;
  limitations: string[];
  safe_scope_note: string;
};

export type AgentPresenterOddsReliabilityHintLabel =
  | "odds_data_unavailable"
  | "odds_data_limited"
  | "odds_data_available";

export type AgentPresenterOddsReliabilityHint = {
  label: AgentPresenterOddsReliabilityHintLabel;
  status: "unavailable" | "limited" | "available";
  source: "database";
  snapshot_count: number;
  market_count: number;
  provider_count: number;
  latest_timestamp: string | null;
  limitation_count: number;
  safe_scope_note: string;
};

export type AgentPresenterEventImpactHint = {
  status: "available" | "unavailable";
  level: AgentPresenterPressureHintLevel;
  label: string;
  key_event_count: number;
  pressure_level: AgentPresenterPressureHintLevel;
  source: "stored_events";
};

export type AgentPresenterBrief = {
  status_label: "ready" | "partial" | "empty";
  headline: string;
  overview: string;
  available_data: string[];
  missing_data: string[];
  freshness_note: string;
  quality_notes: string[];
  safe_scope_note: string;
};

export type AgentPresenterResponse = {
  data: {
    fixture_id: string;
    agent_version: "presenter-v0";
    brief: AgentPresenterBrief;
    signal_summary: SignalCoreV0Response["data"]["summary"];
    signals: AgentPresenterSignal[];
    state?: CanonicalMatchState;
    pressure_hint?: AgentPresenterPressureHint;
    odds_reliability_hint?: AgentPresenterOddsReliabilityHint;
    event_impact_hint?: AgentPresenterEventImpactHint;
  };
  meta: {
    status: "live" | "degraded" | "no_data";
    source: "agent-presenter";
    mode: "internal";
  };
};

const SAFE_SCOPE_NOTE =
  "This brief only describes data availability, freshness, and quality for safe display.";

export const PRESSURE_HINT_SAFE_SCOPE_NOTE =
  "This pressure hint is rule-based and based on available stored score data. It is not a prediction, probability, or betting recommendation.";

export const ODDS_RELIABILITY_HINT_SAFE_SCOPE_NOTE =
  "This is a data-quality hint about stored odds availability, coverage, and freshness. It is not a prediction, probability, betting recommendation, expected value, or wagering instruction.";

const PRESSURE_HINT_LEVELS: readonly AgentPresenterPressureHintLevel[] = [
  "none",
  "low",
  "medium",
  "high"
];

function isAgentPresenterPressureHintLevel(
  value: unknown
): value is AgentPresenterPressureHintLevel {
  return typeof value === "string" && PRESSURE_HINT_LEVELS.includes(value as AgentPresenterPressureHintLevel);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOddsReliabilityStatus(
  value: unknown
): value is AgentPresenterOddsReliabilityHint["status"] {
  return value === "unavailable" || value === "limited" || value === "available";
}

function isOddsReliabilityHintLabel(
  value: unknown
): value is AgentPresenterOddsReliabilityHintLabel {
  return value === "odds_data_unavailable" ||
    value === "odds_data_limited" ||
    value === "odds_data_available";
}

export function normalizeAgentPresenterOptions(
  options: AgentPresenterOptions | NormalizedAgentPresenterOptions = {}
): NormalizedAgentPresenterOptions {
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
    includeEventImpact: options.includeEventImpact === true,
    oddsLimit: Math.min(50, Math.max(1, requestedOddsLimit)),
    staleAfterMinutes: Math.min(10080, Math.max(1, requestedStaleAfterMinutes)),
    pressureWindowSize: Math.min(50, Math.max(1, requestedPressureWindowSize)),
    pressureMaxEvidence: Math.min(20, Math.max(1, requestedPressureMaxEvidence)),
    pressureMaxPayloadAgeMinutes: requestedPressureMaxPayloadAgeMinutes === null
      ? null
      : Math.min(10080, Math.max(1, requestedPressureMaxPayloadAgeMinutes)),
    format: options.format === "full" ? "full" : "compact"
  };
}

function eventImpactLabel(level: AgentPresenterPressureHintLevel): string {
  if (level === "high") return "High stored-event impact";
  if (level === "medium") return "Moderate stored-event impact";
  if (level === "low") return "Low stored-event impact";
  return "No stored-event impact";
}

export function buildEventImpactHintFromSignals(
  signals: SignalCoreV0Signal[]
): AgentPresenterEventImpactHint | undefined {
  const signal = signals.find((candidate) => candidate.type === "EVENT_IMPACT_ASSESSED");
  if (signal === undefined || !isRecordObject(signal.details)) return undefined;

  const details = signal.details;
  if (!isAgentPresenterPressureHintLevel(details.impact_level) ||
    !isAgentPresenterPressureHintLevel(details.pressure_level) ||
    typeof details.key_event_count !== "number" ||
    !Number.isFinite(details.key_event_count) ||
    !Number.isInteger(details.key_event_count) ||
    details.key_event_count < 0) {
    return undefined;
  }

  const level = details.impact_level;
  return {
    status: "available",
    level,
    label: eventImpactLabel(level),
    key_event_count: Math.min(10, details.key_event_count),
    pressure_level: details.pressure_level,
    source: "stored_events"
  };
}

export function sanitizeSignalsForBrief(
  signals: SignalCoreV0Signal[]
): AgentPresenterSignal[] {
  return signals.map((signal) => ({
    type: signal.type,
    severity: signal.severity,
    title: signal.title,
    message: signal.message
  }));
}

export function buildPressureHintFromSignals(
  signals: SignalCoreV0Signal[]
): AgentPresenterPressureHint | undefined {
  const signal = signals.find((candidate) => candidate.type === "PRESSURE_HINT_AVAILABLE");
  if (signal === undefined) {
    return undefined;
  }

  const details = signal.details;
  if (!isRecordObject(details)) {
    return undefined;
  }
  const source = details.source;
  if (source !== "stored_scores_snapshot") {
    return undefined;
  }

  const rawLevel = details.pressure_level;
  const level = isAgentPresenterPressureHintLevel(rawLevel) ? rawLevel : "none";

  const evidenceCount = typeof details.evidence_count === "number" && Number.isFinite(details.evidence_count) && details.evidence_count >= 0
    ? details.evidence_count
    : 0;
  const limitations = isStringArray(details.limitations) ? details.limitations : [];
  const adapterStatus = details.adapter_status;

  const label =
    signal.severity === "warning" ||
    adapterStatus === "error" ||
    adapterStatus === "unavailable" ||
    limitations.length > 0
      ? "Limited pressure hint"
      : level === "none"
        ? "No pressure hint"
        : level === "low"
          ? "Low pressure hint"
          : level === "medium"
            ? "Medium pressure hint"
            : "High pressure hint";

  return {
    label,
    level,
    source: "stored_scores_snapshot",
    evidence_count: evidenceCount,
    limitations: [...limitations],
    safe_scope_note: PRESSURE_HINT_SAFE_SCOPE_NOTE
  };
}

export function buildOddsReliabilityHintFromSignals(
  signals: SignalCoreV0Signal[]
): AgentPresenterOddsReliabilityHint | undefined {
  const signal = signals.find((candidate) => candidate.type === "ODDS_RELIABILITY_ASSESSED");
  if (signal === undefined) {
    return undefined;
  }

  const details = signal.details;
  if (!isRecordObject(details)) {
    return undefined;
  }
  if (!isOddsReliabilityStatus(details.reliability_status)) {
    return undefined;
  }
  if (details.source !== "database") {
    return undefined;
  }
  if (!isNonNegativeFiniteNumber(details.snapshot_count) ||
    !isNonNegativeFiniteNumber(details.market_count) ||
    !isNonNegativeFiniteNumber(details.provider_count) ||
    !isNonNegativeFiniteNumber(details.limitation_count)) {
    return undefined;
  }
  if (!(typeof details.latest_timestamp === "string" || details.latest_timestamp === null)) {
    return undefined;
  }

  const label =
    details.reliability_status === "available"
      ? "odds_data_available"
      : details.reliability_status === "limited"
        ? "odds_data_limited"
        : "odds_data_unavailable";

  if (!isOddsReliabilityHintLabel(label)) {
    return undefined;
  }

  return {
    label,
    status: details.reliability_status,
    source: "database",
    snapshot_count: details.snapshot_count,
    market_count: details.market_count,
    provider_count: details.provider_count,
    latest_timestamp: details.latest_timestamp,
    limitation_count: details.limitation_count,
    safe_scope_note: ODDS_RELIABILITY_HINT_SAFE_SCOPE_NOTE
  };
}

export function buildAvailableDataList(
  summary: SignalCoreV0Response["data"]["summary"]
): string[] {
  const items: string[] = [];

  if (summary.has_fixture) items.push("Fixture identity is available.");
  if (summary.has_scoreboard) items.push("Scoreboard data is available.");
  if (summary.has_odds) items.push("Odds data is available.");

  return items;
}

export function buildMissingDataList(
  summary: SignalCoreV0Response["data"]["summary"]
): string[] {
  const items: string[] = [];

  if (!summary.has_fixture) items.push("Fixture identity is missing.");
  if (!summary.has_scoreboard) items.push("Scoreboard data is missing.");
  if (!summary.has_odds) items.push("Odds data is missing.");

  return items;
}

export function buildFreshnessNote(
  signals: SignalCoreV0Signal[],
  summary: SignalCoreV0Response["data"]["summary"]
): string {
  if (signals.some((signal) => signal.type === "DATA_FRESH")) {
    return "Latest persisted data is within the freshness window.";
  }
  if (summary.latest_data_timestamp === null) {
    return "No latest data timestamp is available.";
  }
  if (signals.some((signal) => signal.type === "DATA_STALE")) {
    return "Latest persisted data is older than the freshness window.";
  }
  return "No latest data timestamp is available.";
}

function buildHeadline(status: AgentPresenterBrief["status_label"]): string {
  if (status === "ready") return "Match data is ready for safe display.";
  if (status === "partial") return "Match data is partially available.";
  return "No persisted match data is available.";
}

function buildOverview(input: {
  status: AgentPresenterBrief["status_label"];
  availableData: string[];
  missingData: string[];
}): string {
  if (input.status === "ready") {
    return input.missingData.length === 0
      ? "Fixture, scoreboard, and odds data are available for safe display."
      : `Fixture, scoreboard, and odds data were checked. Missing: ${input.missingData.join(" ")}`;
  }
  if (input.status === "partial") {
    return input.missingData.length === 0
      ? "Some persisted match data is available, but the full match view is incomplete."
      : `Some persisted match data is available, but these parts are missing: ${input.missingData.join(" ")}`;
  }
  return "The system does not have enough persisted data to build a brief.";
}

function buildQualityNotes(
  signals: AgentPresenterSignal[],
  format: AgentPresenterFormat
): string[] {
  const notes = signals
    .filter((signal) => signal.type !== "DATA_FRESH")
    .map((signal) => signal.message);

  if (format === "compact") {
    return Array.from(new Set(notes)).slice(0, 3);
  }

  return Array.from(new Set(notes));
}

function toMetaStatus(
  status: AgentPresenterBrief["status_label"]
): AgentPresenterResponse["meta"]["status"] {
  return status === "ready" ? "live" : status === "partial" ? "degraded" : "no_data";
}

export function buildAgentPresenterBrief(
  signalCoreOutput: SignalCoreV0Response,
  options: AgentPresenterOptions | NormalizedAgentPresenterOptions = {}
): AgentPresenterResponse {
  const normalized = normalizeAgentPresenterOptions(options);
  const { data } = signalCoreOutput;
  const availableData = buildAvailableDataList(data.summary);
  const missingData = buildMissingDataList(data.summary);
  const sanitizedSignals = sanitizeSignalsForBrief(data.signals);
  const brief: AgentPresenterBrief = {
    status_label: data.summary.status,
    headline: buildHeadline(data.summary.status),
    overview: buildOverview({
      status: data.summary.status,
      availableData,
      missingData
    }),
    available_data: availableData,
    missing_data: missingData,
    freshness_note: buildFreshnessNote(data.signals, data.summary),
    quality_notes: buildQualityNotes(sanitizedSignals, normalized.format),
    safe_scope_note: SAFE_SCOPE_NOTE
  };

  const response: AgentPresenterResponse = {
    data: {
      fixture_id: data.fixture_id,
      agent_version: "presenter-v0",
      brief,
      signal_summary: data.summary,
      signals: sanitizedSignals
    },
    meta: {
      status: toMetaStatus(brief.status_label),
      source: "agent-presenter",
      mode: "internal"
    }
  };

  if (normalized.includeState && data.state !== undefined) {
    response.data.state = data.state;
  }

  if (normalized.includePressure) {
    const pressureHint = buildPressureHintFromSignals(data.signals);
    if (pressureHint !== undefined) {
      response.data.pressure_hint = pressureHint;
    }
  }

  if (normalized.includeOddsReliability) {
    const oddsReliabilityHint = buildOddsReliabilityHintFromSignals(data.signals);
    if (oddsReliabilityHint !== undefined) {
      response.data.odds_reliability_hint = oddsReliabilityHint;
    }
  }

  if (normalized.includeEventImpact) {
    const eventImpactHint = buildEventImpactHintFromSignals(data.signals);
    if (eventImpactHint !== undefined) {
      response.data.event_impact_hint = eventImpactHint;
    }
  }

  assertNoForbiddenSignalFields(response);
  return response;
}

export async function getAgentPresenterBriefForFixture(
  fixtureId: string,
  options: AgentPresenterOptions = {}
): Promise<AgentPresenterResponse> {
  const normalized = normalizeAgentPresenterOptions(options);
  const signalCoreOutput = await getSignalCoreV0ForFixture(fixtureId, {
    includeState: normalized.includeState,
    includePressure: normalized.includePressure,
    includeOddsReliability: normalized.includeOddsReliability,
    includeInternalContext: normalized.includeEventImpact,
    includeEventImpact: normalized.includeEventImpact,
    oddsLimit: normalized.oddsLimit,
    staleAfterMinutes: normalized.staleAfterMinutes,
    pressureWindowSize: normalized.pressureWindowSize,
    pressureMaxEvidence: normalized.pressureMaxEvidence,
    pressureMaxPayloadAgeMinutes: normalized.pressureMaxPayloadAgeMinutes ?? undefined
  });
  return buildAgentPresenterBrief(signalCoreOutput, normalized);
}
