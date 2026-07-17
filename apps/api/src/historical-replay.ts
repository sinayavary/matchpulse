import type { FastifyInstance } from "fastify";
import { getDbClient } from "./db.js";

export type ReplayPoint = {
  as_of: string;
  minute: number | null;
  phase: string | null;
  score: { home: number | null; away: number | null };
  odds: Array<{ market_id: string; selection_name: string; odds: number; source_timestamp: string | null }>;
  probabilities: { home: number; draw: number; away: number } | null;
  next_goal: { home: number; none: number; away: number } | null;
  momentum: { home: number; neutral: number; away: number } | null;
  confidence: { level: string; score: number } | null;
  risk: string | null;
  events: Array<{ event_type: string; title: string; minute: number | null; team_side: string; source_timestamp: string | null }>;
};

const safeTime = (value: unknown) => value instanceof Date ? value : new Date(String(value));

export async function buildPersistedReplay(fixtureId: string, selectedTime = new Date()): Promise<{ status: "ok" | "no_data"; fixture: unknown; coverage: { start: string | null; end: string | null }; timeline: ReplayPoint[]; gaps: string[]; source: string; model_version: string | null }> {
  const db = getDbClient();
  const fixture = await db.fixture.findUnique({ where: { fixtureId }, select: { fixtureId: true, competition: true, homeTeam: true, awayTeam: true, startTimeUtc: true, status: true } });
  if (!fixture) return { status: "no_data", fixture: null, coverage: { start: null, end: null }, timeline: [], gaps: ["fixture_not_persisted"], source: "postgresql", model_version: null };
  const [odds, events, snapshots, state] = await Promise.all([
    db.oddsSnapshot.findMany({ where: { fixtureId, sourceTimestamp: { lte: selectedTime } }, orderBy: { sourceTimestamp: "asc" }, select: { marketId: true, selectionName: true, odds: true, sourceTimestamp: true } }),
    db.matchEvent.findMany({ where: { fixtureId, sourceTimestamp: { lte: selectedTime } }, orderBy: { sourceTimestamp: "asc" }, select: { eventType: true, title: true, eventMinute: true, teamSide: true, sourceTimestamp: true } }),
    db.predictionSnapshotRecord.findMany({ where: { fixtureId, asOf: { lte: selectedTime } }, orderBy: { asOf: "asc" }, select: { asOf: true, normalizedPhase: true, minute: true, homeScore: true, awayScore: true, finalOutcomeHome: true, finalOutcomeDraw: true, finalOutcomeAway: true, nextGoalHome: true, nextGoalNone: true, nextGoalAway: true, momentumHomeStrengthens: true, momentumNeutral: true, momentumAwayStrengthens: true, confidenceLevel: true, confidenceScore: true, riskLevel: true, inferenceEngineVersion: true } }),
    db.matchState.findUnique({ where: { fixtureId }, select: { homeScore: true, awayScore: true, minute: true, phase: true, updatedAt: true } })
  ]);
  const times = [...odds.map((row) => row.sourceTimestamp), ...events.map((row) => row.sourceTimestamp), ...snapshots.map((row) => row.asOf)].filter((value): value is Date => value instanceof Date && value.getTime() <= selectedTime.getTime());
  if (state && state.updatedAt.getTime() <= selectedTime.getTime()) times.push(state.updatedAt);
  const uniqueTimes = [...new Set(times.map((time) => time.toISOString()))].sort();
  const timeline = uniqueTimes.map((asOf): ReplayPoint => {
    const at = new Date(asOf);
    const prediction = [...snapshots].reverse().find((row) => row.asOf.getTime() <= at.getTime());
    const pointOdds = odds.filter((row) => row.sourceTimestamp && row.sourceTimestamp.getTime() <= at.getTime()).slice(-50);
    const pointEvents = events.filter((row) => row.sourceTimestamp && row.sourceTimestamp.getTime() <= at.getTime()).map((row) => ({ event_type: row.eventType, title: row.title, minute: row.eventMinute, team_side: row.teamSide, source_timestamp: row.sourceTimestamp?.toISOString() ?? null }));
    const score = prediction ? { home: prediction.homeScore, away: prediction.awayScore } : state && state.updatedAt.getTime() <= at.getTime() ? { home: state.homeScore, away: state.awayScore } : { home: null, away: null };
    return { as_of: asOf, minute: prediction?.minute ?? (state && state.updatedAt.getTime() <= at.getTime() ? state.minute : null), phase: prediction?.normalizedPhase ?? (state && state.updatedAt.getTime() <= at.getTime() ? state.phase : null), score, odds: pointOdds.map((row) => ({ market_id: row.marketId, selection_name: row.selectionName, odds: row.odds.toNumber(), source_timestamp: row.sourceTimestamp?.toISOString() ?? null })), probabilities: prediction ? { home: prediction.finalOutcomeHome, draw: prediction.finalOutcomeDraw, away: prediction.finalOutcomeAway } : null, next_goal: prediction ? { home: prediction.nextGoalHome, none: prediction.nextGoalNone, away: prediction.nextGoalAway } : null, momentum: prediction ? { home: prediction.momentumHomeStrengthens, neutral: prediction.momentumNeutral, away: prediction.momentumAwayStrengthens } : null, confidence: prediction ? { level: prediction.confidenceLevel, score: prediction.confidenceScore } : null, risk: prediction?.riskLevel ?? null, events: pointEvents };
  });
  return { status: timeline.length > 0 ? "ok" : "no_data", fixture: { fixture_id: fixture.fixtureId, competition: fixture.competition, home_team: fixture.homeTeam, away_team: fixture.awayTeam, start_time_utc: fixture.startTimeUtc?.toISOString() ?? null, status: fixture.status }, coverage: { start: timeline[0]?.as_of ?? null, end: timeline.at(-1)?.as_of ?? null }, timeline, gaps: timeline.length === 0 ? ["no_persisted_timeline"] : [], source: "postgresql", model_version: snapshots.at(-1)?.inferenceEngineVersion ?? null };
}

export function registerHistoricalReplayRoute(app: FastifyInstance) {
  app.get("/api/public/matches/:fixtureId/replay", async (request) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const raw = (request.query as { selectedTime?: string }).selectedTime;
    const selectedTime = raw ? new Date(raw) : new Date();
    const data = await buildPersistedReplay(fixtureId, Number.isFinite(selectedTime.getTime()) ? selectedTime : new Date());
    return { data, meta: { status: data.status === "ok" ? "live" as const : "no_data" as const, source: "database" as const, mode: "public" as const } };
  });
}
