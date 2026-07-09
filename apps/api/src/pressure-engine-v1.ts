export type PressureEngineV1Status =
  | "available"
  | "limited"
  | "unavailable";

export type PressureEngineV1Level =
  | "none"
  | "low"
  | "medium"
  | "high";

export type PressureEngineV1Side =
  | "unknown"
  | "home"
  | "away"
  | "participant1"
  | "participant2";

export type PressureEngineV1Evidence = {
  seq: number | null;
  ts: number | null;
  signal: string;
  value: string | number | boolean | null;
  weight: number;
  reason: string;
};

export type PressureEngineV1Output = {
  engine_version: "pressure-v1-rule-based";
  kind: "rule_based_pressure_hint";
  status: PressureEngineV1Status;
  pressure_level: PressureEngineV1Level;
  pressure_score: number;
  primary_side: PressureEngineV1Side;
  evaluated_records: number;
  usable_records: number;
  latest_seq: number | null;
  latest_ts: number | null;
  evidence: PressureEngineV1Evidence[];
  limitations: string[];
  debug_lineage: Array<{
    seq: number | null;
    ts: number | null;
    extracted_fields: string[];
    used: boolean;
    reason: string;
  }>;
  safe_scope_note: string;
};

export type PressureEngineV1Options = {
  windowSize?: number;
  maxEvidence?: number;
};

type NormalizedPressureRecord = {
  seq: number | null;
  ts: number | null;
  fixtureId: string | null;
  gameState: unknown;
  scoreSignature: string | null;
  scoreValue: string | number | boolean | null;
  possessionValue: string | number | boolean | null;
  possessionType: string | null;
  possibleEventPresent: boolean;
  extractedFields: string[];
  originalIndex: number;
};

type ScoreValue =
  | { kind: "single"; value: number }
  | { kind: "pair"; home: number; away: number };

const SAFE_SCOPE_NOTE =
  "This output is a rule-based pressure hint from available TxLINE score fields. It is not a prediction, probability, betting recommendation, or trained model output.";

const POSSESSION_TYPE_WEIGHTS: Record<string, number> = {
  SafePossession: 0.5,
  AttackPossession: 2,
  DangerPossession: 3,
  HighDangerPossession: 4
};

const FIELD_ALIASES = {
  seq: ["Seq", "seq"],
  ts: ["Ts", "ts"],
  fixtureId: ["FixtureId", "fixtureId"],
  gameState: ["GameState", "gameState"],
  scoreSoccer: ["ScoreSoccer", "scoreSoccer", "Score", "score"],
  dataSoccer: ["DataSoccer", "dataSoccer", "Data", "data"],
  possession: ["Possession", "possession"],
  possessionType: ["PossessionType", "possessionType"],
  possibleEvent: ["PossibleEvent", "possibleEvent"]
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnProperty(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getByAliases(record: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    if (hasOwnProperty(record, alias)) {
      return record[alias];
    }
  }

  return undefined;
}

function getNestedNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const parsed = readFiniteNumber(value);
    if (parsed !== null) return parsed;
  }

  return null;
}

function readParticipantScore(value: unknown): number | null {
  const direct = readFiniteNumber(value);
  if (direct !== null) return direct;
  if (!isRecord(value)) return null;

  const total = value.Total;
  if (isRecord(total)) {
    const goals = getNestedNumber(total, ["Goals", "goals"]);
    if (goals !== null) return goals;
  }

  const nestedKeys = [
    ["Goals", "goals"],
    ["Score", "score"],
    ["Value", "value"]
  ] as const;
  for (const keys of nestedKeys) {
    const parsed = getNestedNumber(value, keys);
    if (parsed !== null) return parsed;
  }

  return null;
}

function extractNormalizedScore(record: Record<string, unknown>): ScoreValue | null {
  const rawScore = getByAliases(record, FIELD_ALIASES.scoreSoccer);
  if (rawScore === undefined || rawScore === null) return null;

  const direct = readFiniteNumber(rawScore);
  if (direct !== null) {
    return { kind: "single", value: direct };
  }

  if (!isRecord(rawScore)) return null;

  const homeCandidates = [
    rawScore.Home,
    rawScore.home,
    rawScore.Participant1,
    rawScore.participant1,
    rawScore.Team1,
    rawScore.team1
  ];
  const awayCandidates = [
    rawScore.Away,
    rawScore.away,
    rawScore.Participant2,
    rawScore.participant2,
    rawScore.Team2,
    rawScore.team2
  ];

  const home = homeCandidates
    .map((candidate) => readParticipantScore(candidate))
    .find((value): value is number => value !== null) ?? null;
  const away = awayCandidates
    .map((candidate) => readParticipantScore(candidate))
    .find((value): value is number => value !== null) ?? null;

  if (home !== null && away !== null) {
    return { kind: "pair", home, away };
  }

  const singleFromKeys = getNestedNumber(rawScore, ["value", "Value", "score", "Score"]);
  return singleFromKeys === null ? null : { kind: "single", value: singleFromKeys };
}

