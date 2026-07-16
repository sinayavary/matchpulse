import { buildFinalScenarioPrediction, type PredictionEngineInput } from "./prediction-engine.js";
import type { FinalOutcomeProbabilities, FinalPredictionSnapshot } from "./final-prediction-domain.js";
import type { PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";

export type PrivateModelInvoker = (request: { fixture_id: string; feature_version: string; feature_hash: string; features: PredictionEngineFeatureSnapshot }) => Promise<unknown>;
export type PredictionAdapterStatus = "deterministic_fallback" | "private_model_applied" | "private_model_degraded";
export type PredictionAdapterResult = { snapshot: FinalPredictionSnapshot; status: PredictionAdapterStatus };

function validOutcome(value: unknown): value is FinalOutcomeProbabilities {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>; const values: unknown[] = [candidate.home, candidate.draw, candidate.away];
  return values.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 1) && Math.abs(values.reduce<number>((sum, item) => sum + (item as number), 0) - 1) <= 1e-6;
}

function extractOutcome(value: unknown): FinalOutcomeProbabilities | null {
  if (validOutcome(value)) return value;
  if (value !== null && typeof value === "object" && "final_outcome" in value) {
    const candidate = (value as { final_outcome?: unknown }).final_outcome; return validOutcome(candidate) ? candidate : null;
  }
  return null;
}

export async function runPredictionModelAdapter(input: PredictionEngineInput, invoker?: PrivateModelInvoker): Promise<PredictionAdapterResult> {
  const baseline = buildFinalScenarioPrediction(input);
  if (invoker === undefined) return { snapshot: baseline, status: "deterministic_fallback" };
  try {
    const response = await invoker({ fixture_id: input.features.fixture_id, feature_version: input.features.feature_version, feature_hash: input.features.feature_hash, features: structuredClone(input.features) });
    const outcome = extractOutcome(response);
    if (outcome === null) return { snapshot: baseline, status: "private_model_degraded" };
    return { snapshot: { ...baseline, model_output: { ...baseline.model_output, final_outcome: outcome } }, status: "private_model_applied" };
  } catch { return { snapshot: baseline, status: "private_model_degraded" }; }
}
