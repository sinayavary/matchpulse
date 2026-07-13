import type { FastifyInstance } from "fastify";
import { verifyInternalRouteAuth } from "./internal-auth.js";
import {
  buildPublicMarketIntelligence,
  PUBLIC_MARKET_SAFETY_NOTE,
} from "./odds-intelligence-contract.js";
import {
  normalizeCompetitionPredictionRouteQuery,
  toCompetitionPredictionInternalRouteResponse,
  toCompetitionPredictionPublicRouteResponse,
  type CompetitionPredictionRouteFailure,
} from "./competition-prediction-route-contract.js";
import {
  getCompetitionPredictionForFixture,
  type CompetitionPredictionRuntimeResult,
} from "./competition-prediction-service.js";
import {
  COMPETITION_REPLAY_FIXTURE_ID,
  getCompetitionReplayCheckpoint,
  listCompetitionReplayCheckpoints,
} from "./competition-replay-fixtures.js";
import { assertPublicCompetitionPredictionSafe } from "./competition-prediction-public-mapper.js";

export type CompetitionPredictionRouteDependencies = {
  getCompetitionPredictionForFixture?: (
    fixtureId: string,
  ) => Promise<CompetitionPredictionRuntimeResult>;
  env?: Record<string, string | undefined>;
};

function failure(
  mode: "internal" | "public",
  status: CompetitionPredictionRouteFailure["meta"]["status"],
  message: string,
  fixtureId?: string,
): CompetitionPredictionRouteFailure {
  return {
    data: null,
    ...(mode === "public"
      ? {
          market_analysis: buildPublicMarketIntelligence({
            market_intelligence_version: "public-market-intelligence-v1",
            fixture_id: fixtureId ?? "unavailable",
            generated_at: new Date().toISOString(),
            availability: "unavailable",
            reliability: "unavailable",
            freshness: "unknown",
            provider_coverage: "none",
            provider_agreement: "unknown",
            volatility: "none",
            market_count: 0,
            usable_market_count: 0,
            provider_count: 0,
            notable_movements: [],
            summary: "Market intelligence is unavailable for this response.",
            limitations: ["Competition prediction data is temporarily unavailable."],
            last_update: null,
            safety_note: PUBLIC_MARKET_SAFETY_NOTE,
          }),
        }
      : {}),
    meta: {
      status,
      source: "competition-prediction",
      mode,
      message,
    },
  };
}

function invalidQuery(error: unknown): boolean {
  return error instanceof TypeError &&
    error.message === "Unknown Competition Prediction route query parameter.";
}