function scoreSignature(score: ScoreValue): string {
  return score.kind === "single"
    ? `single:${score.value}`
    : `pair:${score.home}:${score.away}`;
}

function normalizePossessionType(value: unknown): string | null {
  const stringValue = readString(value);
  if (stringValue === null) return null;

  const canonical = Object.keys(POSSESSION_TYPE_WEIGHTS).find(
    (candidate) => candidate.toLowerCase() === stringValue.toLowerCase()
  );

  return canonical ?? stringValue;
}

function readPossessionValue(record: Record<string, unknown>): string | number | boolean | null {
  const direct = getByAliases(record, FIELD_ALIASES.possession);
  if (direct !== undefined && direct !== null) {
    if (typeof direct === "string" || typeof direct === "number" || typeof direct === "boolean") {
      return direct;
    }
  }

  const dataSoccer = getByAliases(record, FIELD_ALIASES.dataSoccer);
  if (isRecord(dataSoccer)) {
    const nested = dataSoccer.possession;
    if (nested !== undefined && nested !== null) {
      if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
        return nested;
      }
    }
  }

  return null;
}

function formatReason(signals: string[]): string {
  if (signals.length === 0) return "no usable pressure signal";
  if (signals.length === 1) return `${signals[0]} evidence only`;
  return `${signals.join(", ")} evidence`;
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(0, value));
}

