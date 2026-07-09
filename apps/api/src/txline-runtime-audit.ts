import { createHash } from "node:crypto";
import { createTxlineLiveClient, TxlineLiveError } from "@matchpulse/txline-client";
import {
  isRecord,
  parseFixtureId,
  readFiniteNumber,
  readString
} from "./txline-normalizer.js";
import {
  buildTxlineAuditFindingCreateData,
  buildTxlineAuditRunCreateData,
  buildTxlineRawPayloadCreateData,
  createTxlineAuditFinding,
  createTxlineAuditRun,
  finalizeTxlineAuditRun,
  getTxlineAuditRunDetails,
  storeTxlineRawPayload,
  type StoredTxlineAuditFinding,
  type StoredTxlineAuditRun,
  type StoredTxlineRawPayload
} from "./txline-runtime-payload-store.js";

export type TxlineRuntimeEndpointType =
  | "fixtures_snapshot"
  | "scores_snapshot"
  | "odds_snapshot";

export type TxlineAuditFindingCategory =
  | "bookmaker_distribution"
  | "pct_audit"
  | "missing_fields"
  | "latency"
  | "payload_shape"
  | "odds_availability"
  | "score_availability"
  | "missing_asOf"
  | "txline_request";

export type TxlineAuditSeverity = "info" | "warning" | "error";

type FieldPresenceSummary = {
  present: number;
  total: number;
  rate: number;
};

type FieldPresenceMap = Record<string, FieldPresenceSummary>;

type TxlineLatencyMode = "historical_snapshot_age" | "live_receipt_latency" | "mixed";

export type TxlineRuntimeAuditSummary = {
  auditRunId: string;
  status: "completed" | "completed_with_warnings" | "failed";
  requests: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    failedEndpointTypes: TxlineRuntimeEndpointType[];
    skippedEndpointTypes: TxlineRuntimeEndpointType[];
    errors: string[];
  };
  asOf: {
    global: number | null;
    scoreByFixtureId: Record<string, number>;
    oddsByFixtureId: Record<string, number>;
    missingScoreAsOfFixtureIds: string[];
    missingOddsAsOfFixtureIds: string[];
  };
  fixtures: {
    requestedFixtureIds: string[];
    foundFixtureIds: string[];
    fixtureCount: number;
    competitionIds: string[];
    participantNames: string[];
    startTimes: string[];
    targetFixtureIdsPresent: string[];
  };
  scores: {
    payloadsFetched: number;
    possessionTypeValues: string[];
    possibleEventFieldsFound: string[];
    missingFields: string[];
    fieldPresence: FieldPresenceMap;
    latestSeq: number | null;
    scorePayloadAvailable: boolean;
    possessionTypePresent: boolean;
    possibleEventPresent: boolean;
  };
  odds: {
    payloadsFetched: number;
    bookmakerIds: string[];
    bookmakerNames: string[];
    bookmakerCount: number;
    marketCount: number;
    pct: {
      numericCount: number;
      naCount: number;
      naRate: number;
      pctSumMin: number | null;
      pctSumMax: number | null;
      pctSumAvg: number | null;
      pctSumCount: number;
    };
    classification: "single_stable_price_demargined" | "single_source" | "multi_bookmaker" | "unknown";
    fieldPresence: FieldPresenceMap;
  };
  latency: {
    samples: number;
    p50Ms: number | null;
    p95Ms: number | null;
    maxMs: number | null;
    mode: TxlineLatencyMode;
  };
  dataQuality: {
    missingCriticalFields: string[];
    warnings: string[];
  };
  payloads: {
    fixtures: number;
    scores: number;
    odds: number;
  };
};

export type TxlineRuntimeAuditInput = {
  fixtureIds: string[];
  competitionId: string | number;
  startEpochDay: number;
  includeFixtures: boolean;
  includeScores: boolean;
  includeOdds: boolean;
  asOf?: number | null;
  scoreAsOfByFixtureId?: Record<string, number | null | undefined>;
  oddsAsOfByFixtureId?: Record<string, number | null | undefined>;
  notes?: string | null;
};

export type TxlineAuditFindingDraft = {
  auditRunId?: string;
  fixtureId: string | null;
  category: TxlineAuditFindingCategory;
  severity: TxlineAuditSeverity;
  title: string;
  detailsJson: unknown;
};

export type TxlineRuntimeAuditExecutionResult = {
  audit_run: StoredTxlineAuditRun;
  raw_payloads: StoredTxlineRawPayload[];
  findings: StoredTxlineAuditFinding[];
  summary: TxlineRuntimeAuditSummary;
};

type CandidateRecord = Record<string, unknown>;

type AuditFetchDependencies = {
  fetchFixtures: (params: { competitionId: string; startEpochDay: number }) => Promise<unknown>;
  fetchScores: (params: { fixtureId: string; asOf: number }) => Promise<unknown>;
  fetchOdds: (params: { fixtureId: string; asOf: number }) => Promise<unknown>;
};

type AuditRuntimeDependencies = {
  now?: () => Date;
  fetch?: Partial<AuditFetchDependencies>;
  store?: {
    createAuditRun?: typeof createTxlineAuditRun;
    finalizeAuditRun?: typeof finalizeTxlineAuditRun;
    createAuditFinding?: typeof createTxlineAuditFinding;
    storeRawPayload?: typeof storeTxlineRawPayload;
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readMaybeString(value: unknown): string | null {
  return readString(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : null);
}

function readField(record: CandidateRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function getByAnyAlias(record: unknown, aliases: readonly string[]): unknown {
  if (!isRecord(record)) return undefined;
  for (const alias of aliases) {
    if (Object.hasOwn(record, alias)) return record[alias];
  }
  return undefined;
}

function canonicalSerialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => canonicalSerialize(item, seen));
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const record = value as CandidateRecord;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const normalized = canonicalSerialize(record[key], seen);
    if (normalized !== undefined) {
      output[key] = normalized;
    }
  }
  seen.delete(value);
  return output;
}

export function stableSerializeTxlinePayload(value: unknown): string {
  return JSON.stringify(canonicalSerialize(value)) ?? "null";
}

export function hashTxlinePayload(value: unknown): string {
  return createHash("sha256").update(stableSerializeTxlinePayload(value)).digest("hex");
}

function parseEpochTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const ms = value >= 1_000_000_000_000 ? value : value >= 1_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (/^\d+$/.test(trimmed)) {
      return parseEpochTimestamp(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  return null;
}

function collectTimestampCandidates(value: unknown, output: Date[], seen = new WeakSet<object>()): void {
  if (!isRecord(value) && !Array.isArray(value)) return;
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return;
    seen.add(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTimestampCandidates(item, output, seen);
    }
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "Ts" || key === "ts") {
      const timestamp = parseEpochTimestamp(entry);
      if (timestamp !== null) output.push(timestamp);
    }
    collectTimestampCandidates(entry, output, seen);
  }
}

export function extractBestProviderTimestamp(value: unknown): Date | null {
  const candidates: Date[] = [];
  collectTimestampCandidates(value, candidates);
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => left.getTime() - right.getTime());
  return candidates[candidates.length - 1] ?? null;
}

export function calculateLatencyMs(receivedAt: Date, providerTs: Date | null): number | null {
  if (providerTs === null) return null;
  const latencyMs = receivedAt.getTime() - providerTs.getTime();
  return Number.isFinite(latencyMs) ? latencyMs : null;
}

