import type { FastifyInstance } from "fastify";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  getAgentPresenterBriefForFixture,
  type AgentPresenterOptions,
  type AgentPresenterResponse
} from "./agent-presenter-v0.js";

type InternalAgentPresenterRouteDeps = {
  getAgentPresenterBriefForFixture?: (
    fixtureId: string,
    options?: AgentPresenterOptions
  ) => Promise<AgentPresenterResponse>;
};

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined;
}

export function registerInternalAgentPresenterRoute(
  app: FastifyInstance,
  deps: InternalAgentPresenterRouteDeps = {}
): void {
  const getAgentPresenterBriefForFixtureImpl =
    deps.getAgentPresenterBriefForFixture ?? getAgentPresenterBriefForFixture;

  app.get("/api/internal/agent/matches/:fixtureId/brief", async (request, reply) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const query = request.query as {
      includeState?: unknown;
      includePressure?: unknown;
      includeOddsReliability?: unknown;
      includeEventImpact?: unknown;
      oddsLimit?: unknown;
      staleAfterMinutes?: unknown;
      pressureWindowSize?: unknown;
      pressureMaxEvidence?: unknown;
      pressureMaxPayloadAgeMinutes?: unknown;
      format?: unknown;
    };

    const includeState = readBoolean(query.includeState);
    const includePressure = readBoolean(query.includePressure);
    const includeOddsReliability = readBoolean(query.includeOddsReliability);
    const includeEventImpact = readBoolean(query.includeEventImpact);
    const oddsLimit = readNumber(query.oddsLimit);
    const staleAfterMinutes = readNumber(query.staleAfterMinutes);
    const pressureWindowSize = readNumber(query.pressureWindowSize);
    const pressureMaxEvidence = readNumber(query.pressureMaxEvidence);
    const pressureMaxPayloadAgeMinutes = readNumber(query.pressureMaxPayloadAgeMinutes);
    const format = query.format === "full" ? "full" : "compact";

    try {
      const output = await getAgentPresenterBriefForFixtureImpl(fixtureId, {
        includeState,
        includePressure,
        includeOddsReliability,
        includeEventImpact,
        oddsLimit,
        staleAfterMinutes,
        pressureWindowSize,
        pressureMaxEvidence,
        pressureMaxPayloadAgeMinutes,
        format
      });
      assertNoForbiddenSignalFields(output);
      return output;
    } catch {
      request.log.warn({ event: "agent_presenter_unavailable", fixture_id: fixtureId }, "Agent presenter dependency failed");
      reply.code(503);
      return {
        data: null,
        meta: {
          status: "unavailable" as const,
          source: "agent-presenter" as const,
          mode: "internal" as const,
          code: "agent_presenter_unavailable"
        }
      };
    }
  });
}
