import { getDbClient } from "./db.js";
import {
  buildPressureEngineV1Hint,
  type PressureEngineV1Options,
  type PressureEngineV1Output
} from "./pressure-engine-v1.js";

export type StoredScoreSnapshotPayload = {
  id: string;
  fixtureId: string | null;
  endpointType: string;
  endpointPath: string;
  asOf: Date | null;
  providerTs: Date | null;
  receivedAt: Date;
  storedAt: Date;
  payloadHash: string;
  payloadJson: unknown;
  metaJson: unknown;
};

export type PressureEngineV1AdapterStatus =
  | "available"
  | "unavailable"
  | "error";

export type PressureEngineV1AdapterOutput = {
  adapter_version: "pressure-v1-stored-payload-adapter";
  fixture_id: string;
  status: PressureEngineV1AdapterStatus;
  source: "txline_raw_payloads";
  payload: {
    found: boolean;
    id: string | null;
    endpoint_type: string | null;
    endpoint_path: string | null;
    as_of: string | null;
    provider_ts: string | null;
    received_at: string | null;
    stored_at: string | null;
    payload_hash: string | null;
    extracted_record_count: number;
  };
  pressure: PressureEngineV1Output;
  limitations: string[];
  safe_scope_note: string;
};

export type PressureEngineV1AdapterOptions = PressureEngineV1Options & {
  maxPayloadAgeMinutes?: number;
};

export type PressureEngineV1AdapterDependencies = {
  getLatestScoreSnapshotPayload?: (
    fixtureId: string
  ) => Promise<StoredScoreSnapshotPayload | null>;
};

const SAFE_SCOPE_NOTE =
  "This adapter reads stored TxLINE score snapshot payloads and returns a rule-based pressure hint. It does not call live APIs, write data, predict outcomes, produce probabilities, or provide betting guidance.";

const SCORE_LIKE_KEYS = [
  "Seq",
  "seq",
  "Ts",
  "ts",
  "Score",
  "score",
  "ScoreSoccer",
  "scoreSoccer",
  "DataSoccer",
  "dataSoccer",
  "Possession",
  "possession",
  "PossessionType",
  "possessionType",
  "GameState",
  "gameState"
] as const;

