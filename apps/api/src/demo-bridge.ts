import {
  getDemoBundleForFixture,
  normalizeDemoBundleOptions,
  type DemoBundleOptions,
  type DemoBundleResponse,
  type NormalizedDemoBundleOptions
} from "./demo-bundle.js";
import { assertNoForbiddenSignalFields } from "./signalcore-contract.js";

export type DemoBridgeFixtureCard = {
  fixture_id: string;
  label: string;
  competition: string;
  description: string;
  demo_case: "scoreboard_available" | "odds_available";
};

export type DemoBridgeMatchesResponse = {
  data: DemoBridgeFixtureCard[];
  meta: {
    status: "live";
    source: "demo-bridge";
    mode: "public-demo";
  };
};

export type DemoBridgeBundleResponse = Omit<DemoBundleResponse, "meta"> & {
  meta: {
    status: DemoBundleResponse["meta"]["status"];
    source: "demo-bridge";
    mode: "public-demo";
  };
};

export const DEMO_BRIDGE_ALLOWED_FIXTURES = [
  {
    fixture_id: "17952170",
    label: "Slovenia vs Cyprus",
    competition: "Friendlies",
    description: "Fixture and scoreboard available; odds missing.",
    demo_case: "scoreboard_available"
  },
  {
    fixture_id: "17588223",
    label: "Mexico vs South Korea",
    competition: "World Cup",
    description: "Fixture and odds available; scoreboard missing.",
    demo_case: "odds_available"
  }
] as const satisfies readonly DemoBridgeFixtureCard[];

const allowedFixtureIds = new Set<string>(
  DEMO_BRIDGE_ALLOWED_FIXTURES.map((fixture) => fixture.fixture_id)
);

export function getDemoBridgeMatches(): DemoBridgeMatchesResponse {
  const output: DemoBridgeMatchesResponse = {
    data: DEMO_BRIDGE_ALLOWED_FIXTURES.map((fixture) => ({ ...fixture })),
    meta: {
      status: "live",
      source: "demo-bridge",
      mode: "public-demo"
    }
  };
  assertNoForbiddenSignalFields(output);
  return output;
}

export function isAllowedDemoFixtureId(fixtureId: string): boolean {
  return allowedFixtureIds.has(fixtureId);
}

export function buildDemoBridgeNotFoundResponse(_fixtureId: string) {
  return {
    data: null,
    meta: {
      status: "no_data" as const,
      source: "demo-bridge" as const,
      mode: "public-demo" as const,
      message: "Demo fixture not found."
    }
  };
}

export function normalizeDemoBridgeOptions(
  options: DemoBundleOptions = {}
): NormalizedDemoBundleOptions {
  return normalizeDemoBundleOptions(options);
}

export function buildDemoBridgeBundle(
  bundle: DemoBundleResponse
): DemoBridgeBundleResponse {
  const output: DemoBridgeBundleResponse = {
    data: bundle.data,
    meta: {
      status: bundle.meta.status,
      source: "demo-bridge",
      mode: "public-demo"
    }
  };
  assertNoForbiddenSignalFields(output);
  return output;
}

export async function getDemoBridgeBundle(
  fixtureId: string,
  options: DemoBundleOptions = {}
): Promise<DemoBridgeBundleResponse | null> {
  if (!isAllowedDemoFixtureId(fixtureId)) return null;

  const bundle = await getDemoBundleForFixture(
    fixtureId,
    normalizeDemoBridgeOptions(options)
  );
  return buildDemoBridgeBundle(bundle);
}