function collectCandidateRecords(value: unknown, predicate: (record: CandidateRecord) => boolean): CandidateRecord[] {
  const records: CandidateRecord[] = [];
  const seen = new WeakSet<object>();

  const visit = (input: unknown) => {
    if (Array.isArray(input)) {
      for (const item of input) visit(item);
      return;
    }
    if (!isRecord(input)) return;
    if (seen.has(input)) return;
    seen.add(input);

    if (predicate(input)) records.push(input);
    for (const entry of Object.values(input)) {
      visit(entry);
    }
  };

  visit(value);
  return records;
}

function readNormalizedNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getPctArray(record: unknown): unknown[] | null {
  const pct = getByAnyAlias(record, ["Pct", "pct"]);
  return Array.isArray(pct) ? pct : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    if (value.trim().toUpperCase() === "NA") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function calcPctStats(oddsRecords: unknown[]) {
  let numericCount = 0;
  let naCount = 0;
  const validPctSums: number[] = [];

  for (const record of oddsRecords) {
    const pctArray = getPctArray(record);
    if (!pctArray) continue;

    const parsed = pctArray.map(toNumberOrNull);

    for (const value of parsed) {
      if (value == null) naCount++;
      else numericCount++;
    }

    const rowIsFullyNumeric = parsed.length > 0 && parsed.every((value) => value != null);
    if (rowIsFullyNumeric) {
      const sum = parsed.reduce((accumulator, value) => accumulator + (value ?? 0), 0);
      validPctSums.push(sum);
    }
  }

  const pctSumMin = validPctSums.length ? Math.min(...validPctSums) : null;
  const pctSumMax = validPctSums.length ? Math.max(...validPctSums) : null;
  const pctSumAvg = validPctSums.length
    ? validPctSums.reduce((accumulator, value) => accumulator + value, 0) / validPctSums.length
    : null;
  const totalPctEntries = numericCount + naCount;

  return {
    numericCount,
    naCount,
    naRate: totalPctEntries > 0 ? naCount / totalPctEntries : 0,
    pctSumMin,
    pctSumMax,
    pctSumAvg,
    pctSumCount: validPctSums.length
  };
}

function calcFieldPresence(records: unknown[], fields: Record<string, readonly string[]>): FieldPresenceMap {
  const total = records.length;
  const result: FieldPresenceMap = {};

  for (const [fieldName, aliases] of Object.entries(fields)) {
    let present = 0;

    for (const record of records) {
      const value = getByAnyAlias(record, aliases);
      if (value !== undefined && value !== null) {
        present++;
      }
    }

    result[fieldName] = {
      present,
      total,
      rate: total > 0 ? present / total : 0
    };
  }

  return result;
}

function isGloballyMissing(records: unknown[], aliases: readonly string[]): boolean {
  return records.every((record) => getByAnyAlias(record, aliases) == null);
}

function mergeFieldPresenceMaps(accumulator: FieldPresenceMap, current: FieldPresenceMap): FieldPresenceMap {
  const fieldNames = new Set([...Object.keys(accumulator), ...Object.keys(current)]);
  const merged: FieldPresenceMap = {};

  for (const fieldName of fieldNames) {
    const left = accumulator[fieldName];
    const right = current[fieldName];
    const present = (left?.present ?? 0) + (right?.present ?? 0);
    const total = (left?.total ?? 0) + (right?.total ?? 0);
    merged[fieldName] = {
      present,
      total,
      rate: total > 0 ? present / total : 0
    };
  }

  return merged;
}

function hasAnyKey(record: CandidateRecord, keys: string[]): boolean {
  return keys.some((key) => Object.hasOwn(record, key));
}

function collectDistinctStrings(values: Iterable<unknown>): string[] {
  return [...new Set([...values].map((value) => readMaybeString(value)).filter(isNonEmptyString))];
}

function percentile(samples: number[], ratio: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? null;
}

function summarizeLatencies(samples: number[]): Omit<TxlineRuntimeAuditSummary["latency"], "mode"> {
  return {
    samples: samples.length,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: samples.length === 0 ? null : Math.max(...samples)
  };
}

function classifyBookmakers(bookmakerIds: string[], bookmakerNames: string[]): TxlineRuntimeAuditSummary["odds"]["classification"] {
  if (bookmakerIds.length > 1) return "multi_bookmaker";
  if (bookmakerIds.length === 1) {
    const bookmakerName = bookmakerNames[0] ?? "";
    if (bookmakerName.includes("StablePriceDemargined")) return "single_stable_price_demargined";
    return "single_source";
  }
  if (bookmakerNames.length > 1) return "multi_bookmaker";
  if (bookmakerNames.length === 1) return "single_source";
  return "unknown";
}

const SCORE_FIELD_ALIASES = {
  seq: ["seq", "Seq"],
  ts: ["ts", "Ts"],
  fixtureId: ["fixtureId", "FixtureId"],
  gameState: ["gameState", "GameState"],
  statusSoccerId: ["statusSoccerId", "StatusSoccerId"],
  scoreSoccer: ["scoreSoccer", "ScoreSoccer", "Score", "score"],
  dataSoccer: ["dataSoccer", "DataSoccer", "Data", "data"],
  possession: ["possession", "Possession"],
  possessionType: ["possessionType", "PossessionType"],
  parti1StateSoccer: ["parti1StateSoccer", "Parti1StateSoccer", "Participant1StateSoccer"],
  parti2StateSoccer: ["parti2StateSoccer", "Parti2StateSoccer", "Participant2StateSoccer"],
  possibleEvent: ["possibleEvent", "PossibleEvent"]
} as const;

const ODDS_FIELD_ALIASES = {
  FixtureId: ["FixtureId", "fixtureId"],
  MessageId: ["MessageId", "messageId"],
  Ts: ["Ts", "ts"],
  Bookmaker: ["Bookmaker", "bookmaker"],
  BookmakerId: ["BookmakerId", "bookmakerId"],
  SuperOddsType: ["SuperOddsType", "superOddsType"],
  GameState: ["GameState", "gameState"],
  InRunning: ["InRunning", "inRunning"],
  MarketParameters: ["MarketParameters", "marketParameters"],
  MarketPeriod: ["MarketPeriod", "marketPeriod"],
  PriceNames: ["PriceNames", "priceNames"],
  Prices: ["Prices", "prices"],
  Pct: ["Pct", "pct"]
} as const;

function getLatencyMode(input: {
  global: number | null;
  scoreByFixtureId: Record<string, number>;
  oddsByFixtureId: Record<string, number>;
}): TxlineLatencyMode {
  const hasAnyAsOf =
    input.global != null ||
    Object.keys(input.scoreByFixtureId).length > 0 ||
    Object.keys(input.oddsByFixtureId).length > 0;
  return hasAnyAsOf ? "historical_snapshot_age" : "live_receipt_latency";
}

function toFinding(
  draft: TxlineAuditFindingDraft,
  auditRunId: string
): Parameters<typeof buildTxlineAuditFindingCreateData>[0] {
  return {
    ...draft,
    auditRunId
  };
}

function scoreRecordPredicate(record: CandidateRecord): boolean {
  return hasAnyKey(record, [
    "Seq",
    "seq",
    "Ts",
    "ts",
    "Score",
    "scoreSoccer",
    "ScoreSoccer",
    "DataSoccer",
    "dataSoccer",
    "possessionType",
    "PossessionType",
    "PossibleEvent",
    "possibleEvent"
  ]);
}

function oddsRecordPredicate(record: CandidateRecord): boolean {
  return hasAnyKey(record, [
    "BookmakerId",
    "bookmakerId",
    "Bookmaker",
    "bookmaker",
    "SuperOddsType",
    "superOddsType",
    "MarketPeriod",
    "marketPeriod",
    "MarketParameters",
    "marketParameters",
    "PriceNames",
    "priceNames",
    "Prices",
    "prices",
    "Pct",
    "pct"
  ]);
}

function fixtureRecordPredicate(record: CandidateRecord): boolean {
  return hasAnyKey(record, [
    "FixtureId",
    "fixtureId",
    "CompetitionId",
    "competitionId",
    "Participant1",
    "participant1",
    "Participant2",
    "participant2",
    "StartTime",
    "startTime"
  ]);
}

export type TxlineFixturesAudit = {
  fixtureCount: number;
  requestedFixtureIds: string[];
  foundFixtureIds: string[];
  competitionIds: string[];
  participantNames: string[];
  startTimes: string[];
  targetFixtureIdsPresent: string[];
  providerTs: Date | null;
  latencyMs: number | null;
  warnings: string[];
};

export type TxlineScoresAudit = {
  payloadsFetched: number;
  latestSeq: number | null;
  possessionTypeValues: string[];
  possibleEventFieldsFound: string[];
  missingFields: string[];
  fieldPresence: FieldPresenceMap;
  scorePayloadAvailable: boolean;
  possessionTypePresent: boolean;
  possibleEventPresent: boolean;
  providerTs: Date | null;
  latencyMs: number | null;
  warnings: string[];
};

export type TxlineOddsAudit = {
  payloadsFetched: number;
  bookmakerIds: string[];
  bookmakerNames: string[];
  bookmakerCount: number;
  marketCount: number;
  pct: TxlineRuntimeAuditSummary["odds"]["pct"];
  classification: TxlineRuntimeAuditSummary["odds"]["classification"];
  fieldPresence: FieldPresenceMap;
  providerTs: Date | null;
  latencyMs: number | null;
  warnings: string[];
};

function analyzeFixtureRecords(
  records: CandidateRecord[],
  requestedFixtureIds: string[]
): Omit<TxlineFixturesAudit, "providerTs" | "latencyMs" | "warnings"> {
  const fixtureIds = new Set<string>();
  const competitionIds = new Set<string>();
  const participantNames = new Set<string>();
  const startTimes = new Set<string>();

  for (const record of records) {
    const fixtureId = readMaybeString(readField(record, ["FixtureId", "fixtureId"]));
    if (fixtureId !== null) fixtureIds.add(fixtureId);

    const competitionId = readMaybeString(readField(record, ["CompetitionId", "competitionId"]));
    if (competitionId !== null) competitionIds.add(competitionId);

    const participant1 = readMaybeString(readField(record, ["Participant1", "participant1"]));
    const participant2 = readMaybeString(readField(record, ["Participant2", "participant2"]));
    if (participant1 !== null) participantNames.add(participant1);
    if (participant2 !== null) participantNames.add(participant2);

    const startTime = parseEpochTimestamp(readField(record, ["StartTime", "startTime"]));
    if (startTime !== null) startTimes.add(startTime.toISOString());
  }

  return {
    fixtureCount: fixtureIds.size,
    requestedFixtureIds,
    foundFixtureIds: [...fixtureIds],
    competitionIds: [...competitionIds],
    participantNames: [...participantNames],
    startTimes: [...startTimes],
    targetFixtureIdsPresent: requestedFixtureIds.filter((fixtureId) => fixtureIds.has(fixtureId))
  };
}

function analyzeScoreRecords(records: CandidateRecord[]): Omit<TxlineScoresAudit, "providerTs" | "latencyMs" | "warnings"> {
  const seqs: number[] = [];
  const possessionTypeValues = new Set<string>();
  const possibleEventFieldsFound = new Set<string>();

  for (const record of records) {
    const seq = readNormalizedNumber(getByAnyAlias(record, SCORE_FIELD_ALIASES.seq));
    if (seq !== null) seqs.push(seq);
    const possessionType = readMaybeString(getByAnyAlias(record, SCORE_FIELD_ALIASES.possessionType));
    if (possessionType !== null) {
      possessionTypeValues.add(possessionType);
    }
    if (getByAnyAlias(record, SCORE_FIELD_ALIASES.possibleEvent) !== undefined) {
      possibleEventFieldsFound.add("PossibleEvent");
    }

    for (const key of Object.keys(record)) {
      if (key.toLowerCase().includes("possibleevent")) {
        possibleEventFieldsFound.add(key);
      }
    }
  }

  const fieldPresence = calcFieldPresence(records, SCORE_FIELD_ALIASES);
  const missingFields = Object.entries(SCORE_FIELD_ALIASES)
    .filter(([, aliases]) => isGloballyMissing(records, aliases))
    .map(([field]) => field);

  return {
    payloadsFetched: records.length,
    latestSeq: seqs.length === 0 ? null : Math.max(...seqs),
    possessionTypeValues: [...possessionTypeValues],
    possibleEventFieldsFound: [...possibleEventFieldsFound],
    missingFields,
    fieldPresence,
    scorePayloadAvailable: records.length > 0,
    possessionTypePresent: possessionTypeValues.size > 0,
    possibleEventPresent: possibleEventFieldsFound.size > 0
  };
}

function analyzeOddsRecords(records: CandidateRecord[]): Omit<TxlineOddsAudit, "providerTs" | "latencyMs" | "warnings"> {
  const bookmakerIds = new Set<string>();
  const bookmakerNames = new Set<string>();
  const marketSignatures = new Set<string>();

  for (const record of records) {
    const bookmakerId = readMaybeString(getByAnyAlias(record, ODDS_FIELD_ALIASES.BookmakerId));
    const bookmaker = readMaybeString(getByAnyAlias(record, ODDS_FIELD_ALIASES.Bookmaker));
    const superOddsType = readMaybeString(getByAnyAlias(record, ODDS_FIELD_ALIASES.SuperOddsType));
    const marketPeriod = readMaybeString(getByAnyAlias(record, ODDS_FIELD_ALIASES.MarketPeriod));
    const marketParameters = getByAnyAlias(record, ODDS_FIELD_ALIASES.MarketParameters);

    if (bookmakerId !== null) bookmakerIds.add(bookmakerId);
    if (bookmaker !== null) bookmakerNames.add(bookmaker);
    marketSignatures.add(stableSerializeTxlinePayload({
      bookmakerId,
      bookmaker,
      superOddsType,
      marketPeriod,
      marketParameters
    }));
  }

  const pct = calcPctStats(records);
  const fieldPresence = calcFieldPresence(records, ODDS_FIELD_ALIASES);

  return {
    payloadsFetched: records.length,
    bookmakerIds: [...bookmakerIds],
    bookmakerNames: [...bookmakerNames],
    bookmakerCount: bookmakerIds.size > 0 ? bookmakerIds.size : bookmakerNames.size,
    marketCount: marketSignatures.size,
    pct,
    classification: classifyBookmakers([...bookmakerIds], [...bookmakerNames]),
    fieldPresence
  };
}

export function analyzeTxlineFixturesPayload(
  payload: unknown,
  input: { requestedFixtureIds: string[]; receivedAt: Date }
): {
  audit: TxlineFixturesAudit;
  findings: TxlineAuditFindingDraft[];
  payloadShape: string;
  payloadHash: string;
  providerTs: Date | null;
  latencyMs: number | null;
} {
  const records = collectCandidateRecords(payload, fixtureRecordPredicate);
  const providerTs = extractBestProviderTimestamp(payload);
  const latencyMs = calculateLatencyMs(input.receivedAt, providerTs);
  const warnings: string[] = [];

  if (records.length === 0 && payload !== null && payload !== undefined) {
    warnings.push("Fixture snapshot payload shape was not recognized.");
  }

  const audit = {
    ...analyzeFixtureRecords(records, input.requestedFixtureIds),
    providerTs,
    latencyMs,
    warnings
  };
  const findings: TxlineAuditFindingDraft[] = [];
  if (records.length === 0) {
    findings.push({
      fixtureId: null,
      category: "payload_shape",
      severity: "warning",
      title: "Fixture snapshot shape was unexpected",
      detailsJson: {
        reason: "No fixture-like records were extracted from the payload."
      }
    });
  }
  if (input.requestedFixtureIds.length > 0 && audit.targetFixtureIdsPresent.length !== input.requestedFixtureIds.length) {
    findings.push({
      fixtureId: null,
      category: "missing_fields",
      severity: "warning",
      title: "Some requested fixture IDs were not present in the snapshot",
      detailsJson: {
        requestedFixtureIds: input.requestedFixtureIds,
        foundFixtureIds: audit.foundFixtureIds
      }
    });
  }

  return {
    audit,
    findings,
    payloadShape: Array.isArray(payload) ? "array" : typeof payload,
    payloadHash: hashTxlinePayload(payload),
    providerTs,
    latencyMs
  };
}

export function analyzeTxlineScoresPayload(
  payload: unknown,
  input: { fixtureId: string; receivedAt: Date }
): {
  audit: TxlineScoresAudit;
  findings: TxlineAuditFindingDraft[];
  payloadShape: string;
  payloadHash: string;
  providerTs: Date | null;
  latencyMs: number | null;
} {
  const records = collectCandidateRecords(payload, scoreRecordPredicate);
  const providerTs = extractBestProviderTimestamp(payload);
  const latencyMs = calculateLatencyMs(input.receivedAt, providerTs);
  const warnings: string[] = [];
  if (records.length === 0 && payload !== null && payload !== undefined) {
    warnings.push("Score snapshot payload shape was not recognized.");
  }

  const audit = {
    ...analyzeScoreRecords(records),
    providerTs,
    latencyMs,
    warnings
  };
  const findings: TxlineAuditFindingDraft[] = [];
  if (!audit.scorePayloadAvailable) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "score_availability",
      severity: "warning",
      title: "Score snapshot was missing or empty",
      detailsJson: {
        fixtureId: input.fixtureId
      }
    });
  }
  if (records.length === 0) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "payload_shape",
      severity: "warning",
      title: "Score snapshot shape was unexpected",
      detailsJson: {
        reason: "No score-like records were extracted from the payload."
      }
    });
  }
  if (audit.missingFields.length > 0) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "missing_fields",
      severity: "info",
      title: "Some score fields were absent",
      detailsJson: {
        missingFields: audit.missingFields
      }
    });
  }
  if (latencyMs !== null) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "latency",
      severity: "info",
      title: "Score payload latency was captured",
      detailsJson: {
        latencyMs
      }
    });
  }

  return {
    audit,
    findings,
    payloadShape: Array.isArray(payload) ? "array" : typeof payload,
    payloadHash: hashTxlinePayload(payload),
    providerTs,
    latencyMs
  };
}

