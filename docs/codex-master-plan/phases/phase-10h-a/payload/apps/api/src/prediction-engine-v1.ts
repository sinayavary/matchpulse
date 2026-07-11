import {
  FINAL_PREDICTION_SAFETY_NOTE,
  buildFinalPredictionSnapshot,
  type FinalPredictionConfidence,
  type FinalPredictionModelOutput,
  type FinalPredictionRisk,
  type FinalPredictionSnapshot,
  type PredictionDataCoverage,
  type PredictionFeatureReference,
  type PredictionMatchContext,
  type PredictionSnapshotTrigger,
  type SpecialistModelContribution,
} from "./final-prediction-domain.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export const PREDICTION_ENGINE_VERSION = "prediction-composition-engine-v1" as const;

export type SpecialistPredictionOutput = Partial<FinalPredictionModelOutput>;

export type PredictionSpecialistInput = {
  model_role: SpecialistModelContribution["model_role"];
  model_version: string;
  available: boolean;
  assigned_weight: number;
  output_quality: number;
  limitations: string[];
  output?: SpecialistPredictionOutput;
};

export type PredictionCompositionPolicy = {
  max_scorelines: number;
};

export type PredictionCompositionInput = {
  fixture_id: string;
  as_of: string;
  generated_at: string;
  sequence: number | null;
  trigger: PredictionSnapshotTrigger;
  feature_reference: PredictionFeatureReference;
  match_context: PredictionMatchContext;
  data_coverage: PredictionDataCoverage;
  specialists: readonly PredictionSpecialistInput[];
  fallback_output: FinalPredictionModelOutput;
  confidence: FinalPredictionConfidence;
  risk: FinalPredictionRisk;
  odds_intelligence_reference: FinalPredictionSnapshot["odds_intelligence_reference"];
  explanation: FinalPredictionSnapshot["explanation"];
  composition_policy: PredictionCompositionPolicy;
};

type DistributionKey = string;
type NumericDistribution = Readonly<Record<DistributionKey, number>>;

const ROLE_ORDER: Readonly<Record<SpecialistModelContribution["model_role"], number>> = {
  pre_match_prior: 0,
  live_state: 1,
  market: 2,
  event_sequence: 3,
  goal_hazard: 4,
  score_distribution: 5,
  fallback: 6,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round12(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function canonicalIso(value: string, name: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${name} must be a valid ISO timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function assertUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be within 0..1.`);
  }
}

function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be non-empty.`);
  }
}

function cloneOutput(output: FinalPredictionModelOutput): FinalPredictionModelOutput {
  return structuredClone(output);
}

function sortedSpecialists(
  specialists: readonly PredictionSpecialistInput[],
): PredictionSpecialistInput[] {
  return [...specialists].sort((left, right) => (
    ROLE_ORDER[left.model_role] - ROLE_ORDER[right.model_role] ||
    left.model_version.localeCompare(right.model_version)
  ));
}

function validateSpecialists(
  specialists: readonly PredictionSpecialistInput[],
  marketWeightCap: number,
): PredictionSpecialistInput[] {
  if (specialists.length === 0) {
    throw new Error("At least one specialist contribution is required.");
  }

  const sorted = sortedSpecialists(specialists);
  const identities = new Set<string>();
  let availableWeight = 0;
  let marketWeight = 0;

  for (const specialist of sorted) {
    assertNonEmpty(specialist.model_version, "specialist.model_version");
    assertUnit(specialist.assigned_weight, "specialist.assigned_weight");
    assertUnit(specialist.output_quality, "specialist.output_quality");

    if (!Array.isArray(specialist.limitations) ||
        !specialist.limitations.every((item) => typeof item === "string")) {
      throw new TypeError("specialist.limitations must contain strings.");
    }

    const identity = `${specialist.model_role}:${specialist.model_version}`;
    if (identities.has(identity)) {
      throw new Error("Specialist role/version identities must be unique.");
    }
    identities.add(identity);

    if (!specialist.available) {
      if (specialist.assigned_weight !== 0 || specialist.output !== undefined) {
        throw new Error("Unavailable specialists must have zero weight and no output.");
      }
      continue;
    }

    if (specialist.output === undefined) {
      throw new Error("Available specialists require an output.");
    }

    availableWeight += specialist.assigned_weight;
    if (specialist.model_role === "market") {
      marketWeight += specialist.assigned_weight;
    }
  }

  if (Math.abs(availableWeight - 1) > 1e-9) {
    throw new Error("Available specialist weights must sum to one.");
  }
  if (marketWeight - marketWeightCap > 1e-9) {
    throw new Error("Market specialist weight exceeds the approved odds-intelligence cap.");
  }

  return sorted;
}

