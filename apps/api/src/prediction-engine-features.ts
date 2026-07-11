import type {
  FinalOutcomeProbabilities,
  PredictionMatchContext,
} from "./final-prediction-domain.js";
import type { InternalOddsIntelligenceContext } from "./odds-intelligence-contract.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export const PREDICTION_ENGINE_FEATURE_VERSION = "prediction-engine-features-v1" as const;

export type PredictionPressureLevel = "none" | "low" | "medium" | "high";
export type PredictionPressureSide = "home" | "away" | "neutral" | "unknown";

export type PredictionMarketSignal = {
  assessment_id: string | null;
  available: boolean;
  usable: boolean;
  reliability_score: number;
  model_weight_cap: number;
  final_outcome: FinalOutcomeProbabilities | null;
  limitations: string[];
};

export type PredictionEngineFeatureSnapshot = {
  feature_version: typeof PREDICTION_ENGINE_FEATURE_VERSION;
  feature_hash: string;
  fixture_id: string;
  as_of: string;
  sequence: number | null;
  match: PredictionMatchContext;
  freshness: {
    score_age_seconds: number | null;
    event_age_seconds: number | null;
    market_age_seconds: number | null;
  };
  coverage: {
    has_fixture: boolean;
    has_scoreboard: boolean;
    has_minute: boolean;
    has_events: boolean;
    has_event_impact: boolean;
    has_market: boolean;
    has_reliable_market: boolean;
    has_pre_match_prior: boolean;
    coverage_score: number;
  };
  pre_match_prior: FinalOutcomeProbabilities | null;
  event_context: {
    event_count: number;
    pressure_level: PredictionPressureLevel;
    pressure_side: PredictionPressureSide;
    home_red_cards: number;
    away_red_cards: number;
    home_activity: number;
    away_activity: number;
  };
  market: PredictionMarketSignal;
  limitations: string[];
};

export type PredictionEngineFeatureInput = {
  fixture_id: string;
  as_of: string;
  sequence?: number | null;
  has_fixture?: boolean;
  normalized_phase: PredictionMatchContext["normalized_phase"];
  phase?: string | null;
  minute?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  score_timestamp?: string | null;
  event_timestamp?: string | null;
  pre_match_prior?: FinalOutcomeProbabilities | null;
  event_context?: {
    event_count?: number;
    pressure_level?: PredictionPressureLevel;
    pressure_side?: PredictionPressureSide;
    home_red_cards?: number;
    away_red_cards?: number;
    home_activity?: number;
    away_activity?: number;
    has_event_impact?: boolean;
  } | null;
  odds_intelligence?: InternalOddsIntelligenceContext | null;
};

const PHASES = new Set<PredictionMatchContext["normalized_phase"]>([
  "pre_match",
  "first_half",
  "halftime",
  "second_half",
  "extra_time",
  "finished",
  "unknown",
]);
const PRESSURE_LEVELS = new Set<PredictionPressureLevel>(["none", "low", "medium", "high"]);
const PRESSURE_SIDES = new Set<PredictionPressureSide>(["home", "away", "neutral", "unknown"]);

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round12(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function iso(value: unknown, name: string): string {
  const source = text(value, name);
  const timestamp = Date.parse(source);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} must be an ISO timestamp.`);
  return new Date(timestamp).toISOString();
}

function optionalIso(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : iso(value, name);
}

function nonNegativeInteger(value: unknown, name: string, fallback = 0): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
  return value as number;
}

function bounded(value: unknown, name: string): number {
  if (!finite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be in 0..1.`);
  }
  return value;
}

function distribution(
  value: FinalOutcomeProbabilities | null | undefined,
  name: string,
): FinalOutcomeProbabilities | null {
  if (value === null || value === undefined) return null;
  const home = bounded(value.home, `${name}.home`);
  const draw = bounded(value.draw, `${name}.draw`);
  const away = bounded(value.away, `${name}.away`);
  const total = home + draw + away;
  if (Math.abs(total - 1) > 1e-6) {
    throw new RangeError(`${name} must sum to one.`);
  }
  return { home: round12(home), draw: round12(draw), away: round12(away) };
}