function analyzePctRecords(records: CandidateRecord[]): TxlineOddsAudit["pct"] {
  const oddsAudit = analyzeOddsRecords(records);
  return oddsAudit.pct;
}

export function analyzeTxlineOddsPayload(
  payload: unknown,
  input: { fixtureId: string; receivedAt: Date }
): {
  audit: TxlineOddsAudit;
  findings: TxlineAuditFindingDraft[];
  payloadShape: string;
  payloadHash: string;
  providerTs: Date | null;
  latencyMs: number | null;
} {
  const records = collectCandidateRecords(payload, oddsRecordPredicate);
  const providerTs = extractBestProviderTimestamp(payload);
  const latencyMs = calculateLatencyMs(input.receivedAt, providerTs);
  const warnings: string[] = [];
  if (records.length === 0 && payload !== null && payload !== undefined) {
    warnings.push("Odds snapshot payload shape was not recognized.");
  }

  const audit = {
    ...analyzeOddsRecords(records),
    providerTs,
    latencyMs,
    warnings
  };
  const findings: TxlineAuditFindingDraft[] = [];
  if (!audit.payloadsFetched) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "odds_availability",
      severity: "warning",
      title: "Odds snapshot was missing or empty",
      detailsJson: {
        fixtureId: input.fixtureId
      }
    });
  }
  if (records.length === 0) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "payload_shape",
      severity: "warning",
      title: "Odds snapshot shape was unexpected",
      detailsJson: {
        reason: "No odds-like records were extracted from the payload."
      }
    });
  }
  findings.push({
    fixtureId: input.fixtureId,
    category: "bookmaker_distribution",
    severity: audit.classification === "unknown" ? "warning" : "info",
    title: "Bookmaker distribution was analyzed",
    detailsJson: {
      bookmakerIds: audit.bookmakerIds,
      bookmakerNames: audit.bookmakerNames,
      bookmakerCount: audit.bookmakerCount,
      classification: audit.classification
    }
  });
  findings.push({
    fixtureId: input.fixtureId,
    category: "pct_audit",
    severity: audit.pct.naCount > 0 ? "warning" : "info",
    title: "Pct values were audited without de-vigging",
    detailsJson: {
      pct: audit.pct
    }
  });
  if (latencyMs !== null) {
    findings.push({
      fixtureId: input.fixtureId,
      category: "latency",
      severity: "info",
      title: "Odds payload latency was captured",
      detailsJson: {
        latencyMs
      }
    });
  }

  return {
    audit,
    findings,
    payloadShape: Array.isArray(payload) ? "array" : typeof payload,
    payloadHash: hashTxlinePayload(payload),
    providerTs,
    latencyMs
  };
}

