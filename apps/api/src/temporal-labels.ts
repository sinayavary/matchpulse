import { buildPredictionSnapshotLabels, type FinalPredictionSnapshot, type PredictionSnapshotLabels } from "./final-prediction-domain.js";
import type { TimelineEvent } from "./timeline-reducer.js";

export type TemporalLabelInput = { snapshot: FinalPredictionSnapshot; finalized_at: string | null; final_home_score: number | null; final_away_score: number | null; timeline: readonly TimelineEvent[]; labeled_at?: string };

function iso(value: string, name: string): string { const time = Date.parse(value); if (!Number.isFinite(time)) throw new TypeError(`${name} must be an ISO timestamp.`); return new Date(time).toISOString(); }
function finalOutcome(home: number | null, away: number | null): "home" | "draw" | "away" | null { if (home === null || away === null) return null; return home > away ? "home" : away > home ? "away" : "draw"; }

export function buildTemporalLabels(input: TemporalLabelInput): PredictionSnapshotLabels {
  const snapshot = input.snapshot; const asOf = iso(snapshot.identity.as_of, "as_of"); const labeledAt = iso(input.labeled_at ?? input.finalized_at ?? asOf, "labeled_at");
  const limitations: string[] = []; const finalized = input.finalized_at === null ? null : iso(input.finalized_at, "finalized_at");
  if (finalized !== null && (Date.parse(finalized) < Date.parse(asOf) || Date.parse(finalized) > Date.parse(labeledAt))) limitations.push("Finalization timestamp is outside the label window.");
  const relevant = input.timeline.filter((event) => event.fixture_id === snapshot.identity.fixture_id && Date.parse(event.provider_timestamp) >= Date.parse(asOf) && (finalized === null || Date.parse(event.provider_timestamp) <= Date.parse(finalized))).sort((left, right) => Date.parse(left.provider_timestamp) - Date.parse(right.provider_timestamp) || left.sequence - right.sequence || left.event_id.localeCompare(right.event_id));
  const nonMonotonic = relevant.some((event, index) => index > 0 && event.sequence <= relevant[index - 1]!.sequence);
  if (nonMonotonic) limitations.push("Timeline sequence is not strictly increasing.");
  const goals = relevant.filter((event) => event.event_type === "goal" || event.event_type === "score_change");
  const firstGoal = goals[0] ?? null;
  const nextGoalSide = firstGoal === null ? finalized === null ? null : "none" : firstGoal.payload !== null && typeof firstGoal.payload === "object" && "team_side" in firstGoal.payload && ["home", "away"].includes(String((firstGoal.payload as { team_side?: unknown }).team_side)) ? String((firstGoal.payload as { team_side: string }).team_side) as "home" | "away" : null;
  const goalAt = firstGoal === null ? null : Date.parse(firstGoal.provider_timestamp);
  const horizon = (minutes: number): boolean | null => goalAt === null ? finalized === null ? null : false : goalAt <= Date.parse(asOf) + minutes * 60_000;
  const currentHome = snapshot.match_context.home_score; const currentAway = snapshot.match_context.away_score;
  const survival = currentHome === null || currentAway === null || input.final_home_score === null || input.final_away_score === null ? "not_applicable" as const : currentHome === input.final_home_score && currentAway === input.final_away_score ? "held" as const : "changed" as const;
  const complete = finalized !== null && input.final_home_score !== null && input.final_away_score !== null && nextGoalSide !== null && !nonMonotonic && limitations.length === 0;
  const status = limitations.length > 0 ? "invalid" as const : complete ? "complete" as const : "partial" as const;
  return buildPredictionSnapshotLabels({ snapshot_id: snapshot.identity.snapshot_id, fixture_id: snapshot.identity.fixture_id, as_of: asOf, labeled_at: labeledAt, status, final_outcome: finalOutcome(input.final_home_score, input.final_away_score), next_goal_side: nextGoalSide, goal_in_next_5m: horizon(5), goal_in_next_10m: horizon(10), goal_in_next_15m: horizon(15), final_home_score: input.final_home_score, final_away_score: input.final_away_score, current_result_survival: survival, momentum_shift: "unavailable", source_finalized_at: finalized, limitations });
}
