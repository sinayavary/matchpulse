import {
  buildCompetitionPredictionSnapshot,
  type CompetitionPredictionInput,
} from "./competition-model-profile.js";
import {
  mapCompetitionPredictionRuntimeResultToPublic,
  type PublicCompetitionPredictionResponse,
} from "./competition-prediction-public-mapper.js";
import {
  buildPublicMarketIntelligence,
  PUBLIC_MARKET_SAFETY_NOTE,
  type PublicMarketIntelligence,
} from "./odds-intelligence-contract.js";
import type { CompetitionPredictionRuntimeResult } from "./competition-prediction-service.js";

export const COMPETITION_REPLAY_FIXTURE_ID = "competition-replay-demo" as const;

export type CompetitionReplayCheckpointId =
  | "opening-balance"
  | "pressure-shift"
  | "terminal-home";

export type CompetitionReplayCheckpointSummary = {
  checkpoint_id: CompetitionReplayCheckpointId;
  label: string;
  description: string;
  minute: number;
  phase: "H1" | "H2" | "FT";
  home_score: number;
  away_score: number;
  market_reliability: PublicMarketIntelligence["reliability"];
  market_freshness: PublicMarketIntelligence["freshness"];
  market_agreement: PublicMarketIntelligence["provider_agreement"];
  market_volatility: PublicMarketIntelligence["volatility"];
};

export type CompetitionReplayCheckpoint = CompetitionReplayCheckpointSummary & {
  response: PublicCompetitionPredictionResponse;
};

type ReplayDefinition = {
  summary: CompetitionReplayCheckpointSummary;
  generated_at: string;
  normalized_phase: CompetitionPredictionInput["normalized_phase"];
  freshness_score: number;
  market: CompetitionPredictionInput["market"];
  events: CompetitionPredictionInput["events"];
  market_analysis: PublicMarketIntelligence;
};

function predictionInput(definition: ReplayDefinition): CompetitionPredictionInput {
  const { summary } = definition;
  return {
    fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
    as_of: definition.generated_at,
    generated_at: definition.generated_at,
    sequence: null,
    trigger: "replay",
    feature_reference: {
      feature_version: "competition-runtime-input-v1",
      feature_hash: `competition-replay-v2:${summary.checkpoint_id}`,
      feature_count: 10,
    },
    phase: summary.phase,
    normalized_phase: definition.normalized_phase,
    minute: summary.minute,
    home_score: summary.home_score,
    away_score: summary.away_score,
    freshness_score: definition.freshness_score,
    market: definition.market,
    events: definition.events,
  };
}

function replayResponse(definition: ReplayDefinition): PublicCompetitionPredictionResponse {
  const runtime: CompetitionPredictionRuntimeResult = {
    fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
    status: "replay",
    source: "replay",
    mode: "replay",
    snapshot: buildCompetitionPredictionSnapshot(predictionInput(definition)),
    market_analysis: definition.market_analysis,
    limitations: [
      "This checkpoint uses deterministic synthetic competition data.",
      "The competition baseline is informational and not production calibrated.",
    ],
  };
  return mapCompetitionPredictionRuntimeResultToPublic(runtime);
}