function mergeWarnings(...inputs: Array<string[] | undefined>): string[] {
  return [...new Set(inputs.flatMap((value) => value ?? []))];
}

function mergeMissingCriticalFields(
  scores: TxlineScoresAudit,
  odds: TxlineOddsAudit,
  fixtures: TxlineFixturesAudit
): string[] {
  return [
    ...(scores.missingFields.length > 0 ? scores.missingFields.map((field) => `scores.${field}`) : []),
    ...(odds.payloadsFetched === 0 ? ["odds.payload"] : []),
    ...(fixtures.fixtureCount === 0 ? ["fixtures.snapshot"] : [])
  ];
}

function mergeLatencies(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

type RequestTracker = TxlineRuntimeAuditSummary["requests"];

function createRequestTracker(): RequestTracker {
  return {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    failedEndpointTypes: [],
    skippedEndpointTypes: [],
    errors: []
  };
}

function recordRequestAttempt(tracker: RequestTracker): void {
  tracker.attempted += 1;
}

function recordRequestSuccess(tracker: RequestTracker): void {
  tracker.succeeded += 1;
}

function recordRequestFailure(tracker: RequestTracker, endpointType: TxlineRuntimeEndpointType, message: string): void {
  tracker.failed += 1;
  tracker.failedEndpointTypes.push(endpointType);
  tracker.errors.push(message);
}

function recordRequestSkip(tracker: RequestTracker, endpointType: TxlineRuntimeEndpointType): void {
  tracker.skipped += 1;
  tracker.skippedEndpointTypes.push(endpointType);
}

function parseOptionalAsOf(value: unknown): number | null {
  const numeric = readFiniteNumber(value);
  return numeric === null ? null : numeric;
}

function parseAsOfByFixtureId(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const parsed = parseOptionalAsOf(rawValue);
    if (parsed !== null) result[key] = parsed;
  }
  return result;
}

