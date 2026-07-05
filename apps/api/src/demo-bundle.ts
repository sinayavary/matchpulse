import type { CanonicalMatchState } from "./match-state-builder.js";
import {
  getAgentPresenterBriefForFixture,
  type AgentPresenterBrief,
  type AgentPresenterResponse,
  type AgentPresenterSignal
} from "./agent-presenter-v0.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import type { SignalCoreV0Summary } from "./signalcore-v0.js";

export type DemoBundleOptions = {
  includeState?: boolean;
  includeSignals?: boolean;
  includeBrief?: boolean;
  oddsLimit?: number;
  staleAfterMinutes?: number;
  format?: "compact" | "full";
};

export type NormalizedDemoBundleOptions = Required<DemoBundleOptions>;

export type DemoReadinessIssue =
  | "fixture_missing"
  | "scoreboard_missing"
  | "odds_missing"
  | "state_missing"
  | "brief_missing"
  | "signals_missing"
  | "data_stale"
  | "identity_incomplete"
  | "no_persisted_data";

export type DemoReadiness = {
  status: "ready" | "partial" | "empty";
  display_ready: boolean;
  has_state: boolean;
  has_brief: boolean;
  has_signals: boolean;
  has_fixture: boolean;
  has_scoreboard: boolean;
  has_odds: boolean;
  issue_count: number;
  issues: DemoReadinessIssue[];
};

export type DemoBundleResponse = {
  data: {
    fixture_id: string;
    demo_version: "bundle-v0";
    readiness: DemoReadiness;
    brief: AgentPresenterBrief | null;
    signal_summary: SignalCoreV0Summary | null;
    signals: AgentPresenterSignal[];
    state: CanonicalMatchState | null;
  };
  meta: {
    status: "live" | "degraded" | "no_data";
    source: "demo-bundle";
    mode: "internal";
  };
};

export function normalizeDemoBundleOptions(
  options: DemoBundleOptions = {}
): NormalizedDemoBundleOptions {
  const oddsLimit = typeof options.oddsLimit === "number" && Number.isFinite(options.oddsLimit)
    ? Math.trunc(options.oddsLimit)
    : 20;
  const staleAfterMinutes =
    typeof options.staleAfterMinutes === "number" && Number.isFinite(options.staleAfterMinutes)
      ? Math.trunc(options.staleAfterMinutes)
      : 180;

  return {
    includeState: options.includeState !== false,
    includeSignals: options.includeSignals !== false,
    includeBrief: options.includeBrief !== false,
    oddsLimit: Math.min(50, Math.max(1, oddsLimit)),
    staleAfterMinutes: Math.min(10080, Math.max(1, staleAfterMinutes)),
    format: options.format === "compact" ? "compact" : "full"
  };
}

export function sanitizeDemoSignals(
  signals: AgentPresenterSignal[]
): AgentPresenterSignal[] {
  return signals.map(({ type, severity, title, message }) => ({
    type,
    severity,
    title,
    message
  }));
}

export function buildDemoReadiness(
  output: AgentPresenterResponse,
  options: DemoBundleOptions = {}
): DemoReadiness {
  const normalized = normalizeDemoBundleOptions(options);
  const { data } = output;
  const summary = data.signal_summary;
  const hasState = data.state !== undefined;
  const hasBrief = normalized.includeBrief;
  const hasSignals = normalized.includeSignals;
  const issues: DemoReadinessIssue[] = [];

  if (!summary.has_fixture) issues.push("fixture_missing");
  if (!summary.has_scoreboard) issues.push("scoreboard_missing");
  if (!summary.has_odds) issues.push("odds_missing");
  if (!hasState) issues.push("state_missing");
  if (!hasBrief) issues.push("brief_missing");
  if (!hasSignals) issues.push("signals_missing");
  if (data.signals.some((signal) => signal.type === "DATA_STALE")) issues.push("data_stale");
  if (data.signals.some((signal) => signal.type === "IDENTITY_INCOMPLETE")) {
    issues.push("identity_incomplete");
  }
  if (summary.status === "empty") issues.push("no_persisted_data");

  return {
    status: data.brief.status_label,
    display_ready:
      data.brief.status_label !== "empty" && hasBrief && hasSignals,
    has_state: hasState,
    has_brief: hasBrief,
    has_signals: hasSignals,
    has_fixture: summary.has_fixture,
    has_scoreboard: summary.has_scoreboard,
    has_odds: summary.has_odds,
    issue_count: issues.length,
    issues
  };
}

export function buildDemoBundle(input: {
  agentPresenterOutput: AgentPresenterResponse;
  options?: DemoBundleOptions;
}): DemoBundleResponse {
  const normalized = normalizeDemoBundleOptions(input.options);
  const output = input.agentPresenterOutput;
  const readiness = buildDemoReadiness(output, normalized);
  const status = readiness.status === "ready"
    ? "live" as const
    : readiness.status === "partial" ? "degraded" as const : "no_data" as const;

  const bundle: DemoBundleResponse = {
    data: {
      fixture_id: output.data.fixture_id,
      demo_version: "bundle-v0",
      readiness,
      brief: normalized.includeBrief ? output.data.brief : null,
      signal_summary: normalized.includeSignals ? output.data.signal_summary : null,
      signals: normalized.includeSignals ? sanitizeDemoSignals(output.data.signals) : [],
      state: normalized.includeState ? output.data.state ?? null : null
    },
    meta: {
      status,
      source: "demo-bundle",
      mode: "internal"
    }
  };

  assertNoForbiddenSignalFields(bundle);
  return bundle;
}

export async function getDemoBundleForFixture(
  fixtureId: string,
  options: DemoBundleOptions = {}
): Promise<DemoBundleResponse> {
  const normalized = normalizeDemoBundleOptions(options);
  const agentPresenterOutput = await getAgentPresenterBriefForFixture(fixtureId, {
    includeState: true,
    oddsLimit: normalized.oddsLimit,
    staleAfterMinutes: normalized.staleAfterMinutes,
    format: normalized.format
  });

  return buildDemoBundle({ agentPresenterOutput, options: normalized });
}