function ageSeconds(asOf: string, timestamp: string | null): number | null {
  if (timestamp === null) return null;
  const age = (Date.parse(asOf) - Date.parse(timestamp)) / 1_000;
  if (!Number.isFinite(age) || age < 0) {
    throw new RangeError("Feature timestamps cannot be later than as_of.");
  }
  return round12(age);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort();
}

function marketOutcome(
  odds: InternalOddsIntelligenceContext,
): FinalOutcomeProbabilities | null {
  const market = odds.primary_match_result_market;
  if (market === null || !market.complete || !market.usable) return null;
  const values = new Map(market.selections.map((selection) => [
    selection.selection,
    selection.fair_probability,
  ]));
  const home = values.get("home");
  const draw = values.get("draw");
  const away = values.get("away");
  if (!finite(home) || !finite(draw) || !finite(away)) return null;
  return distribution({ home, draw, away }, "market final outcome");
}

export function buildPredictionMarketSignal(
  odds: InternalOddsIntelligenceContext | null | undefined,
): PredictionMarketSignal {
  if (odds === null || odds === undefined) {
    return {
      assessment_id: null,
      available: false,
      usable: false,
      reliability_score: 0,
      model_weight_cap: 0,
      final_outcome: null,
      limitations: ["Market context unavailable."],
    };
  }

  const finalOutcome = marketOutcome(odds);
  const usable = odds.usable_for_model && finalOutcome !== null;
  return {
    assessment_id: odds.assessment_id,
    available: odds.snapshot_count > 0,
    usable,
    reliability_score: round12(clamp01(odds.overall_reliability_score)),
    model_weight_cap: usable
      ? round12(Math.min(0.32, clamp01(odds.recommended_market_model_weight)))
      : 0,
    final_outcome: usable ? finalOutcome : null,
    limitations: uniqueSorted([
      ...odds.limitations,
      ...(usable ? [] : ["Market context is not usable for model blending."]),
    ]),
  };
}

function normalizeEvent(
  value: PredictionEngineFeatureInput["event_context"],
): PredictionEngineFeatureSnapshot["event_context"] & { has_event_impact: boolean } {
  const event = value ?? {};
  const pressureLevel = event.pressure_level ?? "none";
  const pressureSide = event.pressure_side ?? "unknown";
  if (!PRESSURE_LEVELS.has(pressureLevel)) throw new TypeError("Invalid pressure level.");
  if (!PRESSURE_SIDES.has(pressureSide)) throw new TypeError("Invalid pressure side.");
  return {
    event_count: nonNegativeInteger(event.event_count, "event_count"),
    pressure_level: pressureLevel,
    pressure_side: pressureSide,
    home_red_cards: nonNegativeInteger(event.home_red_cards, "home_red_cards"),
    away_red_cards: nonNegativeInteger(event.away_red_cards, "away_red_cards"),
    home_activity: bounded(event.home_activity ?? 0, "home_activity"),
    away_activity: bounded(event.away_activity ?? 0, "away_activity"),
    has_event_impact: event.has_event_impact === true,
  };
}

function coverageScore(flags: readonly boolean[]): number {
  const weights = [0.14, 0.22, 0.14, 0.12, 0.1, 0.14, 0.08, 0.06];
  return round12(flags.reduce((total, flag, index) => total + (flag ? weights[index]! : 0), 0));
}