const PAYLOAD_CONTAINER_KEYS = [
  "data",
  "items",
  "records",
  "payload",
  "result"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScoreLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return SCORE_LIKE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function toIsoString(value: Date | null): string | null {
  if (!(value instanceof Date)) return null;

  const time = value.getTime();
  return Number.isFinite(time) ? value.toISOString() : null;
}

function readPositiveFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function clampMaxPayloadAgeMinutes(value: unknown): number | null {
  const raw = readPositiveFiniteNumber(value);
  if (raw === null) return null;

  return Math.min(10080, Math.max(1, Math.trunc(raw)));
}

function appendUnique(target: string[], items: string[]): void {
  for (const item of items) {
    if (!target.includes(item)) target.push(item);
  }
}

function collectScoreLikeRecordsFromArray(
  value: unknown[],
  collected: unknown[]
): void {
  for (const item of value) {
    if (isScoreLikeRecord(item)) {
      collected.push(item);
    }
  }
}

function scanObjectForScoreLikeRecords(
  value: Record<string, unknown>,
  collected: unknown[],
  depth: number
): void {
  for (const [key, nestedValue] of Object.entries(value)) {
    if (Array.isArray(nestedValue)) {
      collectScoreLikeRecordsFromArray(nestedValue, collected);
      continue;
    }

    if (depth === 0 && isRecord(nestedValue)) {
      for (const [nestedKey, nestedArrayCandidate] of Object.entries(nestedValue)) {
        if (Array.isArray(nestedArrayCandidate)) {
          collectScoreLikeRecordsFromArray(nestedArrayCandidate, collected);
        }
      }
    }

    if (depth === 0 && PAYLOAD_CONTAINER_KEYS.includes(key as (typeof PAYLOAD_CONTAINER_KEYS)[number])) {
      if (Array.isArray(nestedValue)) {
        collectScoreLikeRecordsFromArray(nestedValue, collected);
      }
    }
  }
}

export function extractScoreRecordsFromStoredPayload(payload: unknown): unknown[] {
  const collected: unknown[] = [];

  if (Array.isArray(payload)) {
    collectScoreLikeRecordsFromArray(payload, collected);
    return collected;
  }

  if (isRecord(payload)) {
    scanObjectForScoreLikeRecords(payload, collected, 0);
  }

  return collected;
}

async function getLatestScoreSnapshotPayloadFromDb(
  fixtureId: string
): Promise<StoredScoreSnapshotPayload | null> {
  return getDbClient().txlineRawPayload.findFirst({
    where: {
      fixtureId,
      endpointType: "scores_snapshot"
    },
    orderBy: [
      { providerTs: "desc" },
      { receivedAt: "desc" },
      { storedAt: "desc" }
    ],
    select: {
      id: true,
      fixtureId: true,
      endpointType: true,
      endpointPath: true,
      asOf: true,
      providerTs: true,
      receivedAt: true,
      storedAt: true,
      payloadHash: true,
      payloadJson: true,
      metaJson: true
    }
  });
}

function buildPayloadMetadata(payload: StoredScoreSnapshotPayload | null): PressureEngineV1AdapterOutput["payload"] {
  if (payload === null) {
    return {
      found: false,
      id: null,
      endpoint_type: null,
      endpoint_path: null,
      as_of: null,
      provider_ts: null,
      received_at: null,
      stored_at: null,
      payload_hash: null,
      extracted_record_count: 0
    };
  }

  return {
    found: true,
    id: payload.id,
    endpoint_type: payload.endpointType,
    endpoint_path: payload.endpointPath,
    as_of: toIsoString(payload.asOf),
    provider_ts: toIsoString(payload.providerTs),
    received_at: toIsoString(payload.receivedAt),
    stored_at: toIsoString(payload.storedAt),
    payload_hash: payload.payloadHash,
    extracted_record_count: 0
  };
}

function mergeLimitations(...groups: string[][]): string[] {
  const limitations: string[] = [];
  for (const group of groups) {
    appendUnique(limitations, group);
  }
  return limitations;
}

function buildAdapterOutput(input: {
  fixtureId: string;
  status: PressureEngineV1AdapterStatus;
  payload: PressureEngineV1AdapterOutput["payload"];
  pressure: PressureEngineV1Output;
  limitations: string[];
}): PressureEngineV1AdapterOutput {
  return {
    adapter_version: "pressure-v1-stored-payload-adapter",
    fixture_id: input.fixtureId,
    status: input.status,
    source: "txline_raw_payloads",
    payload: input.payload,
    pressure: input.pressure,
    limitations: input.limitations,
    safe_scope_note: SAFE_SCOPE_NOTE
  };
}

export async function getPressureEngineV1FromStoredScores(
  fixtureId: string,
  options?: PressureEngineV1AdapterOptions,
  dependencies?: PressureEngineV1AdapterDependencies
): Promise<PressureEngineV1AdapterOutput> {
  const trimmedFixtureId = typeof fixtureId === "string" ? fixtureId.trim() : "";
  const pressureOptions = options === undefined ? undefined : { ...options };
  const maxPayloadAgeMinutes = clampMaxPayloadAgeMinutes(options?.maxPayloadAgeMinutes);
  const resolvedDependencies = dependencies ?? {};
  const fetchLatestPayload =
    resolvedDependencies.getLatestScoreSnapshotPayload ?? getLatestScoreSnapshotPayloadFromDb;

  if (trimmedFixtureId.length === 0) {
    const pressure = buildPressureEngineV1Hint([], pressureOptions);
    return buildAdapterOutput({
      fixtureId: "",
      status: "error",
      payload: {
        found: false,
        id: null,
        endpoint_type: null,
        endpoint_path: null,
        as_of: null,
        provider_ts: null,
        received_at: null,
        stored_at: null,
        payload_hash: null,
        extracted_record_count: 0
      },
      pressure,
      limitations: mergeLimitations(["Invalid fixture id."], pressure.limitations)
    });
  }

  try {
    const latestPayload = await fetchLatestPayload(trimmedFixtureId);

    if (latestPayload === null) {
      const pressure = buildPressureEngineV1Hint([], pressureOptions);
      return buildAdapterOutput({
        fixtureId: trimmedFixtureId,
        status: "unavailable",
        payload: buildPayloadMetadata(null),
        pressure,
        limitations: mergeLimitations(
          ["No stored scores_snapshot payload was found for this fixture."],
          pressure.limitations
        )
      });
    }

    const extractedRecords = extractScoreRecordsFromStoredPayload(latestPayload.payloadJson);
    const pressure = buildPressureEngineV1Hint(extractedRecords, pressureOptions);
    const extractedRecordCount = extractedRecords.length;
    const payload = {
      ...buildPayloadMetadata(latestPayload),
      extracted_record_count: extractedRecordCount
    };
    const freshnessLimitations: string[] = [];
    if (maxPayloadAgeMinutes !== null && latestPayload.storedAt instanceof Date) {
      const ageMinutes = (Date.now() - latestPayload.storedAt.getTime()) / 60_000;
      if (Number.isFinite(ageMinutes) && ageMinutes > maxPayloadAgeMinutes) {
        freshnessLimitations.push(
          "Stored score snapshot payload is older than the requested freshness window."
        );
      }
    }

    if (extractedRecordCount === 0) {
      return buildAdapterOutput({
        fixtureId: trimmedFixtureId,
        status: "unavailable",
        payload,
        pressure,
        limitations: mergeLimitations(
          ["Stored score snapshot payload did not contain score-like records."],
          freshnessLimitations,
          pressure.limitations
        )
      });
    }

    return buildAdapterOutput({
      fixtureId: trimmedFixtureId,
      status: pressure.status === "unavailable" ? "unavailable" : "available",
      payload,
      pressure,
      limitations: mergeLimitations(freshnessLimitations, pressure.limitations)
    });
  } catch {
    const pressure = buildPressureEngineV1Hint([], pressureOptions);
    return buildAdapterOutput({
      fixtureId: trimmedFixtureId,
      status: "error",
      payload: buildPayloadMetadata(null),
      pressure,
      limitations: mergeLimitations(
        ["Failed to read stored score snapshot payload."],
        pressure.limitations
      )
    });
  }
}