const DEFINITIONS: readonly ReplayDefinition[] = [
  {
    summary: {
      checkpoint_id: "opening-balance",
      label: "Opening balance",
      description: "An even first-half state with fresh, broadly aligned market evidence.",
      minute: 18,
      phase: "H1",
      home_score: 0,
      away_score: 0,
      market_reliability: "strong",
      market_freshness: "fresh",
      market_agreement: "strong",
      market_volatility: "low",
    },
    generated_at: "2026-07-13T12:00:00.000Z",
    normalized_phase: "first_half",
    freshness_score: 0.97,
    market: {
      available: true,
      usable_for_model: true,
      assessment_id: "replay-private-opening",
      reliability_score: 0.92,
      approved_model_weight_cap: 0.12,
      final_outcome: { home: 0.4, draw: 0.34, away: 0.26 },
      next_goal: { home: 0.39, none: 0.28, away: 0.33 },
      direction: "home",
      limitations: [],
    },
    events: {
      available: true,
      home_pressure: 0.56,
      away_pressure: 0.44,
      home_impact: 0.52,
      away_impact: 0.48,
      limitations: [],
    },
    market_analysis: buildPublicMarketIntelligence({
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
      generated_at: "2026-07-13T12:00:00.000Z",
      availability: "available",
      reliability: "strong",
      freshness: "fresh",
      provider_coverage: "broad",
      provider_agreement: "strong",
      volatility: "low",
      market_count: 8,
      usable_market_count: 8,
      provider_count: 4,
      notable_movements: [{
        market_label: "Match result",
        selection_label: "Home",
        direction: "up",
        strength: "low",
        summary: "Home market support increased slightly during the opening period.",
      }],
      summary: "Market data is fresh, broadly covered, and closely aligned.",
      limitations: [],
      last_update: "2026-07-13T11:59:50.000Z",
      safety_note: PUBLIC_MARKET_SAFETY_NOTE,
    }),
  },
  {
    summary: {
      checkpoint_id: "pressure-shift",
      label: "Pressure shift",
      description: "A level second-half state with aging data, mixed agreement, and higher volatility.",
      minute: 67,
      phase: "H2",
      home_score: 1,
      away_score: 1,
      market_reliability: "limited",
      market_freshness: "aging",
      market_agreement: "mixed",
      market_volatility: "high",
    },
    generated_at: "2026-07-13T12:49:00.000Z",
    normalized_phase: "second_half",
    freshness_score: 0.58,
    market: {
      available: true,
      usable_for_model: true,
      assessment_id: "replay-private-shift",
      reliability_score: 0.61,
      approved_model_weight_cap: 0.08,
      final_outcome: { home: 0.3, draw: 0.34, away: 0.36 },
      next_goal: { home: 0.29, none: 0.24, away: 0.47 },
      direction: "away",
      limitations: ["Market agreement is mixed and volatility is elevated."],
    },
    events: {
      available: true,
      home_pressure: 0.35,
      away_pressure: 0.71,
      home_impact: 0.31,
      away_impact: 0.69,
      limitations: [],
    },
    market_analysis: buildPublicMarketIntelligence({
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
      generated_at: "2026-07-13T12:49:00.000Z",
      availability: "limited",
      reliability: "limited",
      freshness: "aging",
      provider_coverage: "limited",
      provider_agreement: "mixed",
      volatility: "high",
      market_count: 7,
      usable_market_count: 5,
      provider_count: 3,
      notable_movements: [
        {
          market_label: "Next goal",
          selection_label: "Away",
          direction: "up",
          strength: "high",
          summary: "Away next-goal support increased while recent away pressure strengthened.",
        },
        {
          market_label: "Match result",
          selection_label: "Draw",
          direction: "down",
          strength: "medium",
          summary: "Draw support weakened during the latest replay window.",
        },
      ],
      summary: "Market evidence remains usable but is aging, mixed, and volatile.",
      limitations: [
        "Two observed markets did not pass the replay reliability gate.",
        "Recent provider agreement is mixed.",
      ],
      last_update: "2026-07-13T12:46:00.000Z",
      safety_note: PUBLIC_MARKET_SAFETY_NOTE,
    }),
  },
  {
    summary: {
      checkpoint_id: "terminal-home",
      label: "Terminal home result",
      description: "A finished 2-1 state demonstrating terminal prediction behavior and stale market context.",
      minute: 95,
      phase: "FT",
      home_score: 2,
      away_score: 1,
      market_reliability: "limited",
      market_freshness: "stale",
      market_agreement: "mixed",
      market_volatility: "medium",
    },
    generated_at: "2026-07-13T13:17:00.000Z",
    normalized_phase: "finished",
    freshness_score: 0.22,
    market: {
      available: true,
      usable_for_model: false,
      assessment_id: "replay-private-terminal",
      reliability_score: 0.45,
      approved_model_weight_cap: 0,
      final_outcome: { home: 1, draw: 0, away: 0 },
      next_goal: { home: 0, none: 1, away: 0 },
      direction: "home",
      limitations: ["The latest market observation is stale and is not used by the model."],
    },
    events: {
      available: true,
      home_pressure: 0.5,
      away_pressure: 0.5,
      home_impact: 0.5,
      away_impact: 0.5,
      limitations: ["The match is complete."],
    },
    market_analysis: buildPublicMarketIntelligence({
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: COMPETITION_REPLAY_FIXTURE_ID,
      generated_at: "2026-07-13T13:17:00.000Z",
      availability: "limited",
      reliability: "limited",
      freshness: "stale",
      provider_coverage: "limited",
      provider_agreement: "mixed",
      volatility: "medium",
      market_count: 5,
      usable_market_count: 0,
      provider_count: 3,
      notable_movements: [{
        market_label: "Match result",
        selection_label: "Home",
        direction: "stable",
        strength: "low",
        summary: "The last recorded home support remained stable before the terminal checkpoint.",
      }],
      summary: "The replay is complete and the latest market evidence is stale.",
      limitations: ["Stale market evidence is displayed for context but is not used by the model."],
      last_update: "2026-07-13T13:08:00.000Z",
      safety_note: PUBLIC_MARKET_SAFETY_NOTE,
    }),
  },
] as const;

const CHECKPOINTS: readonly CompetitionReplayCheckpoint[] = DEFINITIONS.map((definition) => ({
  ...definition.summary,
  response: replayResponse(definition),
}));

export function listCompetitionReplayCheckpoints(): CompetitionReplayCheckpointSummary[] {
  return CHECKPOINTS.map(({ response: _response, ...summary }) => structuredClone(summary));
}

export function getCompetitionReplayCheckpoint(
  checkpointId: string,
): CompetitionReplayCheckpoint | null {
  const checkpoint = CHECKPOINTS.find((candidate) => candidate.checkpoint_id === checkpointId);
  return checkpoint === undefined ? null : structuredClone(checkpoint);
}
