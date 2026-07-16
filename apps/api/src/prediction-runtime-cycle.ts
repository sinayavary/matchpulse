import { orchestratePrediction, type PredictionOrchestrationRequest, type PredictionOrchestrationResult } from "./prediction-runtime-orchestrator.js";
import type { RuntimeFeatureBundle } from "./prediction-runtime-storage.js";

export type RuntimeCycleInput = PredictionOrchestrationRequest & { feature_bundle: RuntimeFeatureBundle };
export type RuntimeCycleResult = { status: "ok" | "partial" | "failed"; requested: number; persisted: number; skipped: number; failed: number; results: PredictionOrchestrationResult[] };

export async function runPredictionRuntimeCycle(inputs: readonly RuntimeCycleInput[], dependencies: { persist: (input: RuntimeCycleInput, result: PredictionOrchestrationResult) => Promise<void>; seen?: Set<string>; concurrency?: number }): Promise<RuntimeCycleResult> {
  const limit = Math.min(8, Math.max(1, Math.trunc(dependencies.concurrency ?? 2))); const results: PredictionOrchestrationResult[] = []; let cursor = 0; let failed = 0;
  async function consume(): Promise<void> { while (cursor < inputs.length) { const input = inputs[cursor++]!; try { const result = await orchestratePrediction(input, { seen: dependencies.seen, persist: (value) => dependencies.persist(input, { ...value, dedupe_key: value.dedupe_key, persisted: true }) }); results.push(result); } catch { failed++; } } }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, () => consume()));
  const persisted = results.filter((result) => result.persisted).length; const skipped = results.length - persisted;
  return { status: failed === inputs.length && inputs.length > 0 ? "failed" : failed > 0 ? "partial" : "ok", requested: inputs.length, persisted, skipped, failed, results };
}
