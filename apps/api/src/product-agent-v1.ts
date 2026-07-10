import type { CanonicalMatchState } from "./match-state-builder.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  getSignalCoreV0ForFixture,
  type SignalCoreV0Dependencies,
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

export type ProductAgentV1DecisionContext = {
  attention_level: "none" | "low" | "medium" | "high";
  readiness_level: "not_ready" | "limited" | "ready";
  market_reliability_level: "unavailable" | "limited" | "available";
  event_pressure_level: "none" | "low" | "medium" | "high";
  operator_guidance: string[];
  limitations: string[];
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
  decision_context: ProductAgentV1DecisionContext;
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

export type ProductAgentV1InsightSummary = {
  agent_version: ProductAgentV1Insight["agent_version"];
  status: ProductAgentV1Insight["status"];
  quality: ProductAgentV1Insight["data_quality"]["level"];
  freshness: ProductAgentV1Insight["freshness"]["freshness_label"];
  issue_count: number;
  issues: string[];
  top_signal_types: Array<ProductAgentV1Signal["type"]>;
  display_ready: boolean;
};

export type ProductAgentV1BuildInput = {
  fixture_id: string;
  summary: SignalCoreV0Response["data"]["summary"];
  signals: Array<
    Pick<SignalCoreV0Signal, "type" | "severity" | "title" | "message"> & {
      details?: Record<string, unknown>;
    }
  >;
  state?: CanonicalMatchState;
  odds_reliability_status?: ProductAgentV1DecisionContext["market_reliability_level"];
  event_impact_level?: ProductAgentV1DecisionContext["event_pressure_level"];
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

const eventPressureLevels = new Set<ProductAgentV1DecisionContext["event_pressure_level"]>([
  "none", "low", "medium", "high"
]);

const marketReliabilityLevels = new Set<ProductAgentV1DecisionContext["market_reliability_level"]>([
  "unavailable", "limited", "available"
]);

function getSignalDetail(
  signal: ProductAgentV1BuildInput["signals"][number],
  key: string
): unknown {
  return "details" in signal && signal.details !== null && typeof signal.details === "object"
    ? (signal.details as Record<string, unknown>)[key]
    : undefined;
}

function isMarketReliabilityLevel(
  value: unknown
): value is ProductAgentV1DecisionContext["market_reliability_level"] {
  return typeof value === "string" && marketReliabilityLevels.has(
    value as ProductAgentV1DecisionContext["market_reliability_level"]
  );
}

function isEventPressureLevel(
  value: unknown
): value is ProductAgentV1DecisionContext["event_pressure_level"] {
  return typeof value === "string" && eventPressureLevels.has(
    value as ProductAgentV1DecisionContext["event_pressure_level"]
  );
}

export function extractProductAgentDecisionContextInputFromSignalCore(
  signalCoreOutput: SignalCoreV0Response
): Pick<ProductAgentV1BuildInput, "odds_reliability_status" | "event_impact_level"> {
  const input: Pick<
    ProductAgentV1BuildInput,
    "odds_reliability_status" | "event_impact_level"
  > = {};
  const reliabilitySignal = signalCoreOutput.data.signals.find(
    (signal) => signal.type === "ODDS_RELIABILITY_ASSESSED"
  );
  const eventImpactSignal = signalCoreOutput.data.signals.find(
    (signal) => signal.type === "EVENT_IMPACT_ASSESSED"
  );
  const reliabilityStatus = reliabilitySignal === undefined
    ? undefined
    : getSignalDetail(reliabilitySignal, "reliability_status");
  const eventImpactLevel = eventImpactSignal === undefined
    ? undefined
    : getSignalDetail(eventImpactSignal, "impact_level");

  if (isMarketReliabilityLevel(reliabilityStatus)) {
    input.odds_reliability_status = reliabilityStatus;
  }
  if (isEventPressureLevel(eventImpactLevel)) {
    input.event_impact_level = eventImpactLevel;
  }

  return input;
}

function buildMarketReliabilityLevel(
  input: ProductAgentV1BuildInput
): ProductAgentV1DecisionContext["market_reliability_level"] {
  if (input.odds_reliability_status !== undefined) return input.odds_reliability_status;

  const reliabilitySignal = input.signals.find((signal) => signal.type === "ODDS_RELIABILITY_ASSESSED");
  const signalStatus = reliabilitySignal === undefined
    ? undefined
    : getSignalDetail(reliabilitySignal, "reliability_status");
  if (typeof signalStatus === "string" && marketReliabilityLevels.has(
    signalStatus as ProductAgentV1DecisionContext["market_reliability_level"]
  )) {
    return signalStatus as ProductAgentV1DecisionContext["market_reliability_level"];
  }

  if (!input.summary.has_odds) return "unavailable";
  return input.signals.some((signal) => signal.type === "ODDS_MISSING") ? "limited" : "available";
}

function buildEventPressureLevel(
  input: ProductAgentV1BuildInput
): ProductAgentV1DecisionContext["event_pressure_level"] {
  if (input.event_impact_level !== undefined) return input.event_impact_level;

  const eventSignal = input.signals.find((signal) => signal.type === "EVENT_IMPACT_ASSESSED") ??
    input.signals.find((signal) => signal.type === "PRESSURE_HINT_AVAILABLE");
  const level = eventSignal === undefined
    ? undefined
    : getSignalDetail(eventSignal, eventSignal.type === "EVENT_IMPACT_ASSESSED" ? "impact_level" : "pressure_level");
  if (typeof level === "string" && eventPressureLevels.has(
    level as ProductAgentV1DecisionContext["event_pressure_level"]
  )) {
    return level as ProductAgentV1DecisionContext["event_pressure_level"];
  }

  return "none";
}

function buildDecisionContext(input: {
  source: ProductAgentV1BuildInput;
  status: ProductAgentV1Status;
  dataQuality: ProductAgentV1Insight["data_quality"];
  freshness: ProductAgentV1Insight["freshness"];
  displayReady: boolean;
}): ProductAgentV1DecisionContext {
  const market_reliability_level = buildMarketReliabilityLevel(input.source);
  const event_pressure_level = buildEventPressureLevel(input.source);
  const hasCritical = input.source.signals.some((signal) => signal.severity === "critical");
  const hasWarning = input.source.signals.some((signal) => signal.severity === "warning");
  const readiness_level = input.status === "empty" || !input.displayReady
    ? "not_ready"
    : input.dataQuality.level !== "complete" || input.freshness.freshness_label === "stale" ||
        market_reliability_level !== "available" || event_pressure_level === "high"
      ? "limited"
      : "ready";
  const attention_level = input.status === "empty" || input.freshness.freshness_label === "stale" ||
      hasCritical || event_pressure_level === "high"
    ? "high"
    : input.dataQuality.level === "partial" || hasWarning || market_reliability_level === "limited" ||
        event_pressure_level === "medium"
      ? "medium"
      : input.source.signals.some((signal) => signal.severity === "info") || event_pressure_level === "low"
        ? "low"
        : "none";
  const limitations: string[] = [];

  if (!input.source.summary.has_fixture) limitations.push("Missing fixture.");
  if (!input.source.summary.has_scoreboard) limitations.push("Missing scoreboard.");
  if (!input.source.summary.has_odds) limitations.push("Missing odds.");
  if (input.freshness.freshness_label === "stale") limitations.push("Stale data.");
  if (market_reliability_level === "limited") limitations.push("Limited odds coverage.");
  if (event_pressure_level === "none") {
    limitations.push("Event impact is unavailable.");
    limitations.push("No live event source is connected.");
  } else {
    limitations.push("Event impact is based on stored events only.");
  }

  const operator_guidance: string[] = [];
  if (readiness_level === "not_ready") {
    operator_guidance.push("Suppress the match intelligence card until required data is available.");
  } else if (readiness_level === "limited") {
    operator_guidance.push("Display with data limitations.");
  } else {
    operator_guidance.push("Use the standard match intelligence card.");
  }
  if (input.freshness.freshness_label === "stale") {
    operator_guidance.push("Highlight the stale data warning.");
  }
  if (market_reliability_level !== "available") {
    operator_guidance.push("Show the odds coverage limitation.");
  }
  if (event_pressure_level === "high") {
    operator_guidance.push("Highlight the stored-event impact notice with its data limitation.");
  }

  return {
    attention_level,
    readiness_level,
    market_reliability_level,
    event_pressure_level,
    operator_guidance,
    limitations: Array.from(new Set(limitations))
  };
}

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
  const displayReady = input.summary.status !== "empty" &&
    input.summary.has_fixture &&
    (input.summary.has_scoreboard || input.summary.has_odds);
  const dataQuality = {
    level: buildDataQualityLevel(input, issues),
    issues
  } as const;
  const insight: ProductAgentV1Insight = {
    agent_version: "product-agent-v1",
    fixture_id: input.fixture_id,
    status,
    headline: buildHeadline(status),
    summary: buildSummary(input, freshness.note),
    readiness: {
      display_ready: displayReady,
      has_fixture: input.summary.has_fixture,
      has_scoreboard: input.summary.has_scoreboard,
      has_odds: input.summary.has_odds,
      is_stale: status === "stale"
    },
    data_quality: dataQuality,
    freshness,
    signal_brief: {
      total: input.summary.signal_count,
      critical: input.summary.critical_count,
      warning: input.summary.warning_count,
      info: input.summary.info_count,
      top_signals: buildTopSignals(input.signals)
    },
    decision_context: buildDecisionContext({
      source: input,
      status,
      dataQuality,
      freshness,
      displayReady
    }),
    user_facing_notes: buildUserFacingNotes(input, freshness.note),
    safe_scope_note: SAFE_SCOPE_NOTE
  };

  assertNoForbiddenSignalFields(insight);
  return insight;
}

export function buildProductAgentV1InsightSummary(
  insight: ProductAgentV1Insight
): ProductAgentV1InsightSummary {
  const summary: ProductAgentV1InsightSummary = {
    agent_version: insight.agent_version,
    status: insight.status,
    quality: insight.data_quality.level,
    freshness: insight.freshness.freshness_label,
    issue_count: insight.data_quality.issues.length,
    issues: [...insight.data_quality.issues],
    top_signal_types: insight.signal_brief.top_signals.map((signal) => signal.type),
    display_ready: insight.readiness.display_ready
  };

  assertNoForbiddenSignalFields(summary);
  return summary;
}

export function buildProductAgentV1(
  signalCoreOutput: SignalCoreV0Response,
  decisionContextInput: Pick<
    ProductAgentV1BuildInput,
    "odds_reliability_status" | "event_impact_level"
  > = {}
): ProductAgentV1Response {
  const insight = buildProductAgentV1Insight({
    fixture_id: signalCoreOutput.data.fixture_id,
    summary: signalCoreOutput.data.summary,
    signals: signalCoreOutput.data.signals,
    state: signalCoreOutput.data.state,
    ...decisionContextInput
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
  options: SignalCoreV0Options = {},
  dependencies: SignalCoreV0Dependencies = {}
): Promise<ProductAgentV1Response> {
  const signalCoreOutput = await getSignalCoreV0ForFixture(fixtureId, {
    ...options,
    includeState: true,
    includeOddsReliability: options.includeOddsReliability !== false,
    includeInternalContext: options.includeEventImpact !== false,
    includeEventImpact: options.includeEventImpact !== false
  }, dependencies);
  return buildProductAgentV1(
    signalCoreOutput,
    extractProductAgentDecisionContextInputFromSignalCore(signalCoreOutput)
  );
}
