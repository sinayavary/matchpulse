import type {
  CurrentResultSurvival,
  FinalOutcomeProbabilities,
  FinalScoreDistribution,
  GoalHorizonProbabilities,
  MomentumShiftProbabilities,
  NextGoalProbabilities,
  SpecialistModelContribution,
} from "./final-prediction-domain.js";
import type { PredictionEngineFeatureSnapshot } from "./prediction-engine-features.js";

export const PREDICTION_SPECIALIST_VERSION = "prediction-specialists-v1" as const;

export type PredictionSpecialistResult = {
  model_role: SpecialistModelContribution["model_role"];
  model_version: string;
  available: boolean;
  quality: number;
  final_outcome: FinalOutcomeProbabilities | null;
  next_goal: NextGoalProbabilities | null;
  goal_horizon: GoalHorizonProbabilities | null;
  final_score: FinalScoreDistribution | null;
  current_result_survival: CurrentResultSurvival | null;
  momentum_shift: MomentumShiftProbabilities | null;
  limitations: string[];
};

export type PredictionSpecialistBundle = {
  specialist_version: typeof PREDICTION_SPECIALIST_VERSION;
  fixture_id: string;
  as_of: string;
  state: PredictionSpecialistResult;
  tempo: PredictionSpecialistResult;
  market: PredictionSpecialistResult;
  score_distribution: PredictionSpecialistResult;
  fallback: PredictionSpecialistResult;
};

