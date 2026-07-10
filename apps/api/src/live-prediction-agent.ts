export type LivePredictionAgentVersion = "live-predictor-v1";

export type LivePredictionOutcomeProbabilities = {
  home_result: number;
  draw_result: number;
  away_result: number;
};

export type LivePredictionScenarioProbabilities = {
  home_pressure_increase: number;
  away_pressure_increase: number;
  late_goal_window: number;
  market_volatility: number;
  momentum_shift: number;
};

export type LivePredictionConfidence = {
  level: "low" | "medium" | "high";
  score: number;
  reasons: string[];
};

export type LivePredictionRisk = {
  level: "low" | "medium" | "high";
  reasons: string[];
};

export type LivePredictionInputSummary = {
  fixture_id: string;
  phase: string | null;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  score_diff: number | null;
  has_scoreboard: boolean;
  has_odds: boolean;
  odds_count: number;
  data_quality: "complete" | "partial" | "empty";
  freshness_label: "fresh" | "stale" | "unknown";
  market_reliability: "available" | "limited" | "unavailable";
  event_pressure: "none" | "low" | "medium" | "high";
};

export type LivePredictionExplanation = {
  summary: string;
  factors: string[];
  limitations: string[];
};

export type LivePredictionAgentOutput = {
  agent_version: LivePredictionAgentVersion;
  fixture_id: string;
  generated_at: string;
  input_summary: LivePredictionInputSummary;
  outcome_probabilities: LivePredictionOutcomeProbabilities;
  scenario_probabilities: LivePredictionScenarioProbabilities;
  confidence: LivePredictionConfidence;
  risk: LivePredictionRisk;
  explanation: LivePredictionExplanation;
  safety_note: string;
};

export type LivePredictionAgentResponse = {
  data: LivePredictionAgentOutput | null;
  meta: {
    status: "live" | "degraded" | "no_data" | "stale";
    source: "live-prediction-agent";
    mode: "internal";
    message?: string;
  };
};

export const LIVE_PREDICTION_SAFETY_NOTE =
  "MatchPulse live predictions are informational sports analytics only. They are not betting recommendations, wagering instructions, or financial advice.";

const BALANCED_OUTCOMES = 1 / 3;
const DEFAULT_SCENARIOS: LivePredictionScenarioProbabilities = {
  home_pressure_increase: 0.33,
  away_pressure_increase: 0.33,
  late_goal_window: 0.33,
  market_volatility: 0.33,
  momentum_shift: 0.33
};
const DEFAULT_CONFIDENCE: LivePredictionConfidence = {
  level: "low",
  score: 0.33,
  reasons: ["Prediction engine is using conservative baseline defaults."]
};
const DEFAULT_RISK: LivePredictionRisk = {
  level: "medium",
  reasons: ["Live prediction output depends on data coverage, freshness, and market reliability."]
};
const DEFAULT_EXPLANATION: LivePredictionExplanation = {
  summary: "Live prediction contract output is available with conservative defaults.",
  factors: [],
  limitations: ["Final probability engine is not implemented in this phase."]
};

function clamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

export function normalizeOutcomeProbabilities(
  probabilities: LivePredictionOutcomeProbabilities
): LivePredictionOutcomeProbabilities {
  const values = {
    home_result: clamp(probabilities?.home_result),
    draw_result: clamp(probabilities?.draw_result),
    away_result: clamp(probabilities?.away_result)
  };
  const total = values.home_result + values.draw_result + values.away_result;

  if (total === 0) {
    return {
      home_result: BALANCED_OUTCOMES,
      draw_result: BALANCED_OUTCOMES,
      away_result: BALANCED_OUTCOMES
    };
  }

  return {
    home_result: values.home_result / total,
    draw_result: values.draw_result / total,
    away_result: values.away_result / total
  };
}

const FORBIDDEN_STRUCTURED_KEYS = new Set([
  "recommended_bet", "bet", "wager", "stake", "payout", "profit", "expected_value", "ev", "edge",
  "wallet", "deposit", "token", "secret", "api_key", "stack", "raw_payload", "debug_lineage",
  "formula", "model_weights"
]);

export function assertLivePredictionAgentOutputSafe(payload: unknown): void {
  const visited = new Set<object>();

  function visit(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_STRUCTURED_KEYS.has(key.toLowerCase())) {
        throw new Error(`Forbidden live prediction field: ${key}`);
      }
      visit(child);
    }
  }

  visit(payload);
}

function safeLevel(value: unknown, fallback: LivePredictionConfidence["level"]): LivePredictionConfidence["level"] {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function safeReasons(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((reason) => typeof reason === "string")
    ? value
    : fallback;
}

export function buildLivePredictionAgentOutput(input: {
  fixture_id: string;
  generated_at: string;
  input_summary: LivePredictionInputSummary;
  outcome_probabilities?: Partial<LivePredictionOutcomeProbabilities>;
  scenario_probabilities?: Partial<LivePredictionScenarioProbabilities>;
  confidence?: Partial<LivePredictionConfidence>;
  risk?: Partial<LivePredictionRisk>;
  explanation?: Partial<LivePredictionExplanation>;
}): LivePredictionAgentOutput {
  const confidenceInput = input.confidence ?? {};
  const riskInput = input.risk ?? {};
  const explanationInput = input.explanation ?? {};
  const output: LivePredictionAgentOutput = {
    agent_version: "live-predictor-v1",
    fixture_id: input.fixture_id,
    generated_at: input.generated_at,
    input_summary: input.input_summary,
    outcome_probabilities: normalizeOutcomeProbabilities({
      home_result: input.outcome_probabilities?.home_result ?? 0,
      draw_result: input.outcome_probabilities?.draw_result ?? 0,
      away_result: input.outcome_probabilities?.away_result ?? 0
    }),
    scenario_probabilities: Object.fromEntries(
      Object.entries(DEFAULT_SCENARIOS).map(([key, value]) => [
        key,
        clamp(input.scenario_probabilities?.[key as keyof LivePredictionScenarioProbabilities] ?? value)
      ])
    ) as LivePredictionScenarioProbabilities,
    confidence: {
      level: safeLevel(confidenceInput.level, DEFAULT_CONFIDENCE.level),
      score: clamp(confidenceInput.score ?? DEFAULT_CONFIDENCE.score),
      reasons: safeReasons(confidenceInput.reasons, DEFAULT_CONFIDENCE.reasons)
    },
    risk: {
      level: safeLevel(riskInput.level, DEFAULT_RISK.level),
      reasons: safeReasons(riskInput.reasons, DEFAULT_RISK.reasons)
    },
    explanation: {
      summary: typeof explanationInput.summary === "string" ? explanationInput.summary : DEFAULT_EXPLANATION.summary,
      factors: safeReasons(explanationInput.factors, DEFAULT_EXPLANATION.factors),
      limitations: safeReasons(explanationInput.limitations, DEFAULT_EXPLANATION.limitations)
    },
    safety_note: LIVE_PREDICTION_SAFETY_NOTE
  };

  assertLivePredictionAgentOutputSafe(output);
  return output;
}
