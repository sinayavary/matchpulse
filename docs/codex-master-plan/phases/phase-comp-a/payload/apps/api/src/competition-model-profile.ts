import {
  type FinalOutcomeProbabilities,
  type FinalPredictionConfidence,
  type FinalPredictionModelOutput,
  type FinalPredictionRisk,
  type FinalPredictionSnapshot,
  type FinalScoreDistribution,
  type NextGoalProbabilities,
  type PredictionDataCoverage,
  type PredictionFeatureReference,
  type PredictionMatchContext,
  type PredictionSnapshotTrigger,
} from "./final-prediction-domain.js";
import {
  composeFinalPredictionSnapshot,
  type PredictionSpecialistInput,
  type SpecialistPredictionOutput,
} from "./prediction-engine-v1.js";

export const COMPETITION_MODEL_PROFILE = "competition_baseline_v1" as const;
export const COMPETITION_MODEL_VERSION = "competition-baseline-v1" as const;

export type CompetitionMarketDirection =
  | "home"
  | "neutral"
  | "away"
  | "volatile"
  | "unknown";

export type CompetitionMarketEvidence = {
  available: boolean;
  usable_for_model: boolean;
  assessment_id: string | null;
  reliability_score: number;
  approved_model_weight_cap: number;
  final_outcome: FinalOutcomeProbabilities | null;
  next_goal: NextGoalProbabilities | null;
  direction: CompetitionMarketDirection;
  limitations: string[];
};

export type CompetitionEventEvidence = {
  available: boolean;
  home_pressure: number;
  away_pressure: number;
  home_impact: number;
  away_impact: number;
  limitations: string[];
};

export type CompetitionPredictionInput = {
  fixture_id: string;
  as_of: string;
  generated_at: string;
  sequence: number | null;
  trigger: PredictionSnapshotTrigger;
  feature_reference: PredictionFeatureReference;
  phase: string | null;
  normalized_phase: PredictionMatchContext["normalized_phase"];
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  freshness_score: number;
  market: CompetitionMarketEvidence;
  events: CompetitionEventEvidence;
};

type RiskReason = FinalPredictionRisk["reasons"][number];

