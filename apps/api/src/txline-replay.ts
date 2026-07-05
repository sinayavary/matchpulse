import {
  hasFiniteGoalScore,
  isRecord,
  normalizeTxlineScore,
  parseFixtureId,
  readFiniteNumber,
  readString,
  type NullableScore
} from "./txline-normalizer.js";

export type TxlineReplayEvent = {
  seq: number | null;
  ts: number | null;
  action: string | null;
  clock_seconds: number | null;
  score: NullableScore;
  score_changed: boolean;
  note: string;
  debug?: {
    raw: unknown;
  };
};

export type TxlineReplaySummary = {
  first_seq: number | null;
  last_seq: number | null;
  final_score: NullableScore;
  score_change_events: number;
  actions_seen: string[];
};

export type TxlineReplayBuildOptions = {
  fixtureId?: unknown;
  participant1IsHome?: unknown;
  includeRaw?: boolean;
};

function compareFiniteNumbers(left: number | null, right: number | null) {
  if (left !== null && right !== null) return left - right;
  if (left !== null) return -1;
  if (right !== null) return 1;
  return 0;
}

function readClockSeconds(record: Record<string, unknown>) {
  const directClockSeconds = readFiniteNumber(record.ClockSeconds);
  if (directClockSeconds !== null) return directClockSeconds;

  if (isRecord(record.Clock)) {
    return readFiniteNumber(record.Clock.Seconds);
  }

  return null;
}

function replayNote(score: NullableScore, hasScorePayload: boolean) {
  if (!hasScorePayload) return "score_missing";
  if (!hasFiniteGoalScore(score)) return "score_snapshot_without_goals";
  return "goal_score_available";
}

export function getScoreFromRecord(
  rawScoreRecord: unknown,
  participant1IsHome: unknown
): NullableScore {
  return normalizeTxlineScore(rawScoreRecord, participant1IsHome);
}

export function detectScoreChange(
  previousScore: NullableScore,
  currentScore: NullableScore
) {
  const homeChanged = Number.isFinite(currentScore.home) && currentScore.home !== previousScore.home;
  const awayChanged = Number.isFinite(currentScore.away) && currentScore.away !== previousScore.away;
  return homeChanged || awayChanged;
}

export function normalizeReplayEvent(
  rawScoreRecord: unknown,
  options: Pick<TxlineReplayBuildOptions, "participant1IsHome" | "includeRaw"> = {}
): TxlineReplayEvent | null {
  if (!isRecord(rawScoreRecord)) return null;

  const score = getScoreFromRecord(rawScoreRecord, options.participant1IsHome);
  const hasScorePayload = Object.prototype.hasOwnProperty.call(rawScoreRecord, "Score");

  return {
    seq: readFiniteNumber(rawScoreRecord.Seq),
    ts: readFiniteNumber(rawScoreRecord.Ts),
    action: readString(rawScoreRecord.Action),
    clock_seconds: readClockSeconds(rawScoreRecord),
    score,
    score_changed: false,
    note: replayNote(score, hasScorePayload),
    ...(options.includeRaw ? { debug: { raw: rawScoreRecord } } : {})
  };
}

export function buildTxlineReplayTimeline(
  rawScores: unknown,
  options: TxlineReplayBuildOptions = {}
) {
  if (!Array.isArray(rawScores)) return [];

  const requestedFixtureId = options.fixtureId === undefined
    ? undefined
    : parseFixtureId(options.fixtureId);

  const sortedRecords = rawScores
    .flatMap((candidate, index) => {
      if (!isRecord(candidate)) return [];
      const candidateFixtureId = parseFixtureId(candidate.FixtureId);
      if (
        requestedFixtureId !== undefined &&
        (candidateFixtureId === null || candidateFixtureId !== requestedFixtureId)
      ) return [];
      return [{ candidate, index }];
    })
    .sort((left, right) => {
      const seqOrder = compareFiniteNumbers(
        readFiniteNumber(left.candidate.Seq),
        readFiniteNumber(right.candidate.Seq)
      );
      if (seqOrder !== 0) return seqOrder;

      const tsOrder = compareFiniteNumbers(
        readFiniteNumber(left.candidate.Ts),
        readFiniteNumber(right.candidate.Ts)
      );
      if (tsOrder !== 0) return tsOrder;

      return left.index - right.index;
    });

  const timeline: TxlineReplayEvent[] = [];
  let previousScore: NullableScore = { home: null, away: null };

  for (const { candidate } of sortedRecords) {
    const event = normalizeReplayEvent(candidate, options);
    if (event === null) continue;

    const scoreChanged = detectScoreChange(previousScore, event.score);
    timeline.push({
      ...event,
      score_changed: scoreChanged
    });

    previousScore = {
      home: Number.isFinite(event.score.home) ? event.score.home : previousScore.home,
      away: Number.isFinite(event.score.away) ? event.score.away : previousScore.away
    };
  }

  return timeline;
}

export function buildTxlineReplaySummary(
  timeline: readonly TxlineReplayEvent[]
): TxlineReplaySummary {
  const actionsSeen: string[] = [];
  const seenActions = new Set<string>();
  let firstSeq: number | null = null;
  let lastSeq: number | null = null;
  let scoreChangeEvents = 0;
  let finalScore: NullableScore = { home: null, away: null };

  for (const event of timeline) {
    if (firstSeq === null && Number.isFinite(event.seq)) firstSeq = event.seq;
    if (Number.isFinite(event.seq)) lastSeq = event.seq;
    if (event.score_changed) scoreChangeEvents += 1;

    if (event.action !== null && !seenActions.has(event.action)) {
      seenActions.add(event.action);
      actionsSeen.push(event.action);
    }

    if (Number.isFinite(event.score.home)) finalScore.home = event.score.home;
    if (Number.isFinite(event.score.away)) finalScore.away = event.score.away;
  }

  return {
    first_seq: firstSeq,
    last_seq: lastSeq,
    final_score: finalScore,
    score_change_events: scoreChangeEvents,
    actions_seen: actionsSeen
  };
}
