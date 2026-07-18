export const MATCH_LIFECYCLES = [
  "scheduled",
  "prematch",
  "live_first_half",
  "halftime",
  "live_second_half",
  "extra_time",
  "penalties",
  "finished",
  "postponed",
  "cancelled",
  "abandoned",
  "unknown_in_progress",
  "finished_unconfirmed"
] as const;

export type MatchLifecycle = typeof MATCH_LIFECYCLES[number];
export type LifecycleSource = "provider_terminal" | "provider_live" | "persisted_phase" | "score_event" | "kickoff_heuristic" | "missing_evidence";
export type LifecycleConfidence = "high" | "medium" | "low";

export type MatchLifecycleInput = {
  providerStatus?: string | null;
  persistedPhase?: string | null;
  startTimeUtc?: Date | string | null;
  now?: Date;
  captureLeadMinutes?: number;
  captureTailMinutes?: number;
  hasScoreOrEventEvidence?: boolean;
};

export type MatchLifecycleResult = {
  lifecycle: MatchLifecycle;
  source: LifecycleSource;
  confidence: LifecycleConfidence;
  reason_code: string;
  provider_status: string | null;
  normalized_phase: string | null;
  is_active: boolean;
  is_terminal: boolean;
  updated_at: string;
};

const TERMINAL: Record<string, MatchLifecycle> = {
  finished: "finished", final: "finished", ft: "finished", fulltime: "finished", completed: "finished", ended: "finished",
  postponed: "postponed", delayed: "postponed",
  cancelled: "cancelled", canceled: "cancelled",
  abandoned: "abandoned", suspended: "abandoned", interrupted: "abandoned"
};

const LIVE: Record<string, MatchLifecycle> = {
  live: "live_first_half", "1h": "live_first_half", first_half: "live_first_half", firsthalf: "live_first_half", inplay: "live_first_half", in_running: "live_first_half", running: "live_first_half",
  ht: "halftime", halftime: "halftime", half_time: "halftime",
  "2h": "live_second_half", second_half: "live_second_half", secondhalf: "live_second_half",
  et: "extra_time", extra_time: "extra_time", extratime: "extra_time",
  pen: "penalties", penalties: "penalties", penalty: "penalties"
};

const PHASE_ALIASES: Record<string, MatchLifecycle> = {
  ...LIVE,
  ...TERMINAL,
  scheduled: "scheduled", prematch: "prematch", pre_match: "prematch",
  unknown_in_progress: "unknown_in_progress", finished_unconfirmed: "finished_unconfirmed"
};

function token(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function buildResult(input: MatchLifecycleInput, lifecycle: MatchLifecycle, source: LifecycleSource, confidence: LifecycleConfidence, reason_code: string, normalized_phase: string | null): MatchLifecycleResult {
  const isTerminal = lifecycle === "finished" || lifecycle === "postponed" || lifecycle === "cancelled" || lifecycle === "abandoned" || lifecycle === "finished_unconfirmed";
  return {
    lifecycle,
    source,
    confidence,
    reason_code,
    provider_status: input.providerStatus?.trim() || null,
    normalized_phase,
    is_active: lifecycle === "prematch" || lifecycle === "live_first_half" || lifecycle === "halftime" || lifecycle === "live_second_half" || lifecycle === "extra_time" || lifecycle === "penalties" || lifecycle === "unknown_in_progress" || lifecycle === "finished_unconfirmed",
    is_terminal: isTerminal,
    updated_at: (input.now ?? new Date()).toISOString()
  };
}

export function resolveMatchLifecycle(input: MatchLifecycleInput = {}): MatchLifecycleResult {
  const provider = token(input.providerStatus);
  const phase = token(input.persistedPhase);
  const now = input.now ?? new Date();

  if (provider && TERMINAL[provider]) return buildResult(input, TERMINAL[provider], "provider_terminal", "high", `provider_terminal_${provider}`, phase || null);
  if (provider && LIVE[provider]) return buildResult(input, LIVE[provider], "provider_live", "high", `provider_live_${provider}`, phase || null);

  if (phase && PHASE_ALIASES[phase]) {
    const lifecycle = PHASE_ALIASES[phase];
    return buildResult(input, lifecycle, "persisted_phase", lifecycle === "unknown_in_progress" ? "low" : "medium", `persisted_phase_${phase}`, phase);
  }

  const start = asDate(input.startTimeUtc);
  if (start === null) return buildResult(input, "unknown_in_progress", "missing_evidence", "low", "missing_start_time", phase || null);
  const leadMinutes = Math.max(0, Number.isFinite(input.captureLeadMinutes) ? Math.trunc(input.captureLeadMinutes as number) : 60);
  const minutesUntilKickoff = (start.getTime() - now.getTime()) / 60_000;
  if (minutesUntilKickoff > leadMinutes) return buildResult(input, "scheduled", "kickoff_heuristic", "medium", "kickoff_outside_capture_window", phase || null);
  if (minutesUntilKickoff > 0) return buildResult(input, "prematch", "kickoff_heuristic", "medium", "capture_window_open", phase || null);

  const tail = Math.max(0, Number.isFinite(input.captureTailMinutes) ? Math.trunc(input.captureTailMinutes as number) : 180);
  const ageMinutes = (now.getTime() - start.getTime()) / 60_000;
  if (ageMinutes <= tail) return buildResult(input, "unknown_in_progress", "kickoff_heuristic", "low", "past_kickoff_without_terminal_status", phase || null);
  return buildResult(input, "finished_unconfirmed", "kickoff_heuristic", "low", "capture_tail_expired_without_terminal_status", phase || null);
}

export function lifecycleIsUpcoming(result: { lifecycle: MatchLifecycle }): boolean {
  return result.lifecycle === "scheduled" || result.lifecycle === "prematch";
}

export function lifecycleIsLive(result: { lifecycle: MatchLifecycle }): boolean {
  return result.lifecycle === "live_first_half" || result.lifecycle === "halftime" || result.lifecycle === "live_second_half" || result.lifecycle === "extra_time" || result.lifecycle === "penalties" || result.lifecycle === "unknown_in_progress";
}

export function lifecycleIsRecentlyFinished(result: { lifecycle: MatchLifecycle }): boolean {
  return result.lifecycle === "finished" || result.lifecycle === "finished_unconfirmed";
}