export function buildPredictionEngineFeatures(
  input: PredictionEngineFeatureInput,
): PredictionEngineFeatureSnapshot {
  const fixtureId = text(input.fixture_id, "fixture_id");
  const asOf = iso(input.as_of, "as_of");
  if (!PHASES.has(input.normalized_phase)) throw new TypeError("Invalid normalized phase.");

  const minute = input.minute === null || input.minute === undefined
    ? null
    : nonNegativeInteger(input.minute, "minute");
  if (minute !== null && minute > 120) throw new RangeError("minute must not exceed 120.");

  const homeScore = input.home_score === null || input.home_score === undefined
    ? null
    : nonNegativeInteger(input.home_score, "home_score");
  const awayScore = input.away_score === null || input.away_score === undefined
    ? null
    : nonNegativeInteger(input.away_score, "away_score");
  if ((homeScore === null) !== (awayScore === null)) {
    throw new TypeError("home_score and away_score must be jointly available.");
  }

  const sequence = input.sequence === null || input.sequence === undefined
    ? null
    : nonNegativeInteger(input.sequence, "sequence");
  const scoreTimestamp = optionalIso(input.score_timestamp, "score_timestamp");
  const eventTimestamp = optionalIso(input.event_timestamp, "event_timestamp");
  const prior = distribution(input.pre_match_prior, "pre_match_prior");
  const event = normalizeEvent(input.event_context);
  const market = buildPredictionMarketSignal(input.odds_intelligence);

  const hasFixture = input.has_fixture !== false;
  const hasScoreboard = homeScore !== null;
  const flags = [
    hasFixture,
    hasScoreboard,
    minute !== null,
    event.event_count > 0,
    event.has_event_impact,
    market.available,
    market.usable,
    prior !== null,
  ] as const;

  const limitations = uniqueSorted([
    ...(hasFixture ? [] : ["Fixture identity unavailable."]),
    ...(hasScoreboard ? [] : ["Scoreboard unavailable."]),
    ...(minute !== null ? [] : ["Match minute unavailable."]),
    ...(event.event_count > 0 ? [] : ["Event history unavailable."]),
    ...(event.has_event_impact ? [] : ["Event-impact context unavailable."]),
    ...market.limitations,
    ...(prior !== null ? [] : ["Pre-match prior unavailable."]),
  ]);

  const withoutHash = {
    feature_version: PREDICTION_ENGINE_FEATURE_VERSION,
    fixture_id: fixtureId,
    as_of: asOf,
    sequence,
    match: {
      phase: input.phase ?? null,
      normalized_phase: input.normalized_phase,
      minute,
      home_score: homeScore,
      away_score: awayScore,
      score_diff: homeScore === null || awayScore === null ? null : homeScore - awayScore,
    },
    freshness: {
      score_age_seconds: ageSeconds(asOf, scoreTimestamp),
      event_age_seconds: ageSeconds(asOf, eventTimestamp),
      market_age_seconds: oddsMarketAge(asOf, input.odds_intelligence),
    },
    coverage: {
      has_fixture: hasFixture,
      has_scoreboard: hasScoreboard,
      has_minute: minute !== null,
      has_events: event.event_count > 0,
      has_event_impact: event.has_event_impact,
      has_market: market.available,
      has_reliable_market: market.usable,
      has_pre_match_prior: prior !== null,
      coverage_score: coverageScore(flags),
    },
    pre_match_prior: prior,
    event_context: {
      event_count: event.event_count,
      pressure_level: event.pressure_level,
      pressure_side: event.pressure_side,
      home_red_cards: event.home_red_cards,
      away_red_cards: event.away_red_cards,
      home_activity: round12(event.home_activity),
      away_activity: round12(event.away_activity),
    },
    market,
    limitations,
  };
  return {
    ...withoutHash,
    feature_hash: computeStorageContentHash(withoutHash),
  };
}

function oddsMarketAge(
  asOf: string,
  odds: InternalOddsIntelligenceContext | null | undefined,
): number | null {
  const timestamp = odds?.primary_match_result_market?.latest_timestamp ?? null;
  return timestamp === null ? null : ageSeconds(asOf, iso(timestamp, "market timestamp"));
}
