import type { Prisma } from "@prisma/client";
import { createTxlineLiveClient } from "@matchpulse/txline-client";
import { getDbClient } from "./db.js";
import {
  hasFiniteGoalScore,
  isRecord,
  normalizeTxlineScore,
  parseFixtureId,
  readFiniteNumber,
  readString,
  selectLatestTxlineScore,
  type NullableScore
} from "./txline-normalizer.js";

export type MatchStateUpsert = {
  where: { fixtureId: string };
  create: Prisma.MatchStateUncheckedCreateInput;
  update: Prisma.MatchStateUncheckedUpdateInput;
};

export type ScoreIngestionResult = {
  fixtureId: string;
  fetchedCount: number;
  selectedSeq: number | null;
  selectedTs: number | null;
  action: string | null;
  scoreAvailable: boolean;
  upserted: boolean;
  matchState: SafeMatchState | null;
};

export type SafeMatchState = {
  fixture_id: string;
  home_score: number | null;
  away_score: number | null;
  phase: string;
  market_mood: string;
  last_data_received_at: string | null;
};

type StoredMatchState = {
  fixtureId: string;
  homeScore: number | null;
  awayScore: number | null;
  phase: string;
  marketMood: string;
  lastDataReceivedAt: Date | null;
};

type IngestTxlineScoreSnapshotInput = {
  fixtureId: string;
  asOf: number;
  includeRaw?: boolean;
  fetchScores?: (params: { fixtureId: string; asOf: number }) => Promise<unknown>;
  readParticipant1IsHome?: (fixtureId: string) => Promise<boolean | null>;
  upsertMatchState?: (upsert: MatchStateUpsert) => Promise<StoredMatchState>;
};

type MapNormalizedScoreInput = {
  fixtureId: string;
  score: NullableScore;
  receivedAt: Date;
  rawScore?: unknown;
  includeRaw?: boolean;
};

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (!isRecord(value)) return undefined;

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return undefined;
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function toDate(epochMs: number): Date | null {
  if (!Number.isSafeInteger(epochMs) || epochMs < 1_000_000_000_000) return null;
  const date = new Date(epochMs);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeWithoutUnsafeOrientation(
  rawScore: unknown,
  participant1IsHome: boolean | null
): NullableScore {
  if (participant1IsHome !== null) {
    return normalizeTxlineScore(rawScore, participant1IsHome);
  }

  const participant1Home = normalizeTxlineScore(rawScore, true);
  const participant2Home = normalizeTxlineScore(rawScore, false);
  return participant1Home.home === participant2Home.home &&
    participant1Home.away === participant2Home.away
    ? participant1Home
    : { home: null, away: null };
}

async function readStoredParticipantOrientation(fixtureId: string): Promise<boolean | null> {
  const fixture = await getDbClient().fixture.findUnique({
    where: { fixtureId },
    select: { raw: true }
  });
  return isRecord(fixture?.raw) && typeof fixture.raw.Participant1IsHome === "boolean"
    ? fixture.raw.Participant1IsHome
    : null;
}

function toSafeMatchState(state: StoredMatchState): SafeMatchState {
  return {
    fixture_id: state.fixtureId,
    home_score: state.homeScore,
    away_score: state.awayScore,
    phase: state.phase,
    market_mood: state.marketMood,
    last_data_received_at: state.lastDataReceivedAt?.toISOString() ?? null
  };
}

export function mapNormalizedScoreToMatchStateUpsert({
  fixtureId,
  score,
  receivedAt,
  rawScore,
  includeRaw = false
}: MapNormalizedScoreInput): MatchStateUpsert {
  const raw = includeRaw ? safeJson(rawScore) : undefined;
  const values = {
    fixtureId,
    minute: null,
    phase: "unknown",
    homeScore: score.home,
    awayScore: score.away,
    marketMood: "unknown",
    momentumSide: "unknown",
    momentumScore: null,
    lastDataReceivedAt: receivedAt,
    ...(raw === undefined ? {} : { rawScore: raw })
  };

  return {
    where: { fixtureId },
    create: values,
    update: values
  };
}

export async function ingestTxlineScoreSnapshot({
  fixtureId,
  asOf,
  includeRaw = false,
  fetchScores = (params) => createTxlineLiveClient().getScoreSnapshot(params),
  readParticipant1IsHome = readStoredParticipantOrientation,
  upsertMatchState = (upsert) => getDbClient().matchState.upsert({
    ...upsert,
    select: {
      fixtureId: true,
      homeScore: true,
      awayScore: true,
      phase: true,
      marketMood: true,
      lastDataReceivedAt: true
    }
  })
}: IngestTxlineScoreSnapshotInput): Promise<ScoreIngestionResult> {
  const parsedFixtureId = parseFixtureId(fixtureId);
  const asOfDate = toDate(asOf);
  if (parsedFixtureId === null || asOfDate === null) {
    return {
      fixtureId: typeof fixtureId === "string" ? fixtureId : "",
      fetchedCount: 0,
      selectedSeq: null,
      selectedTs: null,
      action: null,
      scoreAvailable: false,
      upserted: false,
      matchState: null
    };
  }

  const snapshot = await fetchScores({ fixtureId: parsedFixtureId, asOf });
  const fetchedCount = Array.isArray(snapshot) ? snapshot.length : 0;
  const selected = selectLatestTxlineScore(snapshot, parsedFixtureId);
  if (!isRecord(selected)) {
    return {
      fixtureId: parsedFixtureId,
      fetchedCount,
      selectedSeq: null,
      selectedTs: null,
      action: null,
      scoreAvailable: false,
      upserted: false,
      matchState: null
    };
  }

  const selectedSeq = readFiniteNumber(selected.Seq);
  const selectedTs = readFiniteNumber(selected.Ts);
  const action = readString(selected.Action);
  const embeddedOrientation = typeof selected.Participant1IsHome === "boolean"
    ? selected.Participant1IsHome
    : null;
  let participant1IsHome = embeddedOrientation;
  if (participant1IsHome === null) {
    try {
      participant1IsHome = await readParticipant1IsHome(parsedFixtureId);
    } catch {
      participant1IsHome = null;
    }
  }
  const score = normalizeWithoutUnsafeOrientation(selected, participant1IsHome);
  const receivedAt = (selectedTs === null ? null : toDate(selectedTs)) ?? asOfDate;
  const upsert = mapNormalizedScoreToMatchStateUpsert({
    fixtureId: parsedFixtureId,
    score,
    receivedAt,
    rawScore: selected,
    includeRaw
  });
  const stored = await upsertMatchState(upsert);

  return {
    fixtureId: parsedFixtureId,
    fetchedCount,
    selectedSeq,
    selectedTs,
    action,
    scoreAvailable: hasFiniteGoalScore(score),
    upserted: true,
    matchState: toSafeMatchState(stored)
  };
}

export function summarizeScoreIngestion(result: ScoreIngestionResult) {
  return {
    fetched_count: result.fetchedCount,
    selected_seq: result.selectedSeq,
    selected_ts: result.selectedTs,
    action: result.action,
    score_available: result.scoreAvailable,
    upserted: result.upserted
  };
}
