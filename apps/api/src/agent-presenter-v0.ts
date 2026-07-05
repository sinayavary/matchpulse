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
  oddsLimit: number;
  staleAfterMinutes: number;
  format: AgentPresenterFormat;
};

export type AgentPresenterSignal = {
  type: SignalCoreV0Signal["type"];
  severity: SignalCoreV0Signal["severity"];
  title: string;
  message: string;
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
  };
  meta: {
    status: "live" | "degraded" | "no_data";
    source: "agent-presenter";
    mode: "internal";
  };
};

const SAFE_SCOPE_NOTE =
  "This brief only describes data availability, freshness, and quality. It does not provide predictions, probabilities, recommendations, or betting guidance.";

export function normalizeAgentPresenterOptions(
  options: AgentPresenterOptions = {}
): NormalizedAgentPresenterOptions {
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
    staleAfterMinutes: Math.min(10080, Math.max(1, requestedStaleAfterMinutes)),
    format: options.format === "full" ? "full" : "compact"
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
  options: AgentPresenterOptions = {}
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

  assertNoForbiddenSignalFields(response);
  return response;
}

export async function getAgentPresenterBriefForFixture(
  fixtureId: string,
  options: AgentPresenterOptions = {}
): Promise<AgentPresenterResponse> {
  const normalized = normalizeAgentPresenterOptions(options);
  const signalCoreOutput = await getSignalCoreV0ForFixture(fixtureId, normalized);
  return buildAgentPresenterBrief(signalCoreOutput, normalized);
}
