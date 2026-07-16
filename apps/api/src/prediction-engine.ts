import {
  FINAL_PREDICTION_SAFETY_NOTE,
  buildFinalPredictionSnapshot,
  type FinalOutcomeProbabilities,
  type FinalPredictionConfidence,
  type FinalPredictionRisk,
  type FinalPredictionSnapshot,
  type PredictionSnapshotTrigger,
  type SpecialistModelContribution,
} from "./final-prediction-domain.js";
import { type PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";
import {
  buildPredictionSpecialists,
  type PredictionSpecialistBundle,
  type PredictionSpecialistResult,
} from "./prediction-specialists.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export const PREDICTION_ENGINE_VERSION = "scenario-engine-v1" as const;

export type PredictionEngineInput = {
  features: PredictionEngineFeatureSnapshot;
  trigger: PredictionSnapshotTrigger;
  generated_at?: string;
};

type WeightedOutcome = { value: FinalOutcomeProbabilities; weight: number };

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }
function round12(value: number): number { return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000; }

function iso(value: string, name: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be an ISO timestamp.`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} must be an ISO timestamp.`);
  return new Date(timestamp).toISOString();
}

function normalize(values: readonly number[]): number[] {
  const clean = values.map((value) => Number.isFinite(value) && value > 0 ? value : 0);
  const total = clean.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return clean.map(() => 1 / clean.length);
  const rounded = clean.map((value) => round12(value / total));
  const drift = 1 - rounded.reduce((sum, value) => sum + value, 0);
  rounded[rounded.length - 1] = round12((rounded[rounded.length - 1] ?? 0) + drift);
  return rounded;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function blendOutcomes(values: readonly WeightedOutcome[]): FinalOutcomeProbabilities {
  if (values.length === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  const weights = normalize(values.map((entry) => entry.weight));
  const totals = values.reduce((result, entry, index) => ({
    home: result.home + entry.value.home * weights[index]!,
    draw: result.draw + entry.value.draw * weights[index]!,
    away: result.away + entry.value.away * weights[index]!,
  }), { home: 0, draw: 0, away: 0 });
  const output = normalize([totals.home, totals.draw, totals.away]);
  return { home: output[0]!, draw: output[1]!, away: output[2]! };
}

function finalOutcome(
  features: PredictionEngineFeatureSnapshot,
  specialists: PredictionSpecialistBundle,
): { value: FinalOutcomeProbabilities; marketWeight: number; usedFallback: boolean } {
  const state = specialists.state.final_outcome;
  const market = specialists.market.final_outcome;
  const fallback = specialists.fallback.final_outcome!;
  if (features.match.normalized_phase === "finished" && state !== null) {
    return { value: state, marketWeight: 0, usedFallback: false };
  }
  const marketWeight = market === null ? 0 : Math.min(features.market.model_weight_cap, specialists.market.quality);
  const nonMarket = 1 - marketWeight;
  const entries: WeightedOutcome[] = [];
  if (state !== null) {
    entries.push({ value: state, weight: nonMarket * 0.82 });
    entries.push({ value: fallback, weight: nonMarket * 0.18 });
  } else {
    entries.push({ value: fallback, weight: nonMarket });
  }
  if (market !== null && marketWeight > 0) entries.push({ value: market, weight: marketWeight });
  return { value: blendOutcomes(entries), marketWeight: round12(marketWeight), usedFallback: state === null };
}

function pairwiseAgreement(values: readonly FinalOutcomeProbabilities[]): number {
  if (values.length < 2) return 0.5;
  let largestDistance = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const a = values[left]!;
      const b = values[right]!;
      const distance = (Math.abs(a.home - b.home) + Math.abs(a.draw - b.draw) + Math.abs(a.away - b.away)) / 2;
      largestDistance = Math.max(largestDistance, distance);
    }
  }
  return round12(clamp01(1 - largestDistance));
}

function freshnessScore(features: PredictionEngineFeatureSnapshot): number {
  const values = [features.freshness.score_age_seconds, features.freshness.event_age_seconds, features.freshness.market_age_seconds]
    .filter((value): value is number => value !== null);
  if (values.length === 0) return 0;
  const component = (age: number): number => age <= 90 ? 1 : age <= 300 ? 0.75 : age <= 900 ? 0.4 : age <= 1_800 ? 0.15 : 0;
  return round12(values.reduce((sum, value) => sum + component(value), 0) / values.length);
}

function supportScore(features: PredictionEngineFeatureSnapshot): number {
  let score = features.coverage.coverage_score;
  if (features.match.normalized_phase === "unknown") score -= 0.2;
  if (features.match.minute === null && features.match.normalized_phase !== "pre_match") score -= 0.15;
  if (features.event_context.home_red_cards + features.event_context.away_red_cards >= 3) score -= 0.2;
  return round12(clamp01(score));
}

