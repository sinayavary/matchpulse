import type { CanonicalMatchState } from "./match-state-builder.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  getSignalCoreV0ForFixture,
  type SignalCoreV0Options,
  type SignalCoreV0Response,
  type SignalCoreV0Signal
} from "./signalcore-v0.js";

export type ProductAgentV1Status = "ready" | "partial" | "empty" | "stale";

export type ProductAgentV1Signal = {
  type: SignalCoreV0Signal["type"];
  severity: SignalCoreV0Signal["severity"];
  title: string;
  message: string;
};

export type ProductAgentV1Insight = {
  agent_version: "product-agent-v1";
  fixture_id: string;
  status: ProductAgentV1Status;
  headline: string;
  summary: string;
  readiness: {
    display_ready: boolean;
    has_fixture: boolean;
    has_scoreboard: boolean;
    has_odds: boolean;
    is_stale: boolean;
  };
  data_quality: {
    level: "complete" | "partial" | "empty";
    issues: string[];
  };
  freshness: {
    latest_data_timestamp: string | null;
    freshness_label: "fresh" | "stale" | "unknown";
    note: string;
  };
  signal_brief: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    top_signals: ProductAgentV1Signal[];
  };
  user_facing_notes: string[];
  safe_scope_note: string;
};

export type ProductAgentV1Response = {
  data: ProductAgentV1Insight;
  meta: {
    status: "live" | "degraded" | "no_data" | "stale";
    source: "product-agent";
    mode: "internal";
  };
};

type ProductAgentV1BuildInput = {
  fixture_id: string;
  summary: SignalCoreV0Response["data"]["summary"];
  signals: Array<Pick<SignalCoreV0Signal, "type" | "severity" | "title" | "message">>;
  state?: CanonicalMatchState;
};

const SAFE_SCOPE_NOTE =
  "This insight covers data availability, freshness, data quality, and approved signal activity only. It does not provide predictions, probabilities, recommendations, or betting guidance.";

const missingDataIssues = new Set([
  "fixture_missing",
  "scoreboard_missing",
  "odds_missing",
  "no_persisted_data"
] as const);

const severityPriority: Record<ProductAgentV1Signal["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2
};

function isStaleData(input: ProductAgentV1BuildInput): boolean {
  return input.summary.latest_data_timestamp !== null &&
    input.signals.some((signal) => signal.type === "DATA_STALE");
}

function buildFreshness(input: ProductAgentV1BuildInput): ProductAgentV1Insight["freshness"] {
  if (input.summary.latest_data_timestamp === null) {
    return {
      latest_data_timestamp: null,
      freshness_label: "unknown",
      note: "No latest data timestamp is available."
    };
  }

  if (isStaleData(input)) {
    return {
      latest_data_timestamp: input.summary.latest_data_timestamp,
      freshness_label: "stale",
      note: "Latest persisted data is older than the freshness window."
    };
  }

  return {
    latest_data_timestamp: input.summary.latest_data_timestamp,
    freshness_label: "fresh",
    note: "Latest persisted data is within the freshness window."
  };
}

function buildStatus(input: ProductAgentV1BuildInput): ProductAgentV1Status {
  if (input.summary.status === "empty") return "empty";
  return isStaleData(input) ? "stale" : input.summary.status;
}

function buildHeadline(status: ProductAgentV1Status): string {
  if (status === "ready") return "Match intelligence is ready for display.";
  if (status === "partial") return "Match intelligence is available with partial coverage.";
  if (status === "stale") return "Match intelligence is available, but freshness needs attention.";
  return "No persisted match intelligence is available.";
}

function buildIssueList(input: ProductAgentV1BuildInput): string[] {
  const issues = new Set<string>(input.state?.quality.issues ?? []);

  if (!input.summary.has_fixture) issues.add("fixture_missing");
  if (!input.summary.has_scoreboard) issues.add("scoreboard_missing");
  if (!input.summary.has_odds) issues.add("odds_missing");
  if (input.summary.status === "empty") issues.add("no_persisted_data");
  if (input.signals.some((signal) => signal.type === "IDENTITY_INCOMPLETE")) {
    issues.add("identity_incomplete");
  }
  if (isStaleData(input)) issues.add("data_stale");

  return [...issues];
}

function buildDataQualityLevel(
  input: ProductAgentV1BuildInput,
  issues: string[]
): ProductAgentV1Insight["data_quality"]["level"] {
  const hasMissingDataIssue = issues.some((issue) => missingDataIssues.has(
    issue as (typeof missingDataIssues extends Set<infer T> ? T : never)
  ));
  const hasAnyUsableData = input.summary.has_fixture || input.summary.has_scoreboard || input.summary.has_odds;

  if (!input.summary.has_fixture && !hasAnyUsableData) {
    return "empty";
  }

  if (hasMissingDataIssue) {
    return "partial";
  }

  return "complete";
}

