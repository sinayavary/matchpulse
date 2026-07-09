import { Prisma } from "@prisma/client";
import { getDbClient } from "./db.js";
import type {
  TxlineAuditFindingCategory,
  TxlineAuditSeverity,
  TxlineRuntimeEndpointType
} from "./txline-runtime-audit.js";

export type StoredTxlineAuditRun = {
  id: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  fixtureIds: unknown;
  competitionIds: unknown;
  notes: string | null;
  summaryJson: unknown;
  errorJson: unknown;
};

export type StoredTxlineRawPayload = {
  id: string;
  auditRunId: string;
  endpointType: string;
  endpointPath: string;
  fixtureId: string | null;
  competitionId: string | null;
  startEpochDay: number | null;
  asOf: Date | null;
  providerTs: Date | null;
  receivedAt: Date;
  storedAt: Date;
  payloadHash: string;
  payloadJson: unknown;
  metaJson: unknown;
};

export type StoredTxlineAuditFinding = {
  id: string;
  auditRunId: string;
  fixtureId: string | null;
  category: string;
  severity: string;
  title: string;
  detailsJson: unknown;
  createdAt: Date;
};

type AuditRunCreateInput = {
  fixtureIds: string[];
  competitionIds: Array<string | number>;
  notes?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  status?: string;
  summaryJson?: unknown;
  errorJson?: unknown;
};

type RawPayloadCreateInput = {
  auditRunId: string;
  endpointType: TxlineRuntimeEndpointType;
  endpointPath: string;
  fixtureId: string | null;
  competitionId: string | null;
  startEpochDay: number | null;
  asOf: Date | null;
  providerTs: Date | null;
  receivedAt: Date;
  storedAt: Date;
  payloadHash: string;
  payloadJson: unknown;
  metaJson: unknown;
};

type AuditFindingCreateInput = {
  auditRunId: string;
  fixtureId: string | null;
  category: TxlineAuditFindingCategory;
  severity: TxlineAuditSeverity;
  title: string;
  detailsJson: unknown;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  try {
    return jsonClone(value) as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}

export function buildTxlineAuditRunCreateData(input: AuditRunCreateInput): Prisma.TxlineAuditRunUncheckedCreateInput {
  return {
    status: input.status ?? "running",
    startedAt: input.startedAt ?? new Date(),
    finishedAt: input.finishedAt ?? null,
    fixtureIds: input.fixtureIds,
    competitionIds: input.competitionIds,
    notes: input.notes ?? null,
    summaryJson: input.summaryJson === undefined ? Prisma.JsonNull : safeJson(input.summaryJson),
    errorJson: input.errorJson === undefined ? Prisma.JsonNull : safeJson(input.errorJson)
  };
}

export function buildTxlineRawPayloadCreateData(
  input: RawPayloadCreateInput
): Prisma.TxlineRawPayloadUncheckedCreateInput {
  const payloadJson = safeJson(input.payloadJson);
  const metaJson = safeJson(input.metaJson);

  return {
    auditRunId: input.auditRunId,
    endpointType: input.endpointType,
    endpointPath: input.endpointPath,
    fixtureId: input.fixtureId,
    competitionId: input.competitionId,
    startEpochDay: input.startEpochDay,
    asOf: input.asOf,
    providerTs: input.providerTs,
    receivedAt: input.receivedAt,
    storedAt: input.storedAt,
    payloadHash: input.payloadHash,
    payloadJson,
    metaJson
  };
}

export function buildTxlineAuditFindingCreateData(
  input: AuditFindingCreateInput
): Prisma.TxlineAuditFindingUncheckedCreateInput {
  const detailsJson = safeJson(input.detailsJson);
  return {
    auditRunId: input.auditRunId,
    fixtureId: input.fixtureId,
    category: input.category,
    severity: input.severity,
    title: input.title,
    detailsJson
  };
}

export async function createTxlineAuditRun(
  input: ReturnType<typeof buildTxlineAuditRunCreateData>
): Promise<StoredTxlineAuditRun> {
  return getDbClient().txlineAuditRun.create({
    data: input,
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      fixtureIds: true,
      competitionIds: true,
      notes: true,
      summaryJson: true,
      errorJson: true
    }
  });
}

export async function finalizeTxlineAuditRun(input: {
  auditRunId: string;
  status: string;
  finishedAt: Date;
  summaryJson?: unknown;
  errorJson?: unknown;
}): Promise<StoredTxlineAuditRun> {
  return getDbClient().txlineAuditRun.update({
    where: { id: input.auditRunId },
    data: {
      status: input.status,
      finishedAt: input.finishedAt,
      ...(input.summaryJson === undefined ? {} : { summaryJson: safeJson(input.summaryJson) }),
      ...(input.errorJson === undefined ? {} : { errorJson: safeJson(input.errorJson) })
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      fixtureIds: true,
      competitionIds: true,
      notes: true,
      summaryJson: true,
      errorJson: true
    }
  });
}

export async function storeTxlineRawPayload(
  input: ReturnType<typeof buildTxlineRawPayloadCreateData>
): Promise<StoredTxlineRawPayload> {
  return getDbClient().txlineRawPayload.create({
    data: input,
    select: {
      id: true,
      auditRunId: true,
      endpointType: true,
      endpointPath: true,
      fixtureId: true,
      competitionId: true,
      startEpochDay: true,
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

export async function createTxlineAuditFinding(
  input: ReturnType<typeof buildTxlineAuditFindingCreateData>
): Promise<StoredTxlineAuditFinding> {
  return getDbClient().txlineAuditFinding.create({
    data: input,
    select: {
      id: true,
      auditRunId: true,
      fixtureId: true,
      category: true,
      severity: true,
      title: true,
      detailsJson: true,
      createdAt: true
    }
  });
}

export async function getTxlineAuditRunDetails(auditRunId: string) {
  const auditRun = await getDbClient().txlineAuditRun.findUnique({
    where: { id: auditRunId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      fixtureIds: true,
      competitionIds: true,
      notes: true,
      summaryJson: true,
      errorJson: true,
      rawPayloads: {
        orderBy: { storedAt: "asc" },
        select: {
          id: true,
          auditRunId: true,
          endpointType: true,
          endpointPath: true,
          fixtureId: true,
          competitionId: true,
          startEpochDay: true,
          asOf: true,
          providerTs: true,
          receivedAt: true,
          storedAt: true,
          payloadHash: true,
          metaJson: true
        }
      },
      findings: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          auditRunId: true,
          fixtureId: true,
          category: true,
          severity: true,
          title: true,
          detailsJson: true,
          createdAt: true
        }
      }
    }
  });

  return auditRun;
}