export function registerCompetitionPredictionRoutes(
  app: FastifyInstance,
  dependencies: CompetitionPredictionRouteDependencies = {},
): void {
  const getPrediction = dependencies.getCompetitionPredictionForFixture ??
    getCompetitionPredictionForFixture;

  app.get(
    "/api/internal/competition/matches/:fixtureId/prediction",
    async (request, reply) => {
      const auth = verifyInternalRouteAuth({
        headers: request.headers as Record<string, string | string[] | undefined>,
        env: dependencies.env,
      });
      if (!auth.ok) {
        if (auth.reason === "not_configured") {
          reply.code(503);
          return failure("internal", "degraded", "Internal auth is not configured.");
        }
        reply.code(401);
        return failure(
          "internal",
          "degraded",
          auth.reason === "missing_token"
            ? "Internal authorization is required."
            : auth.reason === "malformed_authorization"
              ? "Internal authorization header is malformed."
              : "Internal authorization failed.",
        );
      }

      const { fixtureId } = request.params as { fixtureId: string };
      try {
        normalizeCompetitionPredictionRouteQuery(
          request.query as Record<string, unknown>,
        );
        const result = await getPrediction(fixtureId);
        return toCompetitionPredictionInternalRouteResponse(result);
      } catch (error) {
        if (invalidQuery(error)) {
          reply.code(400);
          return failure("internal", "degraded", "Invalid Competition Prediction route query.");
        }
        reply.code(503);
        return failure(
          "internal",
          "degraded",
          "Competition prediction is temporarily unavailable.",
        );
      }
    },
  );

  app.get(
    "/api/public/v1/matches/:fixtureId/prediction",
    async (request, reply) => {
      const { fixtureId } = request.params as { fixtureId: string };
      try {
        normalizeCompetitionPredictionRouteQuery(
          request.query as Record<string, unknown>,
        );
        const result = await getPrediction(fixtureId);
        return toCompetitionPredictionPublicRouteResponse(result);
      } catch (error) {
        if (invalidQuery(error)) {
          reply.code(400);
          return failure(
            "public",
            "degraded",
            "Invalid Competition Prediction route query.",
            fixtureId,
          );
        }
        reply.code(503);
        return failure(
          "public",
          "degraded",
          "Competition prediction is temporarily unavailable.",
          fixtureId,
        );
      }
    },
  );


  app.get(
    "/api/public/v1/competition/replay",
    async (request, reply) => {
      try {
        normalizeCompetitionPredictionRouteQuery(
          request.query as Record<string, unknown>,
        );
        return {
          data: listCompetitionReplayCheckpoints(),
          meta: {
            status: "replay" as const,
            source: "competition-replay" as const,
            mode: "replay" as const,
          },
        };
      } catch (error) {
        reply.code(invalidQuery(error) ? 400 : 503);
        return {
          data: [],
          meta: {
            status: "degraded" as const,
            source: "competition-replay" as const,
            mode: "replay" as const,
            message: invalidQuery(error)
              ? "Invalid Competition Replay route query."
              : "Competition replay is temporarily unavailable.",
          },
        };
      }
    },
  );

  app.get(
    "/api/public/v1/competition/replay/:checkpointId",
    async (request, reply) => {
      const { checkpointId } = request.params as { checkpointId: string };
      try {
        normalizeCompetitionPredictionRouteQuery(
          request.query as Record<string, unknown>,
        );
        const checkpoint = getCompetitionReplayCheckpoint(checkpointId);
        if (checkpoint === null) {
          reply.code(404);
          const response = {
            data: null,
            market_analysis: buildPublicMarketIntelligence({
              market_intelligence_version: "public-market-intelligence-v1",
              fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
              generated_at: new Date().toISOString(),
              availability: "unavailable" as const,
              reliability: "unavailable" as const,
              freshness: "unknown" as const,
              provider_coverage: "none" as const,
              provider_agreement: "unknown" as const,
              volatility: "none" as const,
              market_count: 0,
              usable_market_count: 0,
              provider_count: 0,
              notable_movements: [],
              summary: "The requested competition replay checkpoint is unavailable.",
              limitations: ["Choose one of the published replay checkpoints."],
              last_update: null,
              safety_note: PUBLIC_MARKET_SAFETY_NOTE,
            }),
            meta: {
              status: "no_data" as const,
              source: "competition-prediction" as const,
              mode: "replay" as const,
              message: "Competition replay checkpoint was not found.",
            },
          };
          assertPublicCompetitionPredictionSafe(response);
          return response;
        }
        return checkpoint.response;
      } catch (error) {
        if (invalidQuery(error)) {
          reply.code(400);
          const response = {
            ...failure(
              "public",
              "degraded",
              "Invalid Competition Replay route query.",
              COMPETITION_REPLAY_FIXTURE_ID,
            ),
            meta: {
              status: "degraded" as const,
              source: "competition-prediction" as const,
              mode: "replay" as const,
              message: "Invalid Competition Replay route query.",
            },
          };
          assertPublicCompetitionPredictionSafe(response);
          return response;
        }
        reply.code(503);
        const response = {
          ...failure(
            "public",
            "degraded",
            "Competition replay is temporarily unavailable.",
            COMPETITION_REPLAY_FIXTURE_ID,
          ),
          meta: {
            status: "degraded" as const,
            source: "competition-prediction" as const,
            mode: "replay" as const,
            message: "Competition replay is temporarily unavailable.",
          },
        };
        assertPublicCompetitionPredictionSafe(response);
        return response;
      }
    },
  );
}