function createMissingAsOfFinding(
  endpointType: TxlineRuntimeEndpointType,
  fixtureId: string
): TxlineAuditFindingDraft {
  const title = endpointType === "scores_snapshot"
    ? "Score snapshot skipped because asOf is missing"
    : "Odds snapshot skipped because asOf is missing";
  return {
    fixtureId,
    category: "missing_asOf",
    severity: "warning",
    title,
    detailsJson: {
      endpointType,
      fixtureId,
      recoverable: true
    }
  };
}

function createTxlineRequestFailureFinding(
  endpointType: TxlineRuntimeEndpointType,
  fixtureId: string,
  asOf: number,
  error: unknown
): TxlineAuditFindingDraft {
  const message = safeTxlineMessage(error);
  const reason = error instanceof TxlineLiveError ? error.safe.kind : "unknown";
  return {
    fixtureId,
    category: "txline_request",
    severity: "error",
    title: "TxLINE request failed",
    detailsJson: {
      endpointType,
      fixtureId,
      asOf,
      message,
      reason,
      recoverable: true
    }
  };
}

export function buildTxlineRuntimeAuditSummary(input: {
  auditRunId: string;
  status: TxlineRuntimeAuditSummary["status"];
  requests: TxlineRuntimeAuditSummary["requests"];
  asOf: TxlineRuntimeAuditSummary["asOf"];
  fixtures: TxlineFixturesAudit;
  scores: TxlineScoresAudit;
  odds: TxlineOddsAudit;
  fixtureIds: string[];
  latencySamples?: number[];
  extraWarnings?: string[];
}): TxlineRuntimeAuditSummary {
  const latencySamples = input.latencySamples ?? mergeLatencies([
    input.fixtures.latencyMs,
    input.scores.latencyMs,
    input.odds.latencyMs
  ]);

  return {
    auditRunId: input.auditRunId,
    status: input.status,
    requests: input.requests,
    asOf: input.asOf,
    fixtures: {
      requestedFixtureIds: input.fixtureIds,
      foundFixtureIds: input.fixtures.foundFixtureIds,
      fixtureCount: input.fixtures.fixtureCount,
      competitionIds: input.fixtures.competitionIds,
      participantNames: input.fixtures.participantNames,
      startTimes: input.fixtures.startTimes,
      targetFixtureIdsPresent: input.fixtures.targetFixtureIdsPresent
    },
    scores: {
      payloadsFetched: input.scores.payloadsFetched,
      possessionTypeValues: input.scores.possessionTypeValues,
      possibleEventFieldsFound: input.scores.possibleEventFieldsFound,
      missingFields: input.scores.missingFields,
      fieldPresence: input.scores.fieldPresence,
      latestSeq: input.scores.latestSeq,
      scorePayloadAvailable: input.scores.scorePayloadAvailable,
      possessionTypePresent: input.scores.possessionTypePresent,
      possibleEventPresent: input.scores.possibleEventPresent
    },
    odds: {
      payloadsFetched: input.odds.payloadsFetched,
      bookmakerIds: input.odds.bookmakerIds,
      bookmakerNames: input.odds.bookmakerNames,
      bookmakerCount: input.odds.bookmakerCount,
      marketCount: input.odds.marketCount,
      pct: input.odds.pct,
      classification: input.odds.classification,
      fieldPresence: input.odds.fieldPresence
    },
    latency: {
      ...summarizeLatencies(latencySamples),
      mode: getLatencyMode(input.asOf)
    },
    dataQuality: {
      missingCriticalFields: mergeMissingCriticalFields(input.scores, input.odds, input.fixtures),
      warnings: mergeWarnings(
        input.extraWarnings,
        input.fixtures.warnings,
        input.scores.warnings,
        input.odds.warnings
      )
    },
    payloads: {
      fixtures: input.fixtures.fixtureCount > 0 ? 1 : 0,
      scores: input.scores.payloadsFetched,
      odds: input.odds.payloadsFetched
    }
  };
}

async function safeStoreFinding(
  finding: TxlineAuditFindingDraft,
  auditRunId: string,
  createAuditFinding: typeof createTxlineAuditFinding = createTxlineAuditFinding
): Promise<StoredTxlineAuditFinding | null> {
  try {
    return await createAuditFinding(buildTxlineAuditFindingCreateData(toFinding(finding, auditRunId)));
  } catch {
    return null;
  }
}

async function safeStorePayload(
  auditRunId: string,
  input: Omit<Parameters<typeof buildTxlineRawPayloadCreateData>[0], "auditRunId">,
  storeRawPayload: typeof storeTxlineRawPayload = storeTxlineRawPayload
): Promise<StoredTxlineRawPayload | null> {
  try {
    return await storeRawPayload(buildTxlineRawPayloadCreateData({ auditRunId, ...input }));
  } catch {
    return null;
  }
}

function safeTxlineMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") return error.message;
  return "The TxLINE audit failed.";
}