function confidenceLevel(score: number): FinalPredictionConfidence["level"] {
  if (score >= 0.85) return "very_high";
  if (score >= 0.68) return "high";
  if (score >= 0.48) return "medium";
  if (score >= 0.28) return "low";
  return "very_low";
}

function buildConfidence(features: PredictionEngineFeatureSnapshot, agreement: number): FinalPredictionConfidence {
  const freshness = freshnessScore(features);
  const support = supportScore(features);
  const calibration = 0.5;
  const score = round12(clamp01(
    0.34 * features.coverage.coverage_score + 0.24 * freshness + 0.22 * agreement + 0.12 * support + 0.08 * calibration,
  ));
  return {
    level: confidenceLevel(score),
    score,
    calibration_score: calibration,
    model_agreement_score: agreement,
    data_coverage_score: features.coverage.coverage_score,
    freshness_score: freshness,
    out_of_distribution_score: support,
    reasons: unique([
      `Data coverage is ${features.coverage.coverage_score >= 0.75 ? "broad" : features.coverage.coverage_score >= 0.45 ? "partial" : "limited"}.`,
      `Input freshness is ${freshness >= 0.75 ? "strong" : freshness >= 0.4 ? "mixed" : "weak"}.`,
      `Specialist agreement is ${agreement >= 0.75 ? "strong" : agreement >= 0.45 ? "mixed" : "weak"}.`,
      "Historical calibration is not yet available; a neutral calibration baseline is used.",
    ]),
  };
}

function buildRisk(
  features: PredictionEngineFeatureSnapshot,
  confidence: FinalPredictionConfidence,
  usedFallback: boolean,
): FinalPredictionRisk {
  const reasons: FinalPredictionRisk["reasons"] = [];
  if (confidence.freshness_score < 0.4) reasons.push("stale_data");
  if (!features.coverage.has_minute) reasons.push("missing_minute");
  if (!features.coverage.has_events) reasons.push("missing_events");
  if (!features.coverage.has_market) reasons.push("missing_odds");
  else if (!features.coverage.has_reliable_market) reasons.push("unreliable_odds");
  if (confidence.model_agreement_score < 0.45) reasons.push("model_disagreement");
  if (confidence.out_of_distribution_score < 0.4) reasons.push("out_of_distribution");
  if (features.coverage.coverage_score < 0.75) reasons.push("partial_feature_coverage");
  if (usedFallback) reasons.push("inference_fallback");
  const critical = confidence.score < 0.18 || reasons.includes("out_of_distribution") && reasons.length >= 5;
  const high = confidence.score < 0.35 || reasons.length >= 4;
  const medium = confidence.score < 0.65 || reasons.length >= 2;
  return { level: critical ? "critical" : high ? "high" : medium ? "medium" : "low", reasons: [...new Set(reasons)] };
}

function contributionWeights(
  features: PredictionEngineFeatureSnapshot,
  specialists: PredictionSpecialistBundle,
  marketWeight: number,
): SpecialistModelContribution[] {
  const entries: Array<{ result: PredictionSpecialistResult; base: number }> = [
    { result: specialists.state, base: 0.34 },
    { result: specialists.tempo, base: 0.22 },
    { result: specialists.market, base: 0 },
    { result: specialists.score_distribution, base: 0.22 },
    { result: specialists.fallback, base: 0.12 },
  ];
  const availableNonMarket = entries.filter((entry) => entry.result.available && entry.result.model_role !== "market");
  const qualityMass = availableNonMarket.reduce((sum, entry) => sum + entry.base * Math.max(0.05, entry.result.quality), 0);
  return entries.map(({ result, base }) => {
    let assignedWeight = 0;
    if (result.available) {
      assignedWeight = result.model_role === "market"
        ? marketWeight
        : qualityMass > 0 ? (1 - marketWeight) * base * Math.max(0.05, result.quality) / qualityMass : 0;
    }
    return {
      model_role: result.model_role,
      model_version: result.model_version,
      available: result.available,
      assigned_weight: round12(assignedWeight),
      output_quality: result.quality,
      limitations: [...result.limitations],
    };
  }).map((entry, index, all) => {
    if (index !== all.length - 1 || !entry.available) return entry;
    const total = all.reduce((sum, value) => sum + value.assigned_weight, 0);
    return { ...entry, assigned_weight: round12(entry.assigned_weight + (1 - total)) };
  });
}