function toPressureLevel(score: number): PressureEngineV1Level {
  if (score === 0) return "none";
  if (score <= 2) return "low";
  if (score <= 6) return "medium";
  return "high";
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getOrderingRank(record: Record<string, unknown>): 0 | 1 | 2 {
  const seq = readFiniteNumber(getByAliases(record, FIELD_ALIASES.seq));
  if (seq !== null) return 0;

  const ts = readFiniteNumber(getByAliases(record, FIELD_ALIASES.ts));
  if (ts !== null) return 1;

  return 2;
}

function getSortValue(record: Record<string, unknown>): number {
  const seq = readFiniteNumber(getByAliases(record, FIELD_ALIASES.seq));
  if (seq !== null) return seq;

  const ts = readFiniteNumber(getByAliases(record, FIELD_ALIASES.ts));
  if (ts !== null) return ts;

  return Number.POSITIVE_INFINITY;
}

function normalizeRecord(raw: unknown, originalIndex: number): NormalizedPressureRecord {
  const record = isRecord(raw) ? raw : {};
  const seq = readFiniteNumber(getByAliases(record, FIELD_ALIASES.seq));
  const ts = readFiniteNumber(getByAliases(record, FIELD_ALIASES.ts));
  const fixtureIdRaw = getByAliases(record, FIELD_ALIASES.fixtureId);
  const gameState = getByAliases(record, FIELD_ALIASES.gameState);
  const possessionTypeRaw = getByAliases(record, FIELD_ALIASES.possessionType);
  const possibleEventRaw = getByAliases(record, FIELD_ALIASES.possibleEvent);
  const score = extractNormalizedScore(record);
  const possessionValue = readPossessionValue(record);
  const extractedFields: string[] = [];

  if (seq !== null) extractedFields.push("seq");
  if (ts !== null) extractedFields.push("ts");
  if (fixtureIdRaw !== undefined && fixtureIdRaw !== null) extractedFields.push("fixtureId");
  if (gameState !== undefined && gameState !== null) extractedFields.push("gameState");
  if (getByAliases(record, FIELD_ALIASES.scoreSoccer) !== undefined) extractedFields.push("scoreSoccer");
  if (getByAliases(record, FIELD_ALIASES.dataSoccer) !== undefined) extractedFields.push("dataSoccer");
  if (possessionValue !== null) extractedFields.push("possession");

  const possessionType = normalizePossessionType(possessionTypeRaw);
  if (possessionTypeRaw !== undefined && possessionTypeRaw !== null) extractedFields.push("possessionType");
  if (possibleEventRaw !== undefined && possibleEventRaw !== null) extractedFields.push("possibleEvent");

  return {
    seq,
    ts,
    fixtureId: readString(fixtureIdRaw),
    gameState,
    scoreSignature: score === null ? null : scoreSignature(score),
    scoreValue:
      score === null
        ? null
        : score.kind === "single"
          ? score.value
          : `${score.home}:${score.away}`,
    possessionValue,
    possessionType,
    possibleEventPresent: possibleEventRaw !== undefined && possibleEventRaw !== null,
    extractedFields,
    originalIndex
  };
}

function buildLimitations(input: {
  possibleEventObserved: boolean;
  usableEvidenceCount: number;
  recordCount: number;
}): string[] {
  const limitations = [
    "possessionType is sparse and treated as a discrete state flag, not possession percentage.",
    "possibleEvent is not used by Pressure Engine v1.",
    "This is a rule-based pressure hint, not a trained model.",
    "Pressure score is not a probability and does not predict match outcome."
  ];

  if (input.possibleEventObserved) {
    limitations.push("possibleEvent was observed in input but ignored by Pressure Engine v1.");
  }

  if (input.recordCount === 0) {
    limitations.push("No records were provided.");
  }

  if (input.usableEvidenceCount === 0 && input.recordCount > 0) {
    limitations.push("No usable pressure signals were found in the evaluated window.");
  }

  return limitations;
}

export function normalizePressureEngineV1Options(
  options?: PressureEngineV1Options
): Required<PressureEngineV1Options> {
  const requestedWindowSize =
    typeof options?.windowSize === "number" && Number.isFinite(options.windowSize)
      ? options.windowSize
      : 10;
  const requestedMaxEvidence =
    typeof options?.maxEvidence === "number" && Number.isFinite(options.maxEvidence)
      ? options.maxEvidence
      : 8;

  return {
    windowSize: clampInt(requestedWindowSize, 1, 50),
    maxEvidence: clampInt(requestedMaxEvidence, 1, 20)
  };
}

export function buildPressureEngineV1Hint(
  records: unknown[],
  options?: PressureEngineV1Options
): PressureEngineV1Output {
  const normalizedOptions = normalizePressureEngineV1Options(options);
  const safeRecords = Array.isArray(records) ? records : [];
  const normalized = safeRecords.map((record, index) => normalizeRecord(record, index));

  const ordered = [...normalized].sort((left, right) => {
    const leftRank = getOrderingRank(left as unknown as Record<string, unknown>);
    const rightRank = getOrderingRank(right as unknown as Record<string, unknown>);
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftValue = getSortValue(left as unknown as Record<string, unknown>);
    const rightValue = getSortValue(right as unknown as Record<string, unknown>);
    if (leftValue !== rightValue) return leftValue < rightValue ? -1 : 1;

    return left.originalIndex - right.originalIndex;
  });

  const evaluated = ordered.slice(Math.max(0, ordered.length - normalizedOptions.windowSize));
  const debugLineage: PressureEngineV1Output["debug_lineage"] = [];
  const evidence: PressureEngineV1Evidence[] = [];
  let pressureScore = 0;
  let usableRecords = 0;
  let possibleEventObserved = false;
  let previousScoreSignature: string | null = null;

  for (const record of evaluated) {
    const recordEvidence: PressureEngineV1Evidence[] = [];
    const evidenceSignals: string[] = [];

    if (record.possibleEventPresent) {
      possibleEventObserved = true;
    }

    if (record.possessionType !== null && Object.prototype.hasOwnProperty.call(POSSESSION_TYPE_WEIGHTS, record.possessionType)) {
      const weight = POSSESSION_TYPE_WEIGHTS[record.possessionType];
      recordEvidence.push({
        seq: record.seq,
        ts: record.ts,
        signal: "possessionType",
        value: record.possessionType,
        weight,
        reason: `possessionType=${record.possessionType} indicates a sparse pressure state`
      });
      pressureScore += weight;
      evidenceSignals.push("possessionType");
    } else if (record.possessionType === null && record.possessionValue !== null) {
      recordEvidence.push({
        seq: record.seq,
        ts: record.ts,
        signal: "possession",
        value: record.possessionValue,
        weight: 0.5,
        reason: "possession field present without possessionType; weak availability hint only"
      });
      pressureScore += 0.5;
      evidenceSignals.push("possession");
    }

    if (record.scoreSignature !== null && previousScoreSignature !== null && record.scoreSignature !== previousScoreSignature) {
      recordEvidence.push({
        seq: record.seq,
        ts: record.ts,
        signal: "score_change",
        value: record.scoreValue,
        weight: 3,
        reason: "normalized score changed between consecutive records"
      });
      pressureScore += 3;
      evidenceSignals.push("score_change");
    }

    if (recordEvidence.length > 0) {
      usableRecords += 1;
      evidence.push(...recordEvidence);
    }

    debugLineage.push({
      seq: record.seq,
      ts: record.ts,
      extracted_fields: record.extractedFields,
      used: recordEvidence.length > 0,
      reason: formatReason(evidenceSignals)
    });

    previousScoreSignature = record.scoreSignature;
  }

  const totalEvidenceCount = evidence.length;
  const status: PressureEngineV1Status =
    totalEvidenceCount === 0
      ? "unavailable"
      : totalEvidenceCount < 3
        ? "limited"
        : "available";

  const clampedScore = clampScore(pressureScore);
  const latest = evaluated.length > 0 ? evaluated[evaluated.length - 1] : null;
  const limitations = buildLimitations({
    possibleEventObserved,
    usableEvidenceCount: totalEvidenceCount,
    recordCount: evaluated.length
  });

  return {
    engine_version: "pressure-v1-rule-based",
    kind: "rule_based_pressure_hint",
    status,
    pressure_level: toPressureLevel(clampedScore),
    pressure_score: clampedScore,
    primary_side: "unknown",
    evaluated_records: evaluated.length,
    usable_records: usableRecords,
    latest_seq: latest?.seq ?? null,
    latest_ts: latest?.ts ?? null,
    evidence: evidence.slice(Math.max(0, evidence.length - normalizedOptions.maxEvidence)),
    limitations,
    debug_lineage: debugLineage,
    safe_scope_note: SAFE_SCOPE_NOTE
  };
}
