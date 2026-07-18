import { computeStorageContentHash } from "./prediction-storage-hash.js";
import { getDbClient } from "./db.js";
import { getDbBackedMatchState, type CanonicalMatchState } from "./match-state-builder.js";
import { resolveMatchLifecycle, type MatchLifecycle } from "./match-lifecycle.js";
import { getProductAgentV1ForFixture, type ProductAgentV1Response } from "./product-agent-v1.js";
import { buildPredictionEngineFeatures, type PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";
import { runPredictionRuntimeCycle, type RuntimeCycleInput } from "./prediction-runtime-cycle.js";
import { createPredictionRuntimePersistence } from "./prediction-runtime-storage.js";
import type { PredictionOrchestrationResult } from "./prediction-runtime-orchestrator.js";

export type AgentInsightSnapshot = {
  fixture_id: string;
  as_of: string;
  agent_version: string;
  status: string;
  quality: string;
  freshness: string;
  content_hash: string;
};

export type BackgroundIntelligenceResult = {
  status: "ok" | "partial" | "failed";
  attempted: number;
  agent_succeeded: number;
  prediction_attempted: number;
  prediction_persisted: number;
  prediction_deduplicated: number;
  failed: number;
  fixtures: Array<{ fixture_id: string; status: "ok" | "failed"; lifecycle?: MatchLifecycle; error?: string }>;
};

export type BackgroundIntelligenceDependencies = {
  listFixtureIds: () => Promise<string[]>;
  getState: (fixtureId: string) => Promise<CanonicalMatchState>;
  runAgent: (fixtureId: string) => Promise<ProductAgentV1Response>;
  persistPrediction: (input: RuntimeCycleInput, result: PredictionOrchestrationResult, featureBundle: Record<string, unknown>) => Promise<void>;
  now?: () => Date;
};

const DEFAULT_MAX_FIXTURES = 100;
const seenPredictionInputs = new Set<string>();

function normalizedPhase(lifecycle: MatchLifecycle): "pre_match" | "first_half" | "halftime" | "second_half" | "extra_time" | "finished" | "unknown" {
  switch (lifecycle) {
    case "scheduled":
    case "prematch": return "pre_match";
    case "live_first_half": return "first_half";
    case "halftime": return "halftime";
    case "live_second_half": return "second_half";
    case "extra_time":
    case "penalties": return "extra_time";
    case "finished": return "finished";
    default: return "unknown";
  }
}

function safeAgentSnapshot(fixtureId: string, asOf: string, agent: ProductAgentV1Response): AgentInsightSnapshot {
  const data = agent.data;
  const safe = {
    fixture_id: fixtureId,
    as_of: asOf,
    agent_version: data.agent_version,
    status: data.status,
    quality: data.data_quality.level,
    freshness: data.freshness.freshness_label
  };
  return { ...safe, content_hash: computeStorageContentHash(safe) };
}

function defaultDependencies(): BackgroundIntelligenceDependencies {
  const persistence = createPredictionRuntimePersistence();
  return {
    async listFixtureIds() {
      const rows = await getDbClient().fixture.findMany({
        orderBy: [{ startTimeUtc: "asc" }, { fixtureId: "asc" }],
        take: DEFAULT_MAX_FIXTURES,
        select: { fixtureId: true }
      });
      return rows.map((row) => row.fixtureId);
    },
    getState: getDbBackedMatchState,
    runAgent: getProductAgentV1ForFixture,
    persistPrediction: (input, result, featureBundle) => persistence(input, result, featureBundle)
  };
}

export async function runBackgroundIntelligenceCycle(
  dependencies: Partial<BackgroundIntelligenceDependencies> = {}
): Promise<BackgroundIntelligenceResult> {
  const defaults = defaultDependencies();
  const deps: BackgroundIntelligenceDependencies = { ...defaults, ...dependencies };
  const now = (deps.now ?? (() => new Date()))();
  const asOf = now.toISOString();
  let fixtureIds: string[];
  try {
    fixtureIds = [...new Set((await deps.listFixtureIds()).filter((value) => value.trim() !== ""))].slice(0, DEFAULT_MAX_FIXTURES);
  } catch {
    return { status: "failed", attempted: 0, agent_succeeded: 0, prediction_attempted: 0, prediction_persisted: 0, prediction_deduplicated: 0, failed: 1, fixtures: [] };
  }

  const fixtures: BackgroundIntelligenceResult["fixtures"] = [];
  let agentSucceeded = 0;
  let predictionAttempted = 0;
  let predictionPersisted = 0;
  let predictionDeduplicated = 0;
  let failed = 0;

  for (const fixtureId of fixtureIds) {
    try {
      const state = await deps.getState(fixtureId);
      const lifecycle = state.lifecycle ?? resolveMatchLifecycle({
        providerStatus: state.identity.status,
        persistedPhase: state.scoreboard.phase,
        startTimeUtc: state.identity.start_time_utc,
        now
      });
      const agent = await deps.runAgent(fixtureId);
      agentSucceeded += 1;
      const agentSnapshot = safeAgentSnapshot(fixtureId, asOf, agent);
      const features: PredictionEngineFeatureSnapshot = buildPredictionEngineFeatures({
        fixture_id: fixtureId,
        as_of: asOf,
        normalized_phase: normalizedPhase(lifecycle.lifecycle),
        phase: state.scoreboard.phase,
        home_score: state.scoreboard.home_score,
        away_score: state.scoreboard.away_score,
        score_timestamp: state.scoreboard.last_data_received_at,
        has_fixture: state.quality.has_fixture
      });
      const featureBundle: Record<string, unknown> = {
        feature_version: features.feature_version,
        generated_at: asOf,
        fixture_id: fixtureId,
        features,
        agent_snapshot: agentSnapshot
      };
      const input: RuntimeCycleInput = {
        fixture_id: fixtureId,
        as_of: asOf,
        sequence: null,
        trigger: "timer",
        features,
        feature_bundle: featureBundle
      };
      predictionAttempted += 1;
      const cycle = await runPredictionRuntimeCycle([input], {
        seen: seenPredictionInputs,
        persist: (request, result) => deps.persistPrediction(request, result, featureBundle)
      });
      predictionPersisted += cycle.persisted;
      predictionDeduplicated += cycle.skipped;
      if (cycle.failed > 0) throw new Error("prediction_cycle_failed");
      fixtures.push({ fixture_id: fixtureId, status: "ok", lifecycle: lifecycle.lifecycle });
    } catch {
      failed += 1;
      fixtures.push({ fixture_id: fixtureId, status: "failed", error: "fixture_intelligence_cycle_failed" });
    }
  }

  return {
    status: failed === 0 ? "ok" : fixtures.length > failed ? "partial" : "failed",
    attempted: fixtureIds.length,
    agent_succeeded: agentSucceeded,
    prediction_attempted: predictionAttempted,
    prediction_persisted: predictionPersisted,
    prediction_deduplicated: predictionDeduplicated,
    failed,
    fixtures
  };
}
