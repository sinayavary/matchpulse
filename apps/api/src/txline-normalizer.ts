export type NullableScore = {
  home: number | null;
  away: number | null;
};

export type InternalPreviewDebug = {
  raw?: unknown;
};

export type NormalizedTxlineFixturePreview = {
  fixture_id: string;
  competition: string;
  stage: string | null;
  start_time_utc: string | null;
  home_team: string;
  away_team: string;
  status: "UNKNOWN";
  is_live: boolean | null;
  score: NullableScore;
  has_odds: boolean | null;
  latest_signal_type: null;
  market_mood: "unknown";
  minute: number | null;
  phase: "unknown";
  raw_game_state: unknown | null;
  last_event: null;
  momentum: null;
  debug?: InternalPreviewDebug;
};

export type NormalizedTxlineMatchPreview = NormalizedTxlineFixturePreview;

export type TxlineNormalizerOptions = {
  includeRaw?: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readNonNegativeFiniteNumber(value: unknown): number | null {
  const number = readFiniteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

export function parseFixtureId(value: unknown): string | null {
  const stringId = readString(value);
  if (stringId !== null) return stringId;
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? String(value)
    : null;
}

export function parseEpochMsToIso(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.trim().length === 0 || !Number.isFinite(Date.parse(value))) return null;
    return new Date(value).toISOString();
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1_000_000_000_000
  ) return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function participantNames(fixture: Record<string, unknown>) {
  const participant1 = readString(fixture.Participant1) ?? "unknown";
  const participant2 = readString(fixture.Participant2) ?? "unknown";
  const orientation = fixture.Participant1IsHome;

  if (orientation === false) return { home: participant2, away: participant1 };
  return { home: participant1, away: participant2 };
}

export function normalizeTxlineFixture(
  rawFixture: unknown,
  options: TxlineNormalizerOptions = {}
): NormalizedTxlineFixturePreview | null {
  if (!isRecord(rawFixture)) return null;
  const fixtureId = parseFixtureId(rawFixture.FixtureId);
  if (fixtureId === null) return null;
  const teams = participantNames(rawFixture);

  return {
    fixture_id: fixtureId,
    competition: readString(rawFixture.Competition) ?? "unknown",
    stage: null,
    start_time_utc: parseEpochMsToIso(rawFixture.StartTime),
    home_team: teams.home,
    away_team: teams.away,
    status: "UNKNOWN",
    is_live: null,
    score: { home: null, away: null },
    has_odds: null,
    latest_signal_type: null,
    market_mood: "unknown",
    minute: null,
    phase: "unknown",
    raw_game_state: Object.prototype.hasOwnProperty.call(rawFixture, "GameState")
      ? rawFixture.GameState
      : null,
    last_event: null,
    momentum: null,
    ...(options.includeRaw ? { debug: { raw: rawFixture } } : {})
  };
}

function scoreOrder(record: Record<string, unknown>) {
  return {
    seq: readFiniteNumber(record.Seq),
    ts: readFiniteNumber(record.Ts)
  };
}

export function selectLatestTxlineScore(rawScores: unknown, fixtureId: unknown): unknown | null {
  if (!Array.isArray(rawScores)) return null;
  const requestedId = parseFixtureId(fixtureId);
  if (requestedId === null) return null;

  let selected: Record<string, unknown> | null = null;
  for (const candidate of rawScores) {
    if (
      !isRecord(candidate) ||
      !Object.prototype.hasOwnProperty.call(candidate, "Score") ||
      parseFixtureId(candidate.FixtureId) !== requestedId
    ) continue;

    if (selected === null) {
      selected = candidate;
      continue;
    }

    const currentOrder = scoreOrder(selected);
    const candidateOrder = scoreOrder(candidate);
    let candidateIsLater: boolean;
    if (
      currentOrder.seq !== null &&
      candidateOrder.seq !== null &&
      candidateOrder.seq !== currentOrder.seq
    ) {
      candidateIsLater = candidateOrder.seq > currentOrder.seq;
    } else {
      candidateIsLater = (candidateOrder.ts ?? Number.NEGATIVE_INFINITY) >
        (currentOrder.ts ?? Number.NEGATIVE_INFINITY);
    }
    if (candidateIsLater) selected = candidate;
  }
  return selected;
}

export function normalizeTxlineScore(
  rawScore: unknown,
  participant1IsHome: unknown
): NullableScore {
  if (!isRecord(rawScore) || !isRecord(rawScore.Score) || typeof participant1IsHome !== "boolean") {
    return { home: null, away: null };
  }

  const participant1 = rawScore.Score.Participant1;
  const participant2 = rawScore.Score.Participant2;
  const p1Goals = isRecord(participant1) && isRecord(participant1.Total)
    ? readNonNegativeFiniteNumber(participant1.Total.Goals)
    : null;
  const p2Goals = isRecord(participant2) && isRecord(participant2.Total)
    ? readNonNegativeFiniteNumber(participant2.Total.Goals)
    : null;

  return participant1IsHome
    ? { home: p1Goals, away: p2Goals }
    : { home: p2Goals, away: p1Goals };
}

export function normalizeTxlineMatchPreview(
  rawFixture: unknown,
  rawScores: unknown,
  options: TxlineNormalizerOptions = {}
): NormalizedTxlineMatchPreview | null {
  const fixture = normalizeTxlineFixture(rawFixture);
  if (fixture === null || !isRecord(rawFixture)) return null;
  const selectedScore = selectLatestTxlineScore(rawScores, fixture.fixture_id);

  return {
    ...fixture,
    score: selectedScore === null
      ? fixture.score
      : normalizeTxlineScore(selectedScore, rawFixture.Participant1IsHome),
    ...(options.includeRaw
      ? { debug: { raw: { fixture: rawFixture, score: selectedScore } } }
      : {})
  };
}
