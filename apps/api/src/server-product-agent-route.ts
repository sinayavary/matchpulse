import type { FastifyInstance } from "fastify";
import { verifyInternalRouteAuth } from "./internal-auth.js";
import {
  assertProductAgentInternalRoutePayloadSafe,
  normalizeProductAgentInternalRouteQuery,
  type ProductAgentInternalRouteFailure
} from "./product-agent-route-contract.js";
import {
  getProductAgentV1ForFixture,
  type ProductAgentV1Response
} from "./product-agent-v1.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";

type InternalProductAgentRouteDeps = {
  getProductAgentV1ForFixture?: typeof getProductAgentV1ForFixture;
  env?: Record<string, string | undefined>;
};

function failure(
  status: ProductAgentInternalRouteFailure["meta"]["status"],
  message: string
): ProductAgentInternalRouteFailure {
  return {
    data: null,
    meta: { status, source: "product-agent", mode: "internal", message }
  };
}

export function registerInternalProductAgentRoute(
  app: FastifyInstance,
  deps: InternalProductAgentRouteDeps = {}
): void {
  const getProductAgentV1ForFixtureImpl =
    deps.getProductAgentV1ForFixture ?? getProductAgentV1ForFixture;

  app.get("/api/internal/product-agent/matches/:fixtureId/insight", async (request, reply) => {
    const auth = verifyInternalRouteAuth({
      headers: request.headers as Record<string, string | string[] | undefined>,
      env: deps.env
    });
    if (!auth.ok) {
      if (auth.reason === "not_configured") {
        reply.code(503);
        return failure("degraded", "Internal auth is not configured.");
      }
      reply.code(401);
      return failure(
        "degraded",
        auth.reason === "missing_token"
          ? "Internal authorization is required."
          : auth.reason === "malformed_authorization"
            ? "Internal authorization header is malformed."
            : "Internal authorization failed."
      );
    }

    const { fixtureId } = request.params as { fixtureId: string };
    try {
      const query = normalizeProductAgentInternalRouteQuery(
        request.query as Record<string, unknown>
      );
      const output: ProductAgentV1Response = await getProductAgentV1ForFixtureImpl(
        fixtureId,
        query
      );
      assertProductAgentInternalRoutePayloadSafe(output);
      assertNoForbiddenSignalFields(output);
      return output;
    } catch (error) {
      if (error instanceof TypeError && error.message.startsWith("Unknown Product Agent route query parameter:")) {
        reply.code(400);
        return failure("degraded", "Invalid Product Agent route query.");
      }
      reply.code(503);
      return failure("degraded", "Product Agent insight is temporarily unavailable.");
    }
  });
}
