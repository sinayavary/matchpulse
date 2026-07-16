import type { PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";
import { runPredictionModelAdapter, type PredictionAdapterResult, type PrivateModelInvoker } from "./prediction-model-adapter.js";
import type { PredictionSnapshotTrigger } from "./final-prediction-domain.js";

export type PredictionOrchestrationRequest = { fixture_id: string; as_of: string; sequence?: number | null; trigger: PredictionSnapshotTrigger; features: PredictionEngineFeatureSnapshot; private_model?: PrivateModelInvoker };
export type PredictionOrchestrationResult = PredictionAdapterResult & { dedupe_key: string; persisted: boolean };
export type PredictionOrchestrationPersistence = (result: PredictionAdapterResult & { dedupe_key: string }) => Promise<void>;

function iso(value: string): string { const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) throw new TypeError("as_of must be an ISO timestamp."); return new Date(timestamp).toISOString(); }
function key(input: PredictionOrchestrationRequest): string { return `${input.fixture_id}:${input.sequence ?? "none"}:${input.trigger}:${input.features.feature_hash}`; }

export function shouldRunPrediction(input: PredictionOrchestrationRequest, seen: ReadonlySet<string>): boolean {
  if (input.features.fixture_id !== input.fixture_id) throw new TypeError("feature fixture does not match orchestration fixture.");
  const asOf = iso(input.as_of); if (Date.parse(input.features.as_of) > Date.parse(asOf)) throw new RangeError("feature as_of cannot be later than request as_of.");
  return !seen.has(key(input));
}

export async function orchestratePrediction(input: PredictionOrchestrationRequest, dependencies: { seen?: Set<string>; persist: PredictionOrchestrationPersistence }): Promise<PredictionOrchestrationResult> {
  const seen = dependencies.seen ?? new Set<string>(); const dedupeKey = key(input);
  if (!shouldRunPrediction(input, seen)) return { ...(await runPredictionModelAdapter({ features: input.features, trigger: input.trigger, generated_at: input.as_of })), dedupe_key: dedupeKey, persisted: false };
  const result = await runPredictionModelAdapter({ features: input.features, trigger: input.trigger, generated_at: input.as_of }, input.private_model);
  await dependencies.persist({ ...result, dedupe_key: dedupeKey }); seen.add(dedupeKey);
  return { ...result, dedupe_key: dedupeKey, persisted: true };
}

export async function orchestratePredictionBatch(inputs: readonly PredictionOrchestrationRequest[], dependencies: { persist: PredictionOrchestrationPersistence; seen?: Set<string>; concurrency?: number }): Promise<PredictionOrchestrationResult[]> {
  const limit = Math.min(8, Math.max(1, Math.trunc(dependencies.concurrency ?? 2))); const result: PredictionOrchestrationResult[] = new Array(inputs.length); let cursor = 0;
  async function consume(): Promise<void> { while (cursor < inputs.length) { const index = cursor++; result[index] = await orchestratePrediction(inputs[index]!, dependencies); } }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, () => consume())); return result;
}