const NEUTRAL_PRIOR: FinalOutcomeProbabilities = {
  home: 1 / 3,
  draw: 1 / 3,
  away: 1 / 3,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round12(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function normalize(values: readonly number[]): number[] {
  const clean = values.map((value) => Number.isFinite(value) && value > 0 ? value : 0);
  const total = clean.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return clean.map(() => 1 / clean.length);
  return clean.map((value) => round12(value / total));
}

function softmax(values: readonly number[]): number[] {
  const maximum = Math.max(...values);
  return normalize(values.map((value) => Math.exp(value - maximum)));
}

function prior(features: PredictionEngineFeatureSnapshot): FinalOutcomeProbabilities {
  return features.pre_match_prior ?? NEUTRAL_PRIOR;
}

function progress(features: PredictionEngineFeatureSnapshot): number {
  if (features.match.normalized_phase === "finished") return 1;
  if (features.match.normalized_phase === "pre_match") return 0;
  if (features.match.normalized_phase === "halftime") return 0.5;
  if (features.match.normalized_phase === "extra_time") {
    return features.match.minute === null
      ? 0.95
      : clamp01(0.9 + Math.max(0, features.match.minute - 90) / 300);
  }
  if (features.match.minute !== null) return clamp01(features.match.minute / 90);
  return features.match.normalized_phase === "second_half" ? 0.7 : 0.25;
}

function finalOutcomeFromState(
  features: PredictionEngineFeatureSnapshot,
): FinalOutcomeProbabilities | null {
  const homeScore = features.match.home_score;
  const awayScore = features.match.away_score;
  if (homeScore === null || awayScore === null) return null;
  const difference = homeScore - awayScore;
  if (features.match.normalized_phase === "finished") {
    return difference > 0
      ? { home: 1, draw: 0, away: 0 }
      : difference < 0
        ? { home: 0, draw: 0, away: 1 }
        : { home: 0, draw: 1, away: 0 };
  }

  const base = prior(features);
  const time = progress(features);
  const leadStrength = 0.9 + 2.2 * time;
  const drawPenalty = Math.abs(difference) * (0.7 + 1.8 * time);
  const [home, draw, away] = softmax([
    Math.log(Math.max(base.home, 1e-9)) + difference * leadStrength,
    Math.log(Math.max(base.draw, 1e-9)) - drawPenalty + (difference === 0 ? 0.25 * time : 0),
    Math.log(Math.max(base.away, 1e-9)) - difference * leadStrength,
  ]);
  return { home: home!, draw: draw!, away: away! };
}

function survival(
  features: PredictionEngineFeatureSnapshot,
  outcome: FinalOutcomeProbabilities,
): CurrentResultSurvival {
  const difference = features.match.score_diff ?? 0;
  const holds = difference > 0 ? outcome.home : difference < 0 ? outcome.away : outcome.draw;
  return {
    current_result_holds: round12(holds),
    current_result_changes: round12(1 - holds),
  };
}

function pressureValue(features: PredictionEngineFeatureSnapshot): number {
  const values = { none: 0, low: 0.12, medium: 0.28, high: 0.48 } as const;
  return values[features.event_context.pressure_level];
}

function remainingMinutes(features: PredictionEngineFeatureSnapshot): number {
  if (features.match.normalized_phase === "finished") return 0;
  const end = features.match.normalized_phase === "extra_time" ? 120 : 95;
  if (features.match.minute === null) {
    if (features.match.normalized_phase === "pre_match") return 95;
    if (features.match.normalized_phase === "halftime") return 50;
    if (features.match.normalized_phase === "second_half") return 25;
    return 45;
  }
  return Math.max(0, end - features.match.minute);
}

type TempoParameters = {
  home_share: number;
  away_share: number;
  total_rate_per_minute: number;
  remaining_minutes: number;
  home_lambda: number;
  away_lambda: number;
};

function tempoParameters(features: PredictionEngineFeatureSnapshot): TempoParameters {
  const pressure = pressureValue(features);
  const pressureHome = features.event_context.pressure_side === "home" ? pressure : 0;
  const pressureAway = features.event_context.pressure_side === "away" ? pressure : 0;
  const neutralPressure = ["neutral", "unknown"].includes(features.event_context.pressure_side)
    ? pressure * 0.25
    : 0;
  const homeStrength =
    1 +
    0.8 * features.event_context.home_activity +
    pressureHome -
    0.42 * features.event_context.home_red_cards +
    0.18 * features.event_context.away_red_cards +
    neutralPressure;
  const awayStrength =
    1 +
    0.8 * features.event_context.away_activity +
    pressureAway -
    0.42 * features.event_context.away_red_cards +
    0.18 * features.event_context.home_red_cards +
    neutralPressure;
  const [homeShare, awayShare] = normalize([
    Math.max(0.05, homeStrength),
    Math.max(0.05, awayStrength),
  ]);
  const activity = (features.event_context.home_activity + features.event_context.away_activity) / 2;
  const cardActivity = Math.min(
    0.35,
    0.08 * (features.event_context.home_red_cards + features.event_context.away_red_cards),
  );
  const totalRate = 0.0275 * (0.82 + 0.55 * activity + 0.35 * pressure + cardActivity);
  const remaining = remainingMinutes(features);
  const totalLambda = totalRate * remaining;
  return {
    home_share: homeShare!,
    away_share: awayShare!,
    total_rate_per_minute: round12(totalRate),
    remaining_minutes: remaining,
    home_lambda: round12(totalLambda * homeShare!),
    away_lambda: round12(totalLambda * awayShare!),
  };
}

function tempoOutputs(features: PredictionEngineFeatureSnapshot): {
  next_goal: NextGoalProbabilities;
  goal_horizon: GoalHorizonProbabilities;
  momentum_shift: MomentumShiftProbabilities;
  parameters: TempoParameters;
} {
  const parameters = tempoParameters(features);
  const anyGoal = 1 - Math.exp(
    -parameters.total_rate_per_minute * parameters.remaining_minutes,
  );
  const nextGoal = normalize([
    anyGoal * parameters.home_share,
    1 - anyGoal,
    anyGoal * parameters.away_share,
  ]);
  const horizon = (minutes: number): number => round12(
    1 - Math.exp(
      -parameters.total_rate_per_minute *
      Math.min(minutes, parameters.remaining_minutes),
    ),
  );
  const pressure = pressureValue(features);
  const homeMomentum = parameters.home_share + (
    features.event_context.pressure_side === "home" ? pressure : 0
  );
  const awayMomentum = parameters.away_share + (
    features.event_context.pressure_side === "away" ? pressure : 0
  );
  const momentum = softmax([2.2 * homeMomentum, 1.1, 2.2 * awayMomentum]);
  return {
    next_goal: {
      home: nextGoal[0]!,
      none: nextGoal[1]!,
      away: nextGoal[2]!,
    },
    goal_horizon: {
      next_5m: horizon(5),
      next_10m: horizon(10),
      next_15m: horizon(15),
    },
    momentum_shift: {
      home_strengthens: momentum[0]!,
      neutral: momentum[1]!,
      away_strengthens: momentum[2]!,
    },
    parameters,
  };
}

function poisson(lambda: number, value: number): number {
  let factorial = 1;
  for (let index = 2; index <= value; index += 1) factorial *= index;
  return Math.exp(-lambda) * (lambda ** value) / factorial;
}

function scoreDistribution(
  features: PredictionEngineFeatureSnapshot,
  parameters: TempoParameters,
): FinalScoreDistribution | null {
  const currentHome = features.match.home_score;
  const currentAway = features.match.away_score;
  if (currentHome === null || currentAway === null) return null;
  if (features.match.normalized_phase === "finished") {
    return {
      outcomes: [{ home_score: currentHome, away_score: currentAway, probability: 1 }],
      other_probability: 0,
    };
  }

  const all: FinalScoreDistribution["outcomes"] = [];
  for (let homeAdditional = 0; homeAdditional <= 5; homeAdditional += 1) {
    for (let awayAdditional = 0; awayAdditional <= 5; awayAdditional += 1) {
      all.push({
        home_score: currentHome + homeAdditional,
        away_score: currentAway + awayAdditional,
        probability: poisson(parameters.home_lambda, homeAdditional) *
          poisson(parameters.away_lambda, awayAdditional),
      });
    }
  }
  all.sort((left, right) =>
    right.probability - left.probability ||
    left.home_score - right.home_score ||
    left.away_score - right.away_score
  );
  const outcomes = all.slice(0, 12);
  const included = outcomes.reduce((sum, item) => sum + item.probability, 0);
  return {
    outcomes: outcomes.map((item) => ({
      ...item,
      probability: round12(item.probability),
    })),
    other_probability: round12(Math.max(0, 1 - included)),
  };
}

function result(
  role: PredictionSpecialistResult["model_role"],
  available: boolean,
  quality: number,
  values: Partial<Omit<
    PredictionSpecialistResult,
    "model_role" | "model_version" | "available" | "quality" | "limitations"
  >>,
  limitations: string[],
): PredictionSpecialistResult {
  return {
    model_role: role,
    model_version: PREDICTION_SPECIALIST_VERSION,
    available,
    quality: round12(clamp01(quality)),
    final_outcome: values.final_outcome ?? null,
    next_goal: values.next_goal ?? null,
    goal_horizon: values.goal_horizon ?? null,
    final_score: values.final_score ?? null,
    current_result_survival: values.current_result_survival ?? null,
    momentum_shift: values.momentum_shift ?? null,
    limitations: [...new Set(limitations)].sort(),
  };
}

export function buildPredictionSpecialists(
  features: PredictionEngineFeatureSnapshot,
): PredictionSpecialistBundle {
  const stateOutcome = finalOutcomeFromState(features);
  const stateAvailable = stateOutcome !== null;
  const state = result(
    "live_state",
    stateAvailable,
    stateAvailable
      ? 0.55 + 0.25 * progress(features) + (features.coverage.has_minute ? 0.1 : 0)
      : 0,
    stateAvailable
      ? {
          final_outcome: stateOutcome,
          current_result_survival: survival(features, stateOutcome),
        }
      : {},
    stateAvailable ? [] : ["Scoreboard unavailable for live-state specialist."],
  );

  const tempoOutput = tempoOutputs(features);
  const tempoAvailable = features.coverage.has_minute || features.coverage.has_events;
  const tempo = result(
    "goal_hazard",
    tempoAvailable,
    tempoAvailable
      ? 0.38 +
        (features.coverage.has_minute ? 0.22 : 0) +
        (features.coverage.has_events ? 0.18 : 0) +
        (features.coverage.has_event_impact ? 0.12 : 0)
      : 0,
    tempoAvailable
      ? {
          next_goal: tempoOutput.next_goal,
          goal_horizon: tempoOutput.goal_horizon,
          momentum_shift: tempoOutput.momentum_shift,
        }
      : {},
    [
      ...(features.coverage.has_minute ? [] : ["Minute unavailable; tempo horizon is approximate."]),
      ...(features.coverage.has_events ? [] : ["Event history unavailable for tempo context."]),
    ],
  );

  const marketAvailable = features.market.usable && features.market.final_outcome !== null;
  const market = result(
    "market",
    marketAvailable,
    marketAvailable ? features.market.reliability_score : 0,
    marketAvailable ? { final_outcome: features.market.final_outcome } : {},
    features.market.limitations,
  );

  const finalScore = scoreDistribution(features, tempoOutput.parameters);
  const scoreAvailable = finalScore !== null;
  const score = result(
    "score_distribution",
    scoreAvailable,
    scoreAvailable
      ? 0.42 +
        (features.coverage.has_minute ? 0.18 : 0) +
        (features.coverage.has_events ? 0.12 : 0)
      : 0,
    scoreAvailable ? { final_score: finalScore } : {},
    scoreAvailable ? [] : ["Scoreboard unavailable for score-distribution specialist."],
  );

  const fallbackOutcome = prior(features);
  const fallback = result(
    "fallback",
    true,
    features.pre_match_prior === null ? 0.25 : 0.5,
    { final_outcome: fallbackOutcome },
    features.pre_match_prior === null
      ? ["Neutral fallback used because no pre-match prior was available."]
      : ["Pre-match prior used as fallback."],
  );

  return {
    specialist_version: PREDICTION_SPECIALIST_VERSION,
    fixture_id: features.fixture_id,
    as_of: features.as_of,
    state,
    tempo,
    market,
    score_distribution: score,
    fallback,
  };
}