function explanation(features: PredictionEngineFeatureSnapshot, confidence: FinalPredictionConfidence): FinalPredictionSnapshot["explanation"] {
  const difference = features.match.score_diff;
  const scoreFactor = difference === null
    ? "Scoreboard context is unavailable."
    : difference > 0 ? "The home side currently leads." : difference < 0 ? "The away side currently leads." : "The match is currently level.";
  return {
    summary: `Live scenario estimate with ${confidence.level.replace("_", " ")} confidence.`,
    main_factors: unique([
      scoreFactor,
      features.match.minute === null ? "Match timing is incomplete." : `The estimate reflects minute ${features.match.minute}.`,
      features.coverage.has_reliable_market ? "Reliable market context is included." : "Reliable market context is not included.",
      features.coverage.has_event_impact ? `${features.event_context.pressure_level} event pressure is included.` : "Event-impact context is limited.",
    ]),
    limitations: unique([
      ...features.limitations,
      "Historical calibration is pending a later evaluation phase.",
      "The estimate may change when new match data arrives.",
    ]),
  };
}

function featureCount(features: PredictionEngineFeatureSnapshot): number {
  return 8 + Object.values(features.coverage).filter((value) => value === true).length +
    (features.match.home_score === null ? 0 : 3) + (features.match.minute === null ? 0 : 1) +
    (features.event_context.event_count > 0 ? 6 : 0) + (features.market.usable ? 4 : 0) +
    (features.pre_match_prior === null ? 0 : 3);
}

export function buildFinalScenarioPrediction(input: PredictionEngineInput): FinalPredictionSnapshot {
  const features = structuredClone(input.features);
  const generatedAt = iso(input.generated_at ?? features.as_of, "generated_at");
  if (Date.parse(generatedAt) < Date.parse(features.as_of)) {
    throw new RangeError("generated_at cannot precede the feature snapshot.");
  }
  const specialists = buildPredictionSpecialists(features);
  const outcome = finalOutcome(features, specialists);
  const agreement = pairwiseAgreement([
    specialists.state.final_outcome,
    specialists.market.final_outcome,
    specialists.fallback.final_outcome,
  ].filter((value): value is FinalOutcomeProbabilities => value !== null));
  const confidence = buildConfidence(features, agreement);
  const risk = buildRisk(features, confidence, outcome.usedFallback);
  const contributions = contributionWeights(features, specialists, outcome.marketWeight);
  const tempo = specialists.tempo;
  const score = specialists.score_distribution;
  const snapshotId = `prediction-snapshot-v1:${computeStorageContentHash({
    engine_version: PREDICTION_ENGINE_VERSION,
    fixture_id: features.fixture_id,
    as_of: features.as_of,
    sequence: features.sequence,
    trigger: input.trigger,
    feature_hash: features.feature_hash,
  })}`;

  return buildFinalPredictionSnapshot({
    identity: {
      snapshot_id: snapshotId,
      fixture_id: features.fixture_id,
      as_of: features.as_of,
      generated_at: generatedAt,
      sequence: features.sequence,
      trigger: input.trigger,
      feature_version: features.feature_version,
      prediction_contract_version: "prediction-domain-v1",
    },
    match_context: { ...features.match },
    feature_reference: { feature_version: features.feature_version, feature_hash: features.feature_hash, feature_count: featureCount(features) },
    data_coverage: {
      has_fixture: features.coverage.has_fixture,
      has_scoreboard: features.coverage.has_scoreboard,
      has_minute: features.coverage.has_minute,
      has_odds: features.coverage.has_market,
      has_reliable_odds: features.coverage.has_reliable_market,
      has_events: features.coverage.has_events,
      has_event_impact: features.coverage.has_event_impact,
      has_pre_match_features: features.coverage.has_pre_match_prior,
      feature_coverage_score: features.coverage.coverage_score,
    },
    model_output: {
      final_outcome: outcome.value,
      next_goal: tempo.next_goal ?? { home: 0, none: 1, away: 0 },
      goal_horizon: tempo.goal_horizon ?? { next_5m: 0, next_10m: 0, next_15m: 0 },
      final_score: score.final_score ?? { outcomes: [], other_probability: 1 },
      current_result_survival: specialists.state.current_result_survival ?? { current_result_holds: 0.5, current_result_changes: 0.5 },
      momentum_shift: tempo.momentum_shift ?? { home_strengthens: 0.25, neutral: 0.5, away_strengthens: 0.25 },
    },
    confidence,
    risk,
    specialist_contributions: contributions,
    odds_intelligence_reference: {
      odds_intelligence_version: "odds-intelligence-v1",
      assessment_id: features.market.assessment_id,
      usable_for_model: features.market.usable && outcome.marketWeight > 0,
      reliability_score: features.market.reliability_score,
      assigned_market_weight: outcome.marketWeight,
    },
    explanation: explanation(features, confidence),
    safety_note: FINAL_PREDICTION_SAFETY_NOTE,
  });
}