async function runFixtureAudit(
  fetchFixtures: AuditFetchDependencies["fetchFixtures"],
  auditRunId: string,
  input: TxlineRuntimeAuditInput,
  receivedAt: Date,
  storeRawPayload: typeof storeTxlineRawPayload = storeTxlineRawPayload
): Promise<{
  analysis: ReturnType<typeof analyzeTxlineFixturesPayload>;
  rawPayload: StoredTxlineRawPayload | null;
  findings: TxlineAuditFindingDraft[];
}> {
  if (!input.includeFixtures) {
    return {
      analysis: {
        audit: {
          fixtureCount: 0,
          requestedFixtureIds: input.fixtureIds,
          foundFixtureIds: [],
          competitionIds: [],
          participantNames: [],
          startTimes: [],
          targetFixtureIdsPresent: [],
          providerTs: null,
          latencyMs: null,
          warnings: ["Fixture snapshot collection was disabled."]
        },
        findings: [],
        payloadShape: "disabled",
        payloadHash: hashTxlinePayload(null),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings: []
    };
  }

  try {
    const payload = await fetchFixtures({
      competitionId: String(input.competitionId),
      startEpochDay: input.startEpochDay
    });
    const analysis = analyzeTxlineFixturesPayload(payload, {
      requestedFixtureIds: input.fixtureIds,
      receivedAt
    });
    const rawPayload = await safeStorePayload(auditRunId, {
      endpointType: "fixtures_snapshot",
      endpointPath: "/fixtures/snapshot",
      fixtureId: null,
      competitionId: String(input.competitionId),
      startEpochDay: input.startEpochDay,
      asOf: null,
      providerTs: analysis.providerTs,
      receivedAt,
      storedAt: receivedAt,
      payloadHash: analysis.payloadHash,
      payloadJson: payload,
      metaJson: {
        payloadShape: analysis.payloadShape,
        fixtureCount: analysis.audit.fixtureCount
      }
    }, storeRawPayload);

    return { analysis, rawPayload, findings: analysis.findings };
  } catch (error) {
    const message = safeTxlineMessage(error);
    const findings: TxlineAuditFindingDraft[] = [
      {
        fixtureId: null,
        category: "txline_request",
        severity: "error",
        title: "TxLINE request failed",
        detailsJson: {
          endpointType: "fixtures_snapshot",
          asOf: null,
          message,
          reason: error instanceof TxlineLiveError ? error.safe.kind : "unknown",
          recoverable: true
        }
      }
    ];
    return {
      analysis: {
        audit: {
          fixtureCount: 0,
          requestedFixtureIds: input.fixtureIds,
          foundFixtureIds: [],
          competitionIds: [],
          participantNames: [],
          startTimes: [],
          targetFixtureIdsPresent: [],
          providerTs: null,
          latencyMs: null,
          warnings: [message]
        },
        findings,
        payloadShape: "error",
        payloadHash: hashTxlinePayload({ error: message, endpointType: "fixtures_snapshot" }),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings
    };
  }
}

async function runScoreAudit(
  fetchScores: AuditFetchDependencies["fetchScores"],
  auditRunId: string,
  input: TxlineRuntimeAuditInput,
  fixtureId: string,
  asOf: number,
  receivedAt: Date,
  storeRawPayload: typeof storeTxlineRawPayload = storeTxlineRawPayload
): Promise<{
  analysis: ReturnType<typeof analyzeTxlineScoresPayload>;
  rawPayload: StoredTxlineRawPayload | null;
  findings: TxlineAuditFindingDraft[];
}> {
  if (!input.includeScores) {
    return {
      analysis: {
        audit: {
          payloadsFetched: 0,
          latestSeq: null,
          possessionTypeValues: [],
          possibleEventFieldsFound: [],
          missingFields: [],
          fieldPresence: calcFieldPresence([], SCORE_FIELD_ALIASES),
          scorePayloadAvailable: false,
          possessionTypePresent: false,
          possibleEventPresent: false,
          providerTs: null,
          latencyMs: null,
          warnings: ["Score snapshot collection was disabled."]
        },
        findings: [],
        payloadShape: "disabled",
        payloadHash: hashTxlinePayload(null),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings: []
    };
  }

  try {
    const payload = await fetchScores({ fixtureId, asOf });
    const analysis = analyzeTxlineScoresPayload(payload, { fixtureId, receivedAt });
    const rawPayload = await safeStorePayload(auditRunId, {
      endpointType: "scores_snapshot",
      endpointPath: `/scores/snapshot/${fixtureId}`,
      fixtureId,
      competitionId: null,
      startEpochDay: null,
      asOf: new Date(asOf),
      providerTs: analysis.providerTs,
      receivedAt,
      storedAt: receivedAt,
      payloadHash: analysis.payloadHash,
      payloadJson: payload,
      metaJson: {
        payloadShape: analysis.payloadShape,
        scorePayloadAvailable: analysis.audit.scorePayloadAvailable
      }
    }, storeRawPayload);
    return { analysis, rawPayload, findings: analysis.findings };
  } catch (error) {
    const message = safeTxlineMessage(error);
    const findings: TxlineAuditFindingDraft[] = [
      {
        fixtureId,
        category: "txline_request",
        severity: "error",
        title: "TxLINE request failed",
        detailsJson: {
          endpointType: "scores_snapshot",
          fixtureId,
          asOf,
          message,
          reason: error instanceof TxlineLiveError ? error.safe.kind : "unknown",
          recoverable: true
        }
      }
    ];
    return {
      analysis: {
        audit: {
          payloadsFetched: 0,
          latestSeq: null,
          possessionTypeValues: [],
          possibleEventFieldsFound: [],
          missingFields: [],
          fieldPresence: calcFieldPresence([], SCORE_FIELD_ALIASES),
          scorePayloadAvailable: false,
          possessionTypePresent: false,
          possibleEventPresent: false,
          providerTs: null,
          latencyMs: null,
          warnings: [message]
        },
        findings,
        payloadShape: "error",
        payloadHash: hashTxlinePayload({ error: message, fixtureId }),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings
    };
  }
}

async function runOddsAudit(
  fetchOdds: AuditFetchDependencies["fetchOdds"],
  auditRunId: string,
  input: TxlineRuntimeAuditInput,
  fixtureId: string,
  asOf: number,
  receivedAt: Date,
  storeRawPayload: typeof storeTxlineRawPayload = storeTxlineRawPayload
): Promise<{
  analysis: ReturnType<typeof analyzeTxlineOddsPayload>;
  rawPayload: StoredTxlineRawPayload | null;
  findings: TxlineAuditFindingDraft[];
}> {
  if (!input.includeOdds) {
    return {
      analysis: {
        audit: {
          payloadsFetched: 0,
          bookmakerIds: [],
          bookmakerNames: [],
          bookmakerCount: 0,
          marketCount: 0,
          fieldPresence: calcFieldPresence([], ODDS_FIELD_ALIASES),
          pct: {
            numericCount: 0,
            naCount: 0,
            naRate: 0,
            pctSumMin: null,
            pctSumMax: null,
            pctSumAvg: null,
            pctSumCount: 0
          },
          classification: "unknown",
          providerTs: null,
          latencyMs: null,
          warnings: ["Odds snapshot collection was disabled."]
        },
        findings: [],
        payloadShape: "disabled",
        payloadHash: hashTxlinePayload(null),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings: []
    };
  }

  try {
    const payload = await fetchOdds({ fixtureId, asOf });
    const analysis = analyzeTxlineOddsPayload(payload, { fixtureId, receivedAt });
    const rawPayload = await safeStorePayload(auditRunId, {
      endpointType: "odds_snapshot",
      endpointPath: `/odds/snapshot/${fixtureId}`,
      fixtureId,
      competitionId: null,
      startEpochDay: null,
      asOf: new Date(asOf),
      providerTs: analysis.providerTs,
      receivedAt,
      storedAt: receivedAt,
      payloadHash: analysis.payloadHash,
      payloadJson: payload,
      metaJson: {
        payloadShape: analysis.payloadShape,
        bookmakerCount: analysis.audit.bookmakerCount,
        marketCount: analysis.audit.marketCount
      }
    }, storeRawPayload);
    return { analysis, rawPayload, findings: analysis.findings };
  } catch (error) {
    const message = safeTxlineMessage(error);
    const findings: TxlineAuditFindingDraft[] = [
      {
        fixtureId,
        category: "txline_request",
        severity: "error",
        title: "TxLINE request failed",
        detailsJson: {
          endpointType: "odds_snapshot",
          fixtureId,
          asOf,
          message,
          reason: error instanceof TxlineLiveError ? error.safe.kind : "unknown",
          recoverable: true
        }
      }
    ];
    return {
      analysis: {
        audit: {
          payloadsFetched: 0,
          bookmakerIds: [],
          bookmakerNames: [],
          bookmakerCount: 0,
          marketCount: 0,
          fieldPresence: calcFieldPresence([], ODDS_FIELD_ALIASES),
          pct: {
            numericCount: 0,
            naCount: 0,
            naRate: 0,
            pctSumMin: null,
            pctSumMax: null,
            pctSumAvg: null,
            pctSumCount: 0
          },
          classification: "unknown",
          providerTs: null,
          latencyMs: null,
          warnings: [message]
        },
        findings,
        payloadShape: "error",
        payloadHash: hashTxlinePayload({ error: message, fixtureId }),
        providerTs: null,
        latencyMs: null
      },
      rawPayload: null,
      findings
    };
  }
}

export async function runTxlineRuntimeAudit(
  input: TxlineRuntimeAuditInput,
  dependencies: AuditRuntimeDependencies = {}
): Promise<TxlineRuntimeAuditExecutionResult> {
  const now = dependencies.now ?? (() => new Date());
  const receivedAt = now();
  const globalAsOf = parseOptionalAsOf(input.asOf);
  const scoreAsOfByFixtureId = parseAsOfByFixtureId(input.scoreAsOfByFixtureId);
  const oddsAsOfByFixtureId = parseAsOfByFixtureId(input.oddsAsOfByFixtureId);
  const client = createTxlineLiveClient();
  const createAuditRun = dependencies.store?.createAuditRun ?? createTxlineAuditRun;
  const finalizeAuditRun = dependencies.store?.finalizeAuditRun ?? finalizeTxlineAuditRun;
  const createAuditFinding = dependencies.store?.createAuditFinding ?? createTxlineAuditFinding;
  const storeRawPayload = dependencies.store?.storeRawPayload ?? storeTxlineRawPayload;
  const fetchFixtures = dependencies.fetch?.fetchFixtures ?? ((params: { competitionId: string; startEpochDay: number }) => client.getFixtureSnapshot(params));
  const fetchScores = dependencies.fetch?.fetchScores ?? ((params: { fixtureId: string; asOf: number }) => client.getScoreSnapshot(params));
  const fetchOdds = dependencies.fetch?.fetchOdds ?? ((params: { fixtureId: string; asOf: number }) => client.getOddsSnapshot(params));
  const fixtureIds = input.fixtureIds
    .map((fixtureId) => parseFixtureId(fixtureId))
    .filter((fixtureId): fixtureId is string => fixtureId !== null);
  const run = await createAuditRun(buildTxlineAuditRunCreateData({
    fixtureIds,
    competitionIds: [String(input.competitionId)],
    notes: input.notes ?? null,
    startedAt: receivedAt,
    status: "running"
  }));

  const rawPayloads: StoredTxlineRawPayload[] = [];
  const findings: StoredTxlineAuditFinding[] = [];
  const allWarnings: string[] = [];
  const requestTracker = createRequestTracker();
  const scoreAudits: Array<Awaited<ReturnType<typeof runScoreAudit>>["analysis"]["audit"]> = [];
  const oddsAudits: Array<Awaited<ReturnType<typeof runOddsAudit>>["analysis"]["audit"]> = [];
  const fixtureAuditState: TxlineFixturesAudit = {
    fixtureCount: 0,
    requestedFixtureIds: fixtureIds,
    foundFixtureIds: [],
    competitionIds: [],
    participantNames: [],
    startTimes: [],
    targetFixtureIdsPresent: [],
    providerTs: null,
    latencyMs: null,
    warnings: input.includeFixtures ? [] : ["Fixture snapshot collection was disabled."]
  };
  const asOfState = {
    global: globalAsOf,
    scoreByFixtureId: scoreAsOfByFixtureId,
    oddsByFixtureId: oddsAsOfByFixtureId,
    missingScoreAsOfFixtureIds: [] as string[],
    missingOddsAsOfFixtureIds: [] as string[]
  };

  try {
    if (input.includeFixtures) {
      recordRequestAttempt(requestTracker);
      const fixtureResult = await runFixtureAudit(fetchFixtures, run.id, input, receivedAt, storeRawPayload);
      if (fixtureResult.analysis.payloadShape === "error") {
        recordRequestFailure(requestTracker, "fixtures_snapshot", fixtureResult.analysis.audit.warnings[0] ?? "The TxLINE audit failed.");
      } else {
        recordRequestSuccess(requestTracker);
        if (fixtureResult.rawPayload !== null) rawPayloads.push(fixtureResult.rawPayload);
        Object.assign(fixtureAuditState, fixtureResult.analysis.audit);
      }
      allWarnings.push(...fixtureResult.analysis.audit.warnings);
      for (const finding of fixtureResult.findings) {
        const stored = await safeStoreFinding(finding, run.id, createAuditFinding);
        if (stored !== null) findings.push(stored);
      }
    } else {
      recordRequestSkip(requestTracker, "fixtures_snapshot");
    }

    for (const fixtureId of fixtureIds) {
      const scoreAsOf = scoreAsOfByFixtureId[fixtureId] ?? globalAsOf;
      if (!input.includeScores) {
        recordRequestSkip(requestTracker, "scores_snapshot");
      } else if (scoreAsOf === null) {
        recordRequestSkip(requestTracker, "scores_snapshot");
        asOfState.missingScoreAsOfFixtureIds.push(fixtureId);
        const finding = createMissingAsOfFinding("scores_snapshot", fixtureId);
        const stored = await safeStoreFinding(finding, run.id, createAuditFinding);
        if (stored !== null) findings.push(stored);
      } else {
        recordRequestAttempt(requestTracker);
        const scoreResult = await runScoreAudit(fetchScores, run.id, input, fixtureId, scoreAsOf, receivedAt, storeRawPayload);
        scoreAudits.push(scoreResult.analysis.audit);
        if (scoreResult.analysis.payloadShape === "error") {
          recordRequestFailure(requestTracker, "scores_snapshot", scoreResult.analysis.audit.warnings[0] ?? "The TxLINE audit failed.");
        } else {
          recordRequestSuccess(requestTracker);
          if (scoreResult.rawPayload !== null) rawPayloads.push(scoreResult.rawPayload);
        }
        allWarnings.push(...scoreResult.analysis.audit.warnings);
        for (const finding of scoreResult.findings) {
          const stored = await safeStoreFinding(finding, run.id, createAuditFinding);
          if (stored !== null) findings.push(stored);
        }
      }

      const oddsAsOf = oddsAsOfByFixtureId[fixtureId] ?? globalAsOf;
      if (!input.includeOdds) {
        recordRequestSkip(requestTracker, "odds_snapshot");
      } else if (oddsAsOf === null) {
        recordRequestSkip(requestTracker, "odds_snapshot");
        asOfState.missingOddsAsOfFixtureIds.push(fixtureId);
        const finding = createMissingAsOfFinding("odds_snapshot", fixtureId);
        const stored = await safeStoreFinding(finding, run.id);
        if (stored !== null) findings.push(stored);
      } else {
        recordRequestAttempt(requestTracker);
        const oddsResult = await runOddsAudit(fetchOdds, run.id, input, fixtureId, oddsAsOf, receivedAt, storeRawPayload);
        oddsAudits.push(oddsResult.analysis.audit);
        if (oddsResult.analysis.payloadShape === "error") {
          recordRequestFailure(requestTracker, "odds_snapshot", oddsResult.analysis.audit.warnings[0] ?? "The TxLINE audit failed.");
        } else {
          recordRequestSuccess(requestTracker);
          if (oddsResult.rawPayload !== null) rawPayloads.push(oddsResult.rawPayload);
        }
        allWarnings.push(...oddsResult.analysis.audit.warnings);
        for (const finding of oddsResult.findings) {
          const stored = await safeStoreFinding(finding, run.id, createAuditFinding);
          if (stored !== null) findings.push(stored);
        }
      }
    }

    const mergedScores = scoreAudits.reduce<TxlineScoresAudit>(
      (accumulator, current) => ({
        payloadsFetched: accumulator.payloadsFetched + current.payloadsFetched,
        latestSeq: Math.max(accumulator.latestSeq ?? Number.NEGATIVE_INFINITY, current.latestSeq ?? Number.NEGATIVE_INFINITY) === Number.NEGATIVE_INFINITY
          ? null
          : Math.max(accumulator.latestSeq ?? Number.NEGATIVE_INFINITY, current.latestSeq ?? Number.NEGATIVE_INFINITY),
        possessionTypeValues: [...new Set([...accumulator.possessionTypeValues, ...current.possessionTypeValues])],
        possibleEventFieldsFound: [...new Set([...accumulator.possibleEventFieldsFound, ...current.possibleEventFieldsFound])],
        missingFields: [...new Set([...accumulator.missingFields, ...current.missingFields])],
        fieldPresence: mergeFieldPresenceMaps(accumulator.fieldPresence, current.fieldPresence),
        scorePayloadAvailable: accumulator.scorePayloadAvailable || current.scorePayloadAvailable,
        possessionTypePresent: accumulator.possessionTypePresent || current.possessionTypePresent,
        possibleEventPresent: accumulator.possibleEventPresent || current.possibleEventPresent,
        providerTs: accumulator.providerTs,
        latencyMs: accumulator.latencyMs,
        warnings: [...new Set([...accumulator.warnings, ...current.warnings])]
      }),
      {
        payloadsFetched: 0,
        latestSeq: null,
        possessionTypeValues: [],
        possibleEventFieldsFound: [],
        missingFields: [],
        fieldPresence: calcFieldPresence([], SCORE_FIELD_ALIASES),
        scorePayloadAvailable: false,
        possessionTypePresent: false,
        possibleEventPresent: false,
        providerTs: null,
        latencyMs: null,
        warnings: []
      }
    );
    const mergedOdds = oddsAudits.reduce<TxlineOddsAudit>(
      (accumulator, current) => ({
        payloadsFetched: accumulator.payloadsFetched + current.payloadsFetched,
        bookmakerIds: [...new Set([...accumulator.bookmakerIds, ...current.bookmakerIds])],
        bookmakerNames: [...new Set([...accumulator.bookmakerNames, ...current.bookmakerNames])],
        bookmakerCount: 0,
        marketCount: accumulator.marketCount + current.marketCount,
        fieldPresence: mergeFieldPresenceMaps(accumulator.fieldPresence, current.fieldPresence),
        pct: {
          numericCount: accumulator.pct.numericCount + current.pct.numericCount,
          naCount: accumulator.pct.naCount + current.pct.naCount,
          naRate: 0,
          pctSumMin: accumulator.pct.pctSumMin === null
            ? current.pct.pctSumMin
            : current.pct.pctSumMin === null
              ? accumulator.pct.pctSumMin
              : Math.min(accumulator.pct.pctSumMin, current.pct.pctSumMin),
          pctSumMax: accumulator.pct.pctSumMax === null
            ? current.pct.pctSumMax
            : current.pct.pctSumMax === null
              ? accumulator.pct.pctSumMax
              : Math.max(accumulator.pct.pctSumMax, current.pct.pctSumMax),
          pctSumAvg: null,
          pctSumCount: accumulator.pct.pctSumCount + current.pct.pctSumCount
        },
        classification: "unknown",
        providerTs: accumulator.providerTs,
        latencyMs: accumulator.latencyMs,
        warnings: [...new Set([...accumulator.warnings, ...current.warnings])]
      }),
      {
        payloadsFetched: 0,
        bookmakerIds: [],
        bookmakerNames: [],
        bookmakerCount: 0,
        marketCount: 0,
        fieldPresence: calcFieldPresence([], ODDS_FIELD_ALIASES),
        pct: {
          numericCount: 0,
          naCount: 0,
          naRate: 0,
          pctSumMin: null,
          pctSumMax: null,
          pctSumAvg: null,
          pctSumCount: 0
        },
        classification: "unknown",
        providerTs: null,
        latencyMs: null,
        warnings: []
      }
    );

    mergedScores.missingFields = Object.entries(mergedScores.fieldPresence)
      .filter(([, presence]) => presence.present === 0)
      .map(([field]) => field);
    mergedScores.possessionTypePresent = (mergedScores.fieldPresence.possessionType?.present ?? 0) > 0;
    mergedScores.possibleEventPresent = (mergedScores.fieldPresence.possibleEvent?.present ?? 0) > 0;

    mergedOdds.bookmakerCount = mergedOdds.bookmakerIds.length > 0
      ? mergedOdds.bookmakerIds.length
      : mergedOdds.bookmakerNames.length;
    mergedOdds.classification = classifyBookmakers(mergedOdds.bookmakerIds, mergedOdds.bookmakerNames);
    mergedOdds.pct.naRate = mergedOdds.pct.numericCount + mergedOdds.pct.naCount === 0
      ? 0
      : mergedOdds.pct.naCount / (mergedOdds.pct.numericCount + mergedOdds.pct.naCount);
    const totalValidPctRows = oddsAudits.reduce((accumulator, audit) => accumulator + audit.pct.pctSumCount, 0);
    const weightedPctSum = oddsAudits.reduce((accumulator, audit) => accumulator + ((audit.pct.pctSumAvg ?? 0) * audit.pct.pctSumCount), 0);
    mergedOdds.pct.pctSumAvg = totalValidPctRows > 0 ? weightedPctSum / totalValidPctRows : null;

    const latencySamples = [
      fixtureAuditState.latencyMs,
      ...scoreAudits.map((audit) => audit.latencyMs),
      ...oddsAudits.map((audit) => audit.latencyMs)
    ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const summaryWarnings = [...new Set([...allWarnings])];
    const status: TxlineRuntimeAuditSummary["status"] = requestTracker.succeeded > 0
      ? (requestTracker.failed > 0 || requestTracker.skipped > 0 || summaryWarnings.length > 0
        ? "completed_with_warnings"
        : "completed")
      : "failed";

    const summary = buildTxlineRuntimeAuditSummary({
      auditRunId: run.id,
      status,
      requests: requestTracker,
      asOf: asOfState,
      fixtures: fixtureAuditState,
      scores: mergedScores,
      odds: mergedOdds,
      fixtureIds,
      latencySamples,
      extraWarnings: summaryWarnings
    });

    const finished = await finalizeAuditRun({
      auditRunId: run.id,
      status,
      finishedAt: now(),
      summaryJson: summary
    });
    return {
      audit_run: finished,
      raw_payloads: rawPayloads,
      findings,
      summary
    };
  } catch (error) {
    const message = safeTxlineMessage(error);
    const errorRun = await finalizeAuditRun({
      auditRunId: run.id,
      status: "failed",
      finishedAt: now(),
      summaryJson: null,
      errorJson: { message }
    });
    return {
      audit_run: errorRun,
      raw_payloads: rawPayloads,
      findings,
      summary: {
        auditRunId: run.id,
        status: "failed",
        requests: createRequestTracker(),
        asOf: {
          global: globalAsOf,
          scoreByFixtureId: scoreAsOfByFixtureId,
          oddsByFixtureId: oddsAsOfByFixtureId,
          missingScoreAsOfFixtureIds: asOfState.missingScoreAsOfFixtureIds,
          missingOddsAsOfFixtureIds: asOfState.missingOddsAsOfFixtureIds
        },
        fixtures: {
          requestedFixtureIds: fixtureIds,
          foundFixtureIds: [],
          fixtureCount: 0,
          competitionIds: [],
          participantNames: [],
          startTimes: [],
          targetFixtureIdsPresent: []
        },
        scores: {
          payloadsFetched: 0,
          possessionTypeValues: [],
          possibleEventFieldsFound: [],
          missingFields: [],
          fieldPresence: calcFieldPresence([], SCORE_FIELD_ALIASES),
          latestSeq: null,
          scorePayloadAvailable: false,
          possessionTypePresent: false,
          possibleEventPresent: false
        },
        odds: {
          payloadsFetched: 0,
          bookmakerIds: [],
          bookmakerNames: [],
          bookmakerCount: 0,
          marketCount: 0,
          fieldPresence: calcFieldPresence([], ODDS_FIELD_ALIASES),
          pct: {
            numericCount: 0,
            naCount: 0,
            naRate: 0,
            pctSumMin: null,
            pctSumMax: null,
            pctSumAvg: null,
            pctSumCount: 0
          },
          classification: "unknown"
        },
        latency: {
          samples: 0,
          p50Ms: null,
          p95Ms: null,
          maxMs: null,
          mode: getLatencyMode(asOfState)
        },
        dataQuality: {
          missingCriticalFields: [],
          warnings: [message]
        },
        payloads: {
          fixtures: 0,
          scores: 0,
          odds: 0
        }
      }
    };
  }
}

export async function getTxlineRuntimeAuditById(auditRunId: string) {
  return getTxlineAuditRunDetails(auditRunId);
}