function blendDistribution<K extends string>(
  specialists: readonly PredictionSpecialistInput[],
  outputKey: keyof FinalPredictionModelOutput,
  keys: readonly K[],
  fallback: Record<K, number>,
): Record<K, number> {
  const usable = specialists.filter((specialist) => (
    specialist.available &&
    specialist.assigned_weight > 0 &&
    specialist.output?.[outputKey] !== undefined
  ));

  if (usable.length === 0) {
    return structuredClone(fallback);
  }

  const weightTotal = usable.reduce((sum, specialist) => sum + specialist.assigned_weight, 0);
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

  for (const specialist of usable) {
    const distribution = specialist.output?.[outputKey] as unknown as NumericDistribution;
    let distributionTotal = 0;
    for (const key of keys) {
      const value = distribution[key];
      assertUnit(value, `${String(outputKey)}.${key}`);
      distributionTotal += value;
      result[key] += value * specialist.assigned_weight / weightTotal;
    }
    if (Math.abs(distributionTotal - 1) > 1e-9) {
      throw new Error(`${String(outputKey)} specialist distribution must sum to one.`);
    }
  }

  let sum = 0;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (index === keys.length - 1) {
      result[key] = round12(clamp01(1 - sum));
    } else {
      result[key] = round12(clamp01(result[key]));
      sum += result[key];
    }
  }
  return result;
}

function blendGoalHorizon(
  specialists: readonly PredictionSpecialistInput[],
  fallback: FinalPredictionModelOutput["goal_horizon"],
): FinalPredictionModelOutput["goal_horizon"] {
  const usable = specialists.filter((specialist) => (
    specialist.available &&
    specialist.assigned_weight > 0 &&
    specialist.output?.goal_horizon !== undefined
  ));

  if (usable.length === 0) return structuredClone(fallback);

  const weightTotal = usable.reduce((sum, specialist) => sum + specialist.assigned_weight, 0);
  const raw = { next_5m: 0, next_10m: 0, next_15m: 0 };

  for (const specialist of usable) {
    const horizon = specialist.output?.goal_horizon;
    if (horizon === undefined) continue;
    for (const key of ["next_5m", "next_10m", "next_15m"] as const) {
      assertUnit(horizon[key], `goal_horizon.${key}`);
      raw[key] += horizon[key] * specialist.assigned_weight / weightTotal;
    }
  }

  const next5 = round12(clamp01(raw.next_5m));
  const next10 = round12(Math.max(next5, clamp01(raw.next_10m)));
  const next15 = round12(Math.max(next10, clamp01(raw.next_15m)));
  return { next_5m: next5, next_10m: next10, next_15m: next15 };
}

function blendScoreDistribution(
  specialists: readonly PredictionSpecialistInput[],
  fallback: FinalPredictionModelOutput["final_score"],
  maxScorelines: number,
): FinalPredictionModelOutput["final_score"] {
  const usable = specialists.filter((specialist) => (
    specialist.available &&
    specialist.assigned_weight > 0 &&
    specialist.output?.final_score !== undefined
  ));

  if (usable.length === 0) return structuredClone(fallback);

  const weightTotal = usable.reduce((sum, specialist) => sum + specialist.assigned_weight, 0);
  const merged = new Map<string, { home_score: number; away_score: number; probability: number }>();

  for (const specialist of usable) {
    const distribution = specialist.output?.final_score;
    if (distribution === undefined) continue;
    const normalizedWeight = specialist.assigned_weight / weightTotal;
    assertUnit(distribution.other_probability, "final_score.other_probability");
    let distributionTotal = distribution.other_probability;

    for (const outcome of distribution.outcomes) {
      if (!Number.isInteger(outcome.home_score) || outcome.home_score < 0 ||
          !Number.isInteger(outcome.away_score) || outcome.away_score < 0) {
        throw new RangeError("Final-score outcomes require non-negative integer scores.");
      }
      assertUnit(outcome.probability, "final_score.probability");
      distributionTotal += outcome.probability;
      const key = `${outcome.home_score}:${outcome.away_score}`;
      const current = merged.get(key) ?? {
        home_score: outcome.home_score,
        away_score: outcome.away_score,
        probability: 0,
      };
      current.probability += outcome.probability * normalizedWeight;
      merged.set(key, current);
    }
    if (Math.abs(distributionTotal - 1) > 1e-9) {
      throw new Error("Each final-score specialist distribution must sum to one.");
    }
  }

  const ranked = [...merged.values()].sort((left, right) => (
    right.probability - left.probability ||
    left.home_score - right.home_score ||
    left.away_score - right.away_score
  ));

  const kept = ranked.slice(0, maxScorelines);
  const rounded = kept.map((outcome) => ({
    home_score: outcome.home_score,
    away_score: outcome.away_score,
    probability: round12(clamp01(outcome.probability)),
  }));
  const keptTotal = rounded.reduce((sum, outcome) => sum + outcome.probability, 0);
  const other = round12(clamp01(1 - keptTotal));

  return { outcomes: rounded, other_probability: other };
}

