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

  app.get("/api/internal/agent/matches/:fixtureId/brief", async (request) => {
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
      const output = {
        data: {
          fixture_id: fixtureId,
          agent_version: "presenter-v0" as const,
          brief: {
            status_label: "empty" as const,
            headline: "No persisted match data is available.",
            overview: "The system does not have enough persisted data to build a brief.",
            available_data: [],
            missing_data: [
              "Fixture identity is missing.",
              "Scoreboard data is missing.",
              "Odds data is missing."
            ],
            freshness_note: "No latest data timestamp is available.",
            quality_notes: ["No canonical match data is currently available."],
            safe_scope_note:
              "This brief only describes data availability, freshness, and quality. It does not provide predictions, probabilities, recommendations, or betting guidance."
          },
          signal_summary: {
            status: "empty" as const,
            signal_count: 0,
            critical_count: 0,
            warning_count: 0,
            info_count: 0,
            has_fixture: false,
            has_scoreboard: false,
            has_odds: false,
            latest_data_timestamp: null
          },
          signals: []
        },
        meta: {
          status: "no_data" as const,
          source: "agent-presenter" as const,
          mode: "internal" as const
        }
      };
      assertNoForbiddenSignalFields(output);
      return output;
    }
  });
}