const MAX_REGULATION_MINUTE = 95;
const BASELINE_CALIBRATION_SCORE = 0.45;
const MAX_BASELINE_CONFIDENCE = 0.78;
const DEFAULT_MAX_SCORELINES = 8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round12(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function assertUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be within 0..1.`);
  }
}

function assertScore(value: number | null, name: string): void {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new RangeError(`${name} must be null or a non-negative integer.`);
  }
}

function assertMinute(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 120)) {
    throw new RangeError("minute must be null or an integer within 0..120.");
  }
}

function assertDistribution<K extends string>(
  value: Record<K, number>,
  keys: readonly K[],
  name: string,
): void {
  let total = 0;
  for (const key of keys) {
    assertUnit(value[key], `${name}.${key}`);
    total += value[key];
  }
  if (Math.abs(total - 1) > 1e-6) {
    throw new RangeError(`${name} must sum to one.`);
  }
}

function normalize<K extends string>(
  raw: Record<K, number>,
  keys: readonly K[],
): Record<K, number> {
  const safe = keys.map((key) => Math.max(0, Number.isFinite(raw[key]) ? raw[key] : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  const source = total > 0 ? safe.map((value) => value / total) : safe.map(() => 1 / keys.length);
  let assigned = 0;
  const result = {} as Record<K, number>;
  keys.forEach((key, index) => {
    const value = index === keys.length - 1
      ? round12(clamp01(1 - assigned))
      : round12(clamp01(source[index]!));
    result[key] = value;
    assigned += value;
  });
  return result;
}

function hasScoreboard(input: CompetitionPredictionInput): boolean {
  return input.home_score !== null && input.away_score !== null;
}

function currentScores(input: CompetitionPredictionInput): { home: number; away: number } {
  return {
    home: input.home_score ?? 0,
    away: input.away_score ?? 0,
  };
}

function progress(input: CompetitionPredictionInput): number {
  if (input.normalized_phase === "finished") return 1;
  if (input.normalized_phase === "pre_match") return 0;
  return input.minute === null ? 0.5 : clamp01(input.minute / MAX_REGULATION_MINUTE);
}

function remainingMinutes(input: CompetitionPredictionInput): number {
  if (input.normalized_phase === "finished") return 0;
  if (input.minute === null) return 45;
  return Math.max(0, MAX_REGULATION_MINUTE - input.minute);
}

function eventBalance(input: CompetitionPredictionInput): number {
  if (!input.events.available) return 0;
  const home = (input.events.home_pressure + input.events.home_impact) / 2;
  const away = (input.events.away_pressure + input.events.away_impact) / 2;
  return clamp01((home - away + 1) / 2) * 2 - 1;
}

function terminalOutput(input: CompetitionPredictionInput): FinalPredictionModelOutput {
  const { home, away } = currentScores(input);
  const finalOutcome: FinalOutcomeProbabilities = home > away
    ? { home: 1, draw: 0, away: 0 }
    : home < away
      ? { home: 0, draw: 0, away: 1 }
      : { home: 0, draw: 1, away: 0 };
  return {
    final_outcome: finalOutcome,
    next_goal: { home: 0, none: 1, away: 0 },
    goal_horizon: { next_5m: 0, next_10m: 0, next_15m: 0 },
    final_score: {
      outcomes: [{ home_score: home, away_score: away, probability: 1 }],
      other_probability: 0,
    },
    current_result_survival: {
      current_result_holds: 1,
      current_result_changes: 0,
    },
    momentum_shift: {
      home_strengthens: 0,
      neutral: 1,
      away_strengthens: 0,
    },
  };
}

function fallbackOutput(input: CompetitionPredictionInput): FinalPredictionModelOutput {
  if (input.normalized_phase === "finished" && hasScoreboard(input)) {
    return terminalOutput(input);
  }
  const { home, away } = currentScores(input);
  const outcome = normalize(
    { home: 0.36, draw: 0.31, away: 0.33 },
    ["home", "draw", "away"] as const,
  );
  const nextGoal = normalize(
    { home: 0.31, none: 0.38, away: 0.31 },
    ["home", "none", "away"] as const,
  );
  return {
    final_outcome: outcome,
    next_goal: nextGoal,
    goal_horizon: { next_5m: 0.06, next_10m: 0.12, next_15m: 0.18 },
    final_score: {
      outcomes: [
        { home_score: home, away_score: away, probability: 0.38 },
        { home_score: home + 1, away_score: away, probability: 0.2 },
        { home_score: home, away_score: away + 1, probability: 0.18 },
      ],
      other_probability: 0.24,
    },
    current_result_survival: {
      current_result_holds: 0.52,
      current_result_changes: 0.48,
    },
    momentum_shift: {
      home_strengthens: 0.27,
      neutral: 0.48,
      away_strengthens: 0.25,
    },
  };
}

function stateOutput(input: CompetitionPredictionInput): SpecialistPredictionOutput {
  const p = progress(input);
  const { home, away } = currentScores(input);
  const diff = home - away;
  const rawOutcome = { home: 0.37, draw: 0.3, away: 0.33 };

  if (diff > 0) {
    const shift = Math.min(0.72, 0.16 * diff + 0.46 * p);
    rawOutcome.home += shift;
    rawOutcome.draw -= shift * 0.58;
    rawOutcome.away -= shift * 0.42;
  } else if (diff < 0) {
    const shift = Math.min(0.72, 0.16 * Math.abs(diff) + 0.46 * p);
    rawOutcome.away += shift;
    rawOutcome.draw -= shift * 0.58;
    rawOutcome.home -= shift * 0.42;
  } else {
    const drawShift = 0.2 * p;
    rawOutcome.draw += drawShift;
    rawOutcome.home -= drawShift * 0.48;
    rawOutcome.away -= drawShift * 0.52;
  }

  const none = clamp01(0.2 + 0.62 * p);
  const homeShare = clamp01(0.52 + (diff < 0 ? 0.12 : diff > 0 ? -0.05 : 0));
  const awayShare = 1 - homeShare;
  const nextGoal = normalize(
    {
      home: (1 - none) * homeShare,
      none,
      away: (1 - none) * awayShare,
    },
    ["home", "none", "away"] as const,
  );

  const holds = input.normalized_phase === "finished"
    ? 1
    : diff === 0
      ? clamp01(0.3 + 0.5 * p)
      : clamp01(0.48 + 0.43 * p + 0.05 * Math.min(3, Math.abs(diff)));

  const momentum = normalize(
    {
      home_strengthens: 0.28 + (diff < 0 ? 0.16 : 0) + (diff > 0 ? -0.04 : 0),
      neutral: 0.44 + 0.12 * p,
      away_strengthens: 0.28 + (diff > 0 ? 0.16 : 0) + (diff < 0 ? -0.04 : 0),
    },
    ["home_strengthens", "neutral", "away_strengthens"] as const,
  );

  return {
    final_outcome: normalize(rawOutcome, ["home", "draw", "away"] as const),
    next_goal: nextGoal,
    current_result_survival: {
      current_result_holds: round12(holds),
      current_result_changes: round12(1 - holds),
    },
    momentum_shift: momentum,
  };
}

function marketOutput(input: CompetitionPredictionInput): SpecialistPredictionOutput {
  const output: SpecialistPredictionOutput = {};
  if (input.market.final_outcome !== null) {
    output.final_outcome = structuredClone(input.market.final_outcome);
  }
  if (input.market.next_goal !== null) {
    output.next_goal = structuredClone(input.market.next_goal);
  }
  const direction = input.market.direction;
  output.momentum_shift = direction === "home"
    ? { home_strengthens: 0.56, neutral: 0.3, away_strengthens: 0.14 }
    : direction === "away"
      ? { home_strengthens: 0.14, neutral: 0.3, away_strengthens: 0.56 }
      : direction === "volatile"
        ? { home_strengthens: 0.28, neutral: 0.44, away_strengthens: 0.28 }
        : { home_strengthens: 0.22, neutral: 0.56, away_strengthens: 0.22 };
  return output;
}

function eventOutput(input: CompetitionPredictionInput): SpecialistPredictionOutput {
  const homeSignal = clamp01((input.events.home_pressure + input.events.home_impact) / 2);
  const awaySignal = clamp01((input.events.away_pressure + input.events.away_impact) / 2);
  const neutral = clamp01(0.48 - 0.18 * Math.abs(homeSignal - awaySignal));
  const nextGoal = normalize(
    {
      home: 0.22 + 0.58 * homeSignal,
      none: 0.28,
      away: 0.22 + 0.58 * awaySignal,
    },
    ["home", "none", "away"] as const,
  );
  const finalOutcome = normalize(
    {
      home: 0.34 + 0.28 * homeSignal,
      draw: 0.34,
      away: 0.32 + 0.28 * awaySignal,
    },
    ["home", "draw", "away"] as const,
  );
  const momentum = normalize(
    {
      home_strengthens: 0.18 + 0.72 * homeSignal,
      neutral,
      away_strengthens: 0.18 + 0.72 * awaySignal,
    },
    ["home_strengthens", "neutral", "away_strengthens"] as const,
  );
  return { final_outcome: finalOutcome, next_goal: nextGoal, momentum_shift: momentum };
}

function goalHazardOutput(input: CompetitionPredictionInput): SpecialistPredictionOutput {
  if (input.normalized_phase === "finished") {
    return {
      next_goal: { home: 0, none: 1, away: 0 },
      goal_horizon: { next_5m: 0, next_10m: 0, next_15m: 0 },
    };
  }

  const remaining = remainingMinutes(input);
  const eventIntensity = input.events.available
    ? (input.events.home_pressure + input.events.away_pressure + input.events.home_impact + input.events.away_impact) / 4
    : 0.35;
  const p5Base = clamp01(0.045 + 0.09 * eventIntensity);
  const horizon = (minutes: number): number => {
    const effective = Math.min(minutes, remaining);
    if (effective <= 0) return 0;
    const periods = effective / 5;
    return round12(clamp01(1 - Math.pow(1 - p5Base, periods)));
  };
  const next5 = horizon(5);
  const next10 = Math.max(next5, horizon(10));
  const next15 = Math.max(next10, horizon(15));

  const { home, away } = currentScores(input);
  const diff = home - away;
  let homeAttack = 0.51 + (diff < 0 ? 0.1 : diff > 0 ? -0.05 : 0);
  if (input.events.available) homeAttack += eventBalance(input) * 0.16;
  if (input.market.usable_for_model && input.market.next_goal !== null) {
    homeAttack = homeAttack * 0.65 + input.market.next_goal.home * 0.35;
  }
  homeAttack = clamp01(homeAttack);
  const goalBeforeEnd = remaining <= 0
    ? 0
    : clamp01(1 - Math.pow(1 - p5Base, Math.max(1, remaining / 5)));
  const nextGoal = normalize(
    {
      home: goalBeforeEnd * homeAttack,
      none: 1 - goalBeforeEnd,
      away: goalBeforeEnd * (1 - homeAttack),
    },
    ["home", "none", "away"] as const,
  );

  return {
    next_goal: nextGoal,
    goal_horizon: { next_5m: next5, next_10m: next10, next_15m: next15 },
  };
}

function scorelineOutput(input: CompetitionPredictionInput): SpecialistPredictionOutput {
  const { home, away } = currentScores(input);
  if (input.normalized_phase === "finished") {
    return { final_score: terminalOutput(input).final_score };
  }
  const remainingFactor = clamp01(remainingMinutes(input) / 70);
  const balance = eventBalance(input);
  const homeAttack = clamp01(0.52 + 0.18 * balance);
  const awayAttack = 1 - homeAttack;
  const otherProbability = round12(0.08 + 0.14 * remainingFactor);
  const candidates = [
    { home_score: home, away_score: away, weight: 0.42 + 0.42 * (1 - remainingFactor) },
    { home_score: home + 1, away_score: away, weight: 0.24 * remainingFactor * homeAttack },
    { home_score: home, away_score: away + 1, weight: 0.24 * remainingFactor * awayAttack },
    { home_score: home + 1, away_score: away + 1, weight: 0.13 * remainingFactor },
    { home_score: home + 2, away_score: away, weight: 0.08 * remainingFactor * homeAttack },
    { home_score: home, away_score: away + 2, weight: 0.08 * remainingFactor * awayAttack },
  ];
  const weightTotal = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let assigned = 0;
  const targetMass = 1 - otherProbability;
  const outcomes = candidates.map((candidate, index) => {
    const probability = index === candidates.length - 1
      ? round12(clamp01(targetMass - assigned))
      : round12(clamp01(targetMass * candidate.weight / weightTotal));
    assigned += probability;
    return {
      home_score: candidate.home_score,
      away_score: candidate.away_score,
      probability,
    };
  });
  const finalScore: FinalScoreDistribution = { outcomes, other_probability: otherProbability };
  return { final_score: finalScore };
}

function coverage(input: CompetitionPredictionInput): PredictionDataCoverage {
  const scoreboard = hasScoreboard(input);
  const indicators = [
    scoreboard,
    input.minute !== null,
    input.market.available,
    input.market.usable_for_model,
    input.events.available,
    input.events.available && (input.events.home_impact > 0 || input.events.away_impact > 0),
  ];
  const featureCoverageScore = indicators.filter(Boolean).length / indicators.length;
  return {
    has_fixture: true,
    has_scoreboard: scoreboard,
    has_minute: input.minute !== null,
    has_odds: input.market.available,
    has_reliable_odds: input.market.usable_for_model,
    has_events: input.events.available,
    has_event_impact: input.events.available && (input.events.home_impact > 0 || input.events.away_impact > 0),
    has_pre_match_features: input.normalized_phase === "pre_match",
    feature_coverage_score: round12(featureCoverageScore),
  };
}

function agreementScore(
  state: FinalOutcomeProbabilities | undefined,
  market: FinalOutcomeProbabilities | null,
): number {
  if (state === undefined || market === null) return 0.5;
  const distance = (
    Math.abs(state.home - market.home) +
    Math.abs(state.draw - market.draw) +
    Math.abs(state.away - market.away)
  ) / 2;
  return round12(clamp01(1 - distance));
}

function confidenceAndRisk(
  input: CompetitionPredictionInput,
  dataCoverage: PredictionDataCoverage,
  state: SpecialistPredictionOutput,
  fallbackUsed: boolean,
): { confidence: FinalPredictionConfidence; risk: FinalPredictionRisk } {
  const agreement = agreementScore(state.final_outcome, input.market.final_outcome);
  const reliability = input.market.usable_for_model ? input.market.reliability_score : 0.25;
  const outOfDistribution = clamp01(
    (dataCoverage.has_scoreboard ? 0 : 0.45) +
    (input.normalized_phase === "unknown" ? 0.35 : 0) +
    (input.minute === null ? 0.15 : 0),
  );
  const rawScore =
    0.35 * dataCoverage.feature_coverage_score +
    0.25 * input.freshness_score +
    0.2 * reliability +
    0.2 * agreement -
    0.15 * outOfDistribution;
  const score = round12(Math.min(MAX_BASELINE_CONFIDENCE, clamp01(rawScore)));
  const level: FinalPredictionConfidence["level"] = score < 0.3
    ? "very_low"
    : score < 0.45
      ? "low"
      : score < 0.65
        ? "medium"
        : "high";
  const reasons = [
    dataCoverage.has_scoreboard ? "Canonical score state is available." : "Scoreboard coverage is missing.",
    input.market.usable_for_model ? "Reliable market context is available." : "Reliable market context is unavailable.",
    input.events.available ? "Event-pressure context is available." : "Event-pressure context is unavailable.",
    "The competition baseline is deterministic but not production calibrated.",
  ];

  const riskReasons: RiskReason[] = [];
  if (input.freshness_score < 0.5) riskReasons.push("stale_data");
  if (input.minute === null) riskReasons.push("missing_minute");
  if (!input.events.available) riskReasons.push("missing_events");
  if (!input.market.available) riskReasons.push("missing_odds");
  else if (!input.market.usable_for_model) riskReasons.push("unreliable_odds");
  if (agreement < 0.55 && input.market.usable_for_model) riskReasons.push("model_disagreement");
  if (outOfDistribution >= 0.5) riskReasons.push("out_of_distribution");
  if (dataCoverage.feature_coverage_score < 0.7) riskReasons.push("partial_feature_coverage");
  if (fallbackUsed) riskReasons.push("inference_fallback");
  const uniqueReasons = [...new Set(riskReasons)];
  const riskLevel: FinalPredictionRisk["level"] =
    !dataCoverage.has_scoreboard || uniqueReasons.length >= 4
      ? "high"
      : uniqueReasons.length >= 2
        ? "medium"
        : "low";

  return {
    confidence: {
      level,
      score,
      calibration_score: BASELINE_CALIBRATION_SCORE,
      model_agreement_score: agreement,
      data_coverage_score: dataCoverage.feature_coverage_score,
      freshness_score: round12(input.freshness_score),
      out_of_distribution_score: round12(outOfDistribution),
      reasons,
    },
    risk: { level: riskLevel, reasons: uniqueReasons },
  };
}

function explanation(
  input: CompetitionPredictionInput,
  marketWeight: number,
  fallbackUsed: boolean,
): FinalPredictionSnapshot["explanation"] {
  const scoreboard = hasScoreboard(input);
  const { home, away } = currentScores(input);
  const mainFactors: string[] = [];
  if (scoreboard) {
    mainFactors.push(`Current score is ${home}-${away}${input.minute === null ? "." : ` at minute ${input.minute}.`}`);
  }
  if (marketWeight > 0) mainFactors.push("Reliable market context contributes within the approved cap.");
  if (input.events.available) {
    const balance = eventBalance(input);
    mainFactors.push(
      balance > 0.08
        ? "Recent event pressure favors the home side."
        : balance < -0.08
          ? "Recent event pressure favors the away side."
          : "Recent event pressure is broadly balanced.",
    );
  }
  if (mainFactors.length === 0) mainFactors.push("The output uses conservative deterministic priors.");

  const limitations = [
    "competition_baseline_v1 is intentionally limited and not production calibrated.",
    ...input.market.limitations,
    ...input.events.limitations,
  ];
  if (!scoreboard) limitations.push("Current score is unavailable.");
  if (input.minute === null) limitations.push("Current match minute is unavailable.");
  if (fallbackUsed) limitations.push("A conservative fallback contributes because evidence is incomplete.");

  const summary = input.normalized_phase === "finished" && scoreboard
    ? "The match is finished, so all terminal probabilities reflect the recorded final score."
    : scoreboard
      ? "The competition baseline combines score, time, bounded market context, and available event pressure."
      : "The competition baseline returns a complete conservative output with reduced confidence because scoreboard evidence is incomplete.";
  return {
    summary,
    main_factors: [...new Set(mainFactors)],
    limitations: [...new Set(limitations)].sort(),
  };
}

function assignWeights(
  candidates: Array<Omit<PredictionSpecialistInput, "assigned_weight"> & { raw_weight: number }>,
  marketCap: number,
): PredictionSpecialistInput[] {
  const marketCandidate = candidates.find((candidate) => candidate.model_role === "market");
  const assignedMarket = marketCandidate === undefined ? 0 : Math.min(0.2, clamp01(marketCap));
  const nonMarket = candidates.filter((candidate) => candidate.model_role !== "market");
  const rawTotal = nonMarket.reduce((sum, candidate) => sum + candidate.raw_weight, 0);
  let nonMarketAssigned = 0;
  const specialists: PredictionSpecialistInput[] = [];

  for (const candidate of candidates) {
    const { raw_weight: _rawWeight, ...rest } = candidate;
    if (candidate.model_role === "market") {
      specialists.push({ ...rest, assigned_weight: round12(assignedMarket) });
      continue;
    }
    const index = nonMarket.findIndex((item) => item === candidate);
    const isLast = index === nonMarket.length - 1;
    const weight = isLast
      ? round12(clamp01(1 - assignedMarket - nonMarketAssigned))
      : round12(clamp01((1 - assignedMarket) * candidate.raw_weight / rawTotal));
    nonMarketAssigned += weight;
    specialists.push({ ...rest, assigned_weight: weight });
  }
  return specialists;
}

function validateInput(input: CompetitionPredictionInput): void {
  if (input.fixture_id.trim() === "") throw new TypeError("fixture_id must be non-empty.");
  if (!Number.isFinite(Date.parse(input.as_of)) || !Number.isFinite(Date.parse(input.generated_at))) {
    throw new TypeError("as_of and generated_at must be valid ISO timestamps.");
  }
  if (Date.parse(input.generated_at) < Date.parse(input.as_of)) {
    throw new RangeError("generated_at cannot precede as_of.");
  }
  assertMinute(input.minute);
  assertScore(input.home_score, "home_score");
  assertScore(input.away_score, "away_score");
  if ((input.home_score === null) !== (input.away_score === null)) {
    throw new Error("home_score and away_score must be both present or both null.");
  }
  assertUnit(input.freshness_score, "freshness_score");
  assertUnit(input.market.reliability_score, "market.reliability_score");
  assertUnit(input.market.approved_model_weight_cap, "market.approved_model_weight_cap");
  for (const [name, value] of Object.entries({
    home_pressure: input.events.home_pressure,
    away_pressure: input.events.away_pressure,
    home_impact: input.events.home_impact,
    away_impact: input.events.away_impact,
  })) {
    assertUnit(value, `events.${name}`);
  }
  if (input.market.final_outcome !== null) {
    assertDistribution(input.market.final_outcome, ["home", "draw", "away"] as const, "market.final_outcome");
  }
  if (input.market.next_goal !== null) {
    assertDistribution(input.market.next_goal, ["home", "none", "away"] as const, "market.next_goal");
  }
  if (input.market.usable_for_model) {
    if (!input.market.available || input.market.assessment_id === null || input.market.reliability_score <= 0 || input.market.approved_model_weight_cap <= 0) {
      throw new Error("Usable market evidence requires availability, assessment identity, reliability, and a positive cap.");
    }
  }
}

export function buildCompetitionPredictionSnapshot(
  input: CompetitionPredictionInput,
): FinalPredictionSnapshot {
  validateInput(input);
  const fallback = fallbackOutput(input);
  const matchContext: PredictionMatchContext = {
    phase: input.phase,
    normalized_phase: input.normalized_phase,
    minute: input.minute,
    home_score: input.home_score,
    away_score: input.away_score,
    score_diff: hasScoreboard(input) ? input.home_score! - input.away_score! : null,
  };
  const dataCoverage = coverage(input);

  if (input.normalized_phase === "finished" && hasScoreboard(input)) {
    const output = terminalOutput(input);
    return composeFinalPredictionSnapshot({
      fixture_id: input.fixture_id,
      as_of: input.as_of,
      generated_at: input.generated_at,
      sequence: input.sequence,
      trigger: input.trigger,
      feature_reference: structuredClone(input.feature_reference),
      match_context: matchContext,
      data_coverage: dataCoverage,
      specialists: [{
        model_role: "live_state",
        model_version: `${COMPETITION_MODEL_VERSION}:terminal`,
        available: true,
        assigned_weight: 1,
        output_quality: 1,
        limitations: [],
        output,
      }],
      fallback_output: output,
      confidence: {
        level: "high",
        score: MAX_BASELINE_CONFIDENCE,
        calibration_score: BASELINE_CALIBRATION_SCORE,
        model_agreement_score: 1,
        data_coverage_score: dataCoverage.feature_coverage_score,
        freshness_score: input.freshness_score,
        out_of_distribution_score: 0,
        reasons: ["The match is finished and the terminal score state is available."],
      },
      risk: { level: "low", reasons: [] },
      odds_intelligence_reference: {
        odds_intelligence_version: "odds-intelligence-v1",
        assessment_id: null,
        usable_for_model: false,
        reliability_score: input.market.reliability_score,
        assigned_market_weight: 0,
      },
      explanation: explanation(input, 0, false),
      composition_policy: { max_scorelines: DEFAULT_MAX_SCORELINES },
    });
  }

  const state = stateOutput(input);
  const candidates: Array<Omit<PredictionSpecialistInput, "assigned_weight"> & { raw_weight: number }> = [];
  const stateRole = input.normalized_phase === "pre_match" ? "pre_match_prior" : "live_state";
  if (hasScoreboard(input) || input.normalized_phase === "pre_match") {
    candidates.push({
      model_role: stateRole,
      model_version: `${COMPETITION_MODEL_VERSION}:state`,
      available: true,
      raw_weight: 0.36,
      output_quality: dataCoverage.has_scoreboard ? 0.82 : 0.55,
      limitations: dataCoverage.has_scoreboard ? [] : ["Scoreboard evidence is unavailable."],
      output: state,
    });
  }
  if (input.market.usable_for_model && (input.market.final_outcome !== null || input.market.next_goal !== null)) {
    candidates.push({
      model_role: "market",
      model_version: `${COMPETITION_MODEL_VERSION}:market`,
      available: true,
      raw_weight: 0.2,
      output_quality: input.market.reliability_score,
      limitations: [...input.market.limitations],
      output: marketOutput(input),
    });
  }
  if (input.events.available) {
    candidates.push({
      model_role: "event_sequence",
      model_version: `${COMPETITION_MODEL_VERSION}:event`,
      available: true,
      raw_weight: 0.16,
      output_quality: clamp01(0.55 + 0.25 * Math.max(input.events.home_pressure, input.events.away_pressure)),
      limitations: [...input.events.limitations],
      output: eventOutput(input),
    });
  }
  candidates.push({
    model_role: "goal_hazard",
    model_version: `${COMPETITION_MODEL_VERSION}:goal-hazard`,
    available: true,
    raw_weight: 0.18,
    output_quality: input.minute === null ? 0.5 : 0.75,
    limitations: input.minute === null ? ["Minute is unavailable; goal horizons use a conservative window."] : [],
    output: goalHazardOutput(input),
  });
  if (hasScoreboard(input)) {
    candidates.push({
      model_role: "score_distribution",
      model_version: `${COMPETITION_MODEL_VERSION}:scoreline`,
      available: true,
      raw_weight: 0.16,
      output_quality: input.minute === null ? 0.55 : 0.78,
      limitations: input.minute === null ? ["Minute is unavailable; scoreline spread is conservative."] : [],
      output: scorelineOutput(input),
    });
  }
  const fallbackUsed = !hasScoreboard(input) || input.minute === null || !input.market.usable_for_model || !input.events.available;
  candidates.push({
    model_role: "fallback",
    model_version: `${COMPETITION_MODEL_VERSION}:fallback`,
    available: true,
    raw_weight: fallbackUsed ? 0.16 : 0.05,
    output_quality: fallbackUsed ? 0.45 : 0.6,
    limitations: fallbackUsed ? ["Conservative fallback contributes because evidence is incomplete."] : [],
    output: fallback,
  });

  const marketCap = input.market.usable_for_model ? input.market.approved_model_weight_cap : 0;
  const specialists = assignWeights(candidates, marketCap);
  const assignedMarketWeight = specialists
    .filter((specialist) => specialist.model_role === "market")
    .reduce((sum, specialist) => sum + specialist.assigned_weight, 0);
  const { confidence, risk } = confidenceAndRisk(input, dataCoverage, state, fallbackUsed);

  return composeFinalPredictionSnapshot({
    fixture_id: input.fixture_id,
    as_of: input.as_of,
    generated_at: input.generated_at,
    sequence: input.sequence,
    trigger: input.trigger,
    feature_reference: structuredClone(input.feature_reference),
    match_context: matchContext,
    data_coverage: dataCoverage,
    specialists,
    fallback_output: fallback,
    confidence,
    risk,
    odds_intelligence_reference: {
      odds_intelligence_version: "odds-intelligence-v1",
      assessment_id: assignedMarketWeight > 0 ? input.market.assessment_id : null,
      usable_for_model: assignedMarketWeight > 0,
      reliability_score: input.market.reliability_score,
      assigned_market_weight: assignedMarketWeight,
    },
    explanation: explanation(input, assignedMarketWeight, fallbackUsed),
    composition_policy: { max_scorelines: DEFAULT_MAX_SCORELINES },
  });
}