function buildSummary(input: ProductAgentV1BuildInput, freshnessNote: string): string {
  const missingParts: string[] = [];

  if (!input.summary.has_fixture) missingParts.push("fixture identity");
  if (!input.summary.has_scoreboard) missingParts.push("scoreboard data");
  if (!input.summary.has_odds) missingParts.push("odds data");

  if (input.summary.status === "empty") {
    return "Persisted match data is not yet available for this fixture.";
  }

  if (missingParts.length === 0) {
    return `Fixture, scoreboard, and odds data are available. ${freshnessNote}`;
  }

  return `Some match data is available, but these parts are missing: ${missingParts.join(", ")}. ${freshnessNote}`;
}

function buildUserFacingNotes(input: ProductAgentV1BuildInput, freshnessNote: string): string[] {
  const notes: string[] = [];

  notes.push(
    input.summary.has_fixture
      ? "Fixture identity data is available."
      : "Fixture identity data is missing."
  );
  notes.push(
    input.summary.has_scoreboard
      ? "Scoreboard data is available."
      : "Scoreboard data is missing."
  );
  notes.push(
    input.summary.has_odds
      ? "Odds data is available."
      : "Odds data is missing."
  );
  notes.push(freshnessNote);

  if (input.signals.some((signal) => signal.type === "IDENTITY_INCOMPLETE")) {
    notes.push("Fixture identity data is incomplete.");
  }

  return Array.from(new Set(notes));
}

function buildTopSignals(
  signals: ProductAgentV1BuildInput["signals"]
): ProductAgentV1Insight["signal_brief"]["top_signals"] {
  return [...signals]
    .sort((left, right) => {
      const severityDiff = severityPriority[left.severity] - severityPriority[right.severity];
      return severityDiff !== 0 ? severityDiff : left.title.localeCompare(right.title);
    })
    .slice(0, 3)
    .map(({ type, severity, title, message }) => ({
      type,
      severity,
      title,
      message
    }));
}

function toMetaStatus(status: ProductAgentV1Status): ProductAgentV1Response["meta"]["status"] {
  if (status === "ready") return "live";
  if (status === "stale") return "stale";
  return status === "partial" ? "degraded" : "no_data";
}

export function buildProductAgentV1Insight(
  input: ProductAgentV1BuildInput
): ProductAgentV1Insight {
  const freshness = buildFreshness(input);
  const status = buildStatus(input);
  const issues = buildIssueList(input);
  const insight: ProductAgentV1Insight = {
    agent_version: "product-agent-v1",
    fixture_id: input.fixture_id,
    status,
    headline: buildHeadline(status),
    summary: buildSummary(input, freshness.note),
    readiness: {
      display_ready: input.summary.status !== "empty" &&
        input.summary.has_fixture &&
        (input.summary.has_scoreboard || input.summary.has_odds),
      has_fixture: input.summary.has_fixture,
      has_scoreboard: input.summary.has_scoreboard,
      has_odds: input.summary.has_odds,
      is_stale: status === "stale"
    },
    data_quality: {
      level: buildDataQualityLevel(input, issues),
      issues
    },
    freshness,
    signal_brief: {
      total: input.summary.signal_count,
      critical: input.summary.critical_count,
      warning: input.summary.warning_count,
      info: input.summary.info_count,
      top_signals: buildTopSignals(input.signals)
    },
    user_facing_notes: buildUserFacingNotes(input, freshness.note),
    safe_scope_note: SAFE_SCOPE_NOTE
  };

  assertNoForbiddenSignalFields(insight);
  return insight;
}

export function buildProductAgentV1(
  signalCoreOutput: SignalCoreV0Response
): ProductAgentV1Response {
  const insight = buildProductAgentV1Insight({
    fixture_id: signalCoreOutput.data.fixture_id,
    summary: signalCoreOutput.data.summary,
    signals: signalCoreOutput.data.signals,
    state: signalCoreOutput.data.state
  });

  const response: ProductAgentV1Response = {
    data: insight,
    meta: {
      status: toMetaStatus(insight.status),
      source: "product-agent",
      mode: "internal"
    }
  };

  assertNoForbiddenSignalFields(response);
  return response;
}

export async function getProductAgentV1ForFixture(
  fixtureId: string,
  options: SignalCoreV0Options = {}
): Promise<ProductAgentV1Response> {
  const signalCoreOutput = await getSignalCoreV0ForFixture(fixtureId, {
    ...options,
    includeState: true
  });
  return buildProductAgentV1(signalCoreOutput);
}