function composeOutput(
  specialists: readonly PredictionSpecialistInput[],
  fallback: FinalPredictionModelOutput,
  maxScorelines: number,
): FinalPredictionModelOutput {
  return {
    final_outcome: blendDistribution(
      specialists,
      "final_outcome",
      ["home", "draw", "away"] as const,
      fallback.final_outcome,
    ),
    next_goal: blendDistribution(
      specialists,
      "next_goal",
      ["home", "none", "away"] as const,
      fallback.next_goal,
    ),
    goal_horizon: blendGoalHorizon(specialists, fallback.goal_horizon),
    final_score: blendScoreDistribution(
      specialists,
      fallback.final_score,
      maxScorelines,
    ),
    current_result_survival: blendDistribution(
      specialists,
      "current_result_survival",
      ["current_result_holds", "current_result_changes"] as const,
      fallback.current_result_survival,
    ),
    momentum_shift: blendDistribution(
      specialists,
      "momentum_shift",
      ["home_strengthens", "neutral", "away_strengthens"] as const,
      fallback.momentum_shift,
    ),
  };
}

function contributions(
  specialists: readonly PredictionSpecialistInput[],
): SpecialistModelContribution[] {
  return specialists.map((specialist) => ({
    model_role: specialist.model_role,
    model_version: specialist.model_version,
    available: specialist.available,
    assigned_weight: specialist.assigned_weight,
    output_quality: specialist.output_quality,
    limitations: [...new Set(specialist.limitations)].sort(),
  }));
}

export function composeFinalPredictionSnapshot(
  input: PredictionCompositionInput,
): FinalPredictionSnapshot {
  assertNonEmpty(input.fixture_id, "fixture_id");
  const asOf = canonicalIso(input.as_of, "as_of");
  const generatedAt = canonicalIso(input.generated_at, "generated_at");
  if (Date.parse(generatedAt) < Date.parse(asOf)) {
    throw new Error("generated_at cannot precede as_of.");
  }
  if (input.sequence !== null &&
      (!Number.isSafeInteger(input.sequence) || input.sequence < 0)) {
    throw new RangeError("sequence must be null or a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(input.composition_policy.max_scorelines) ||
      input.composition_policy.max_scorelines < 1 ||
      input.composition_policy.max_scorelines > 25) {
    throw new RangeError("composition_policy.max_scorelines must be within 1..25.");
  }

  const odds = structuredClone(input.odds_intelligence_reference);
  assertUnit(odds.assigned_market_weight, "odds_intelligence_reference.assigned_market_weight");
  const specialists = validateSpecialists(input.specialists, odds.assigned_market_weight);
  const modelOutput = composeOutput(
    specialists,
    cloneOutput(input.fallback_output),
    input.composition_policy.max_scorelines,
  );

  const snapshotCore = {
    engine_version: PREDICTION_ENGINE_VERSION,
    fixture_id: input.fixture_id,
    as_of: asOf,
    generated_at: generatedAt,
    sequence: input.sequence,
    trigger: input.trigger,
    feature_reference: input.feature_reference,
    match_context: input.match_context,
    data_coverage: input.data_coverage,
    specialist_contributions: contributions(specialists),
    odds_intelligence_reference: odds,
    model_output: modelOutput,
  };

  const snapshotId = `prediction-snapshot-v1:${computeStorageContentHash(snapshotCore)}`;

  return buildFinalPredictionSnapshot({
    identity: {
      snapshot_id: snapshotId,
      fixture_id: input.fixture_id,
      as_of: asOf,
      generated_at: generatedAt,
      sequence: input.sequence,
      trigger: input.trigger,
      feature_version: input.feature_reference.feature_version,
      prediction_contract_version: "prediction-domain-v1",
    },
    match_context: structuredClone(input.match_context),
    feature_reference: structuredClone(input.feature_reference),
    data_coverage: structuredClone(input.data_coverage),
    model_output: modelOutput,
    confidence: structuredClone(input.confidence),
    risk: structuredClone(input.risk),
    specialist_contributions: contributions(specialists),
    odds_intelligence_reference: odds,
    explanation: structuredClone(input.explanation),
    safety_note: FINAL_PREDICTION_SAFETY_NOTE,
  });
}
