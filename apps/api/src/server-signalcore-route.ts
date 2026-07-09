import type { FastifyInstance } from "fastify";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";
import {
  getSignalCoreV0ForFixture,
  type SignalCoreV0Options
} from "./signalcore-v0.js";

type InternalSignalCoreRouteDeps = {
  getSignalCoreV0ForFixture?: (
    fixtureId: string,
    options?: SignalCoreV0Options
  ) => Promise<unknown>;
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

export function registerInternalSignalCoreRoute(
  app: FastifyInstance,
  deps: InternalSignalCoreRouteDeps = {}
): void {
  const getSignalCoreV0ForFixtureImpl = deps.getSignalCoreV0ForFixture ?? getSignalCoreV0ForFixture;

  app.get("/api/internal/signalcore/matches/:fixtureId", async (request) => {
    const { fixtureId } = request.params as { fixtureId: string };
    const query = request.query as {
      includeState?: unknown;
      includePressure?: unknown;
      includeOddsReliability?: unknown;
      oddsLimit?: unknown;
      staleAfterMinutes?: unknown;
      pressureWindowSize?: unknown;
      pressureMaxEvidence?: unknown;
      pressureMaxPayloadAgeMinutes?: unknown;
      includeInternalContext?: unknown;
      includeEventImpact?: unknown;
      includeEventContext?: unknown;
    };
    const includeState = readBoolean(query.includeState);
    const includePressure = readBoolean(query.includePressure);
    const includeOddsReliability = readBoolean(query.includeOddsReliability);
    const oddsLimit = readNumber(query.oddsLimit);
    const staleAfterMinutes = readNumber(query.staleAfterMinutes);
    const pressureWindowSize = readNumber(query.pressureWindowSize);
    const pressureMaxEvidence = readNumber(query.pressureMaxEvidence);
    const pressureMaxPayloadAgeMinutes = readNumber(query.pressureMaxPayloadAgeMinutes);
    const includeInternalContext = readBoolean(query.includeInternalContext);
    const includeEventImpact = readBoolean(query.includeEventImpact);
    const includeEventContext = readBoolean(query.includeEventContext);

    try {
      const output = await getSignalCoreV0ForFixtureImpl(fixtureId, {
        includeState,
        includePressure,
        includeOddsReliability,
        oddsLimit,
        staleAfterMinutes,
        pressureWindowSize,
        pressureMaxEvidence,
        pressureMaxPayloadAgeMinutes,
        includeInternalContext,
        includeEventImpact,
        includeEventContext
      });
      assertNoForbiddenSignalFields(output);
      return output;
    } catch {
      return {
        data: {
          fixture_id: fixtureId,
          summary: {
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
          status: "degraded" as const,
          source: "signalcore" as const,
          mode: "internal" as const
        }
      };
    }
  });
}
