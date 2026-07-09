import type { FastifyInstance } from "fastify";
import { getTxlineConfigFromEnv } from "@matchpulse/txline-client";
import {
  getTxlineRuntimeAuditById,
  runTxlineRuntimeAudit
} from "./txline-runtime-audit.js";

function readBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return defaultValue;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : ""))
    .filter((item) => item.length > 0);
}

function normalizeCompetitionId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

function normalizeAsOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeAsOfByFixtureId(value: unknown): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [fixtureId, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const parsed = normalizeAsOf(rawValue);
    if (parsed !== null) {
      result[fixtureId] = parsed;
    }
  }
  return result;
}

export function registerTxlineRuntimeAuditRoutes(app: FastifyInstance): void {
  app.post("/api/internal/txline/audit/runtime", async (request) => {
    const config = getTxlineConfigFromEnv();
    const body = request.body as Record<string, unknown> | undefined;
    const fixtureIds = readStringArray(body?.fixtureIds);
    const competitionId = normalizeCompetitionId(body?.competitionId);
    const startEpochDay = typeof body?.startEpochDay === "number" && Number.isInteger(body.startEpochDay)
      ? body.startEpochDay
      : Number.NaN;
    const includeFixtures = readBoolean(body?.includeFixtures, true);
    const includeScores = readBoolean(body?.includeScores, true);
    const includeOdds = readBoolean(body?.includeOdds, true);
    const asOf = normalizeAsOf(body?.asOf);
    const scoreAsOfByFixtureId = normalizeAsOfByFixtureId(body?.scoreAsOfByFixtureId);
    const oddsAsOfByFixtureId = normalizeAsOfByFixtureId(body?.oddsAsOfByFixtureId);
    const notes = typeof body?.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

    if (competitionId === null || !Number.isInteger(startEpochDay) || startEpochDay < 0) {
      return {
        data: null,
        meta: {
          status: "error" as const,
          source: "backend" as const,
          mode: "internal" as const,
          message: "competitionId and startEpochDay are required."
        }
      };
    }

    if (config.dataMode === "mock") {
      return {
        data: null,
        meta: {
          status: "error" as const,
          source: "backend" as const,
          mode: "internal" as const,
          message: "Runtime audit requires live or auto TxLINE mode."
        }
      };
    }

    if (!config.guestJwtConfigured || !config.apiTokenConfigured) {
      return {
        data: null,
        meta: {
          status: "error" as const,
          source: "backend" as const,
          mode: "internal" as const,
          message: "TxLINE guest JWT and API token must both be configured before running the runtime audit."
        }
      };
    }

    const result = await runTxlineRuntimeAudit({
      fixtureIds,
      competitionId,
      startEpochDay,
      includeFixtures,
      includeScores,
      includeOdds,
      asOf,
      scoreAsOfByFixtureId,
      oddsAsOfByFixtureId,
      notes
    });

    return {
      data: result,
      meta: {
        status: "live" as const,
        source: "backend" as const,
        mode: "internal" as const
      }
    };
  });

  app.get("/api/internal/txline/audit/runtime/:auditRunId", async (request) => {
    const { auditRunId } = request.params as { auditRunId: string };
    const auditRun = await getTxlineRuntimeAuditById(auditRunId);

    if (auditRun === null) {
      return {
        data: null,
        meta: {
          status: "no_data" as const,
          source: "backend" as const,
          mode: "internal" as const,
          message: "Audit run not found."
        }
      };
    }

    return {
      data: {
        audit_run: auditRun,
        raw_payloads: auditRun.rawPayloads,
        findings: auditRun.findings,
        summary: auditRun.summaryJson
      },
      meta: {
        status: "live" as const,
        source: "backend" as const,
        mode: "internal" as const
      }
    };
  });
}
