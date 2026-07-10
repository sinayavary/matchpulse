import {
  buildInternalOddsIntelligenceContext,
  type InternalOddsIntelligenceContext,
  type NormalizedOddsMarketType,
  type OddsComponentScores,
  type OddsMarketIntelligence,
  type OddsReliabilityLevel,
  type OddsValidationIssue,
} from "./odds-intelligence-contract.js";
import {
  aggregateProviderProbabilities,
  buildProviderMarketSnapshots,
  groupMarketSnapshotsByTimeWindow,
  type OddsProviderConsensus,
  type OddsProviderMarketSnapshot,
} from "./odds-mathematical-primitives.js";
import type { NormalizedStoredOddsObservation } from "./odds-market-normalization.js";
import {
  calculateTemporalMovement,
  calculateVolatilityMetrics,
  detectProbabilityJumps,
  type OddsProbabilityTimePoint,
} from "./odds-temporal-primitives.js";
import { computeStorageContentHash } from "./prediction-storage-hash.js";

export const ODDS_ASSESSMENT_POLICY_VERSION = "odds-assessment-policy-v1" as const;

export type OddsEventConsistencyEvidence = {
  market_key: string;
  score: number;
  critical: boolean;
};

export type OddsIntelligenceAssessmentInput = {
  fixture_id: string;
  generated_at: string;
  observations: readonly NormalizedStoredOddsObservation[];
  event_consistency?: readonly OddsEventConsistencyEvidence[];
};

type MarketDiagnostics = {
  market: OddsMarketIntelligence;
  anomaly_score: number;
};

const POLICY = Object.freeze({
  time_bucket_ms: 60_000,
  temporal_anchor_tolerance_ms: 90_000,
  max_velocity_gap_ms: 120_000,
  fresh_age_ms: 90_000,
  aging_age_ms: 300_000,
  soft_stale_age_ms: 900_000,
  hard_stale_age_ms: 1_800_000,
  provider_disagreement_dispersion: 0.025,
  hard_provider_dispersion: 0.08,
  abnormal_jump: 0.08,
  hard_abnormal_jump: 0.18,
  minimum_usable_reliability: 0.4,
  limited_reliability: 0.65,
  reliable_reliability: 0.85,
  component_weights: Object.freeze({
    structural_validity: 0.18,
    freshness: 0.16,
    market_completeness: 0.14,
    provider_quality: 0.1,
    provider_consensus: 0.1,
    dispersion_quality: 0.08,
    movement_integrity: 0.1,
    event_consistency: 0.08,
    historical_support: 0.06,
  }),
});

const MARKET_PRIORITY: Readonly<Record<NormalizedOddsMarketType, number>> = {
  match_result_1x2: 2,
  total_goals: 1,
  both_teams_to_score: 1,
  asian_handicap: 0.75,
  next_goal: 0.75,
  double_chance: 0,
  correct_score: 0,
  unknown: 0,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round12(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function canonicalIso(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a valid ISO timestamp.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${name} must be a valid ISO timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNullableText(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return compareText(left, right);
}

function providerIdentity(providerKey: string | null): string {
  return JSON.stringify(providerKey);
}

function observationTimestamp(observation: NormalizedStoredOddsObservation): string {
  return canonicalIso(
    observation.source_timestamp ?? observation.created_at,
    "observation timestamp",
  );
}

function observationIdentity(observation: NormalizedStoredOddsObservation): string {
  return JSON.stringify([
    observation.fixture_id,
    observation.market_key,
    observation.market_type,
    observation.line,
    observation.provider_key,
    observation.selection,
    observationTimestamp(observation),
    observation.external_seq,
    observation.decimal_odds,
    observation.previous_decimal_odds,
    observation.change_percent,
    observation.direction,
    canonicalIso(observation.created_at, "created_at"),
  ]);
}

function sortObservations(
  observations: readonly NormalizedStoredOddsObservation[],
): NormalizedStoredOddsObservation[] {
  return [...observations].sort((left, right) => (
    compareText(left.fixture_id, right.fixture_id) ||
    compareText(left.market_key, right.market_key) ||
    compareText(observationTimestamp(left), observationTimestamp(right)) ||
    compareNullableText(left.provider_key, right.provider_key) ||
    compareText(left.selection, right.selection) ||
    compareNullableText(left.external_seq, right.external_seq) ||
    left.decimal_odds - right.decimal_odds ||
    compareText(left.created_at, right.created_at)
  ));
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareText);
}

function validateEventEvidence(
  evidence: readonly OddsEventConsistencyEvidence[],
): Map<string, OddsEventConsistencyEvidence> {
  const map = new Map<string, OddsEventConsistencyEvidence>();
  for (const item of evidence) {
    if (
      item === null ||
      typeof item !== "object" ||
      typeof item.market_key !== "string" ||
      item.market_key.trim() === "" ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 1 ||
      typeof item.critical !== "boolean"
    ) {
      throw new TypeError("Event-consistency evidence is invalid.");
    }
    if (map.has(item.market_key)) {
      throw new TypeError("Event-consistency market keys must be unique.");
    }
    map.set(item.market_key, { ...item });
  }
  return map;
}

function invalidContext(input: {
  fixture_id: string;
  generated_at: string;
  issues: OddsValidationIssue[];
  limitations: string[];
  snapshot_count?: number;
  provider_count?: number;
}): InternalOddsIntelligenceContext {
  const generatedAt = canonicalIso(input.generated_at, "generated_at");
  const issues = uniqueSorted(input.issues);
  const limitations = uniqueSorted(input.limitations);
  const assessmentId = `odds-assessment-v1:${computeStorageContentHash({
    policy: ODDS_ASSESSMENT_POLICY_VERSION,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    status: "invalid",
    issues,
    limitations,
  })}`;
  return buildInternalOddsIntelligenceContext({
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: assessmentId,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    status: "invalid",
    usable_for_model: false,
    overall_reliability_score: 0,
    recommended_market_model_weight: 0,
    market_count: 0,
    usable_market_count: 0,
    provider_count: input.provider_count ?? 0,
    snapshot_count: input.snapshot_count ?? 0,
    consensus_score: 0,
    freshness_score: 0,
    volatility_score: 0,
    anomaly_score: 0,
    primary_match_result_market: null,
    markets: [],
    issues,
    limitations,
  });
}

function unavailableContext(input: {
  fixture_id: string;
  generated_at: string;
}): InternalOddsIntelligenceContext {
  const generatedAt = canonicalIso(input.generated_at, "generated_at");
  const limitations = ["No normalized odds observations are available for assessment."];
  const assessmentId = `odds-assessment-v1:${computeStorageContentHash({
    policy: ODDS_ASSESSMENT_POLICY_VERSION,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    status: "unavailable",
  })}`;
  return buildInternalOddsIntelligenceContext({
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: assessmentId,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    status: "unavailable",
    usable_for_model: false,
    overall_reliability_score: 0,
    recommended_market_model_weight: 0,
    market_count: 0,
    usable_market_count: 0,
    provider_count: 0,
    snapshot_count: 0,
    consensus_score: 0,
    freshness_score: 0,
    volatility_score: 0,
    anomaly_score: 0,
    primary_match_result_market: null,
    markets: [],
    issues: [],
    limitations,
  });
}

function freshnessScore(ageMs: number): number {
  if (ageMs <= POLICY.fresh_age_ms) return 1;
  if (ageMs <= POLICY.aging_age_ms) return 0.85;
  if (ageMs <= POLICY.soft_stale_age_ms) return 0.6;
  if (ageMs <= POLICY.hard_stale_age_ms) return 0.35;
  return 0;
}

function providerCoverageScore(providerCount: number): number {
  if (providerCount <= 0) return 0;
  if (providerCount === 1) return 0.45;
  if (providerCount === 2) return 0.7;
  if (providerCount === 3) return 0.85;
  return 1;
}

function historicalSupportScore(pointCount: number): number {
  if (pointCount <= 0) return 0;
  if (pointCount === 1) return 0.15;
  if (pointCount === 2) return 0.3;
  if (pointCount <= 4) return 0.45;
  if (pointCount <= 9) return 0.65;
  if (pointCount <= 19) return 0.85;
  return 1;
}

function dispersionQualityScore(dispersion: number | null): number {
  if (dispersion === null) return 0;
  return clamp01(1 - dispersion / POLICY.hard_provider_dispersion);
}

function providerConsensusScore(
  providerCount: number,
  dispersion: number | null,
): number {
  if (providerCount <= 0) return 0;
  const coverage = providerCoverageScore(providerCount);
  const dispersionQuality = dispersionQualityScore(dispersion);
  return clamp01(0.45 * coverage + 0.55 * dispersionQuality);
}

function componentOverall(
  components: Omit<OddsComponentScores, "overall_reliability">,
): number {
  return round12(
    components.structural_validity * POLICY.component_weights.structural_validity +
    components.freshness * POLICY.component_weights.freshness +
    components.market_completeness * POLICY.component_weights.market_completeness +
    components.provider_quality * POLICY.component_weights.provider_quality +
    components.provider_consensus * POLICY.component_weights.provider_consensus +
    components.dispersion_quality * POLICY.component_weights.dispersion_quality +
    components.movement_integrity * POLICY.component_weights.movement_integrity +
    components.event_consistency * POLICY.component_weights.event_consistency +
    components.historical_support * POLICY.component_weights.historical_support
  );
}

function latestSnapshotPerProvider(
  snapshots: readonly OddsProviderMarketSnapshot[],
): OddsProviderMarketSnapshot[] {
  const latest = new Map<string, OddsProviderMarketSnapshot>();
  for (const snapshot of snapshots) {
    const key = providerIdentity(snapshot.provider_key);
    const current = latest.get(key);
    if (
      current === undefined ||
      snapshot.observed_at > current.observed_at ||
      (
        snapshot.observed_at === current.observed_at &&
        snapshot.snapshot_key > current.snapshot_key
      )
    ) {
      latest.set(key, snapshot);
    }
  }
  return [...latest.values()].sort((left, right) => (
    compareNullableText(left.provider_key, right.provider_key) ||
    compareText(left.observed_at, right.observed_at) ||
    compareText(left.snapshot_key, right.snapshot_key)
  ));
}

function canonicalCurrentSnapshot(
  snapshots: readonly OddsProviderMarketSnapshot[],
): OddsProviderMarketSnapshot | null {
  const complete = snapshots
    .filter((snapshot) => (
      snapshot.structural_status === "complete" && snapshot.mathematics !== null
    ))
    .sort((left, right) => (
      compareText(right.observed_at, left.observed_at) ||
      compareNullableText(left.provider_key, right.provider_key) ||
      compareText(left.snapshot_key, right.snapshot_key)
    ));
  return complete[0] ?? null;
}

function buildConsensusHistory(
  snapshots: readonly OddsProviderMarketSnapshot[],
): OddsProviderConsensus[] {
  const buckets = groupMarketSnapshotsByTimeWindow(
    snapshots,
    POLICY.time_bucket_ms,
  );
  const history: OddsProviderConsensus[] = [];
  for (const bucket of buckets) {
    const consensus = aggregateProviderProbabilities(bucket.snapshots);
    if (consensus !== null) history.push(consensus);
  }
  return history.sort((left, right) => (
    compareText(left.observed_through, right.observed_through) ||
    compareText(left.market_key, right.market_key)
  ));
}

function marketReliabilityLevel(input: {
  score: number;
  hardGate: boolean;
  invalid: boolean;
  providerCount: number;
  historyPointCount: number;
  issues: readonly OddsValidationIssue[];
}): OddsReliabilityLevel {
  if (input.invalid) return "invalid";
  if (input.hardGate || input.score < POLICY.minimum_usable_reliability) {
    return "unreliable";
  }
  if (
    input.score >= POLICY.reliable_reliability &&
    input.providerCount >= 3 &&
    input.historyPointCount >= 10 &&
    input.issues.length === 0
  ) {
    return "high_confidence";
  }
  if (
    input.score >= POLICY.limited_reliability &&
    input.providerCount >= 2 &&
    input.historyPointCount >= 3
  ) {
    return "reliable";
  }
  return "limited";
}

function modelWeight(
  level: OddsReliabilityLevel,
  score: number,
): number {
  switch (level) {
    case "limited":
      return round12(Math.min(0.12, score * 0.15));
    case "reliable":
      return round12(Math.min(0.22, score * 0.25));
    case "high_confidence":
      return round12(Math.min(0.32, score * 0.35));
    default:
      return 0;
  }
}

function marketTypeAndLineConsistent(
  observations: readonly NormalizedStoredOddsObservation[],
): boolean {
  if (observations.length === 0) return false;
  const marketType = observations[0]!.market_type;
  const line = observations[0]!.line;
  return observations.every((observation) => (
    observation.market_type === marketType && observation.line === line
  ));
}

function buildMarketDiagnostics(input: {
  fixture_id: string;
  generated_at: string;
  observations: readonly NormalizedStoredOddsObservation[];
  duplicate_market_keys: ReadonlySet<string>;
  event_evidence: OddsEventConsistencyEvidence | undefined;
}): MarketDiagnostics {
  const first = input.observations[0]!;
  const issues: OddsValidationIssue[] = [];
  const limitations: string[] = [];
  const consistentIdentity = marketTypeAndLineConsistent(input.observations);

  if (!consistentIdentity) {
    issues.push("market_incomplete");
    limitations.push("The canonical market key contains conflicting market identities or lines.");
  }
  if (["double_chance", "correct_score", "unknown"].includes(first.market_type)) {
    issues.push("unknown_market");
    limitations.push("This market type is not supported for probability assessment.");
  }
  if (input.observations.some((observation) => observation.selection === "unknown")) {
    issues.push("unknown_selection");
    limitations.push("At least one normalized selection remains unknown.");
  }
  if (input.duplicate_market_keys.has(first.market_key)) {
    issues.push("duplicate_snapshot");
    limitations.push("Exact duplicate normalized observations were removed before assessment.");
  }

  const snapshots = consistentIdentity
    ? buildProviderMarketSnapshots(input.observations)
    : [];
  const latestByProvider = latestSnapshotPerProvider(snapshots);
  const eligibleCurrent = latestByProvider.filter((snapshot) => (
    snapshot.structural_status === "complete" && snapshot.mathematics !== null
  ));
  const currentConsensus = aggregateProviderProbabilities(eligibleCurrent);
  const currentCanonical = canonicalCurrentSnapshot(eligibleCurrent);
  const latestTimestamp = snapshots.length === 0
    ? null
    : [...snapshots]
        .map((snapshot) => snapshot.observed_at)
        .sort(compareText)
        .at(-1)!;
  const effectiveLatestTimestamp = currentConsensus?.observed_through ?? latestTimestamp;
  const providerCount = latestByProvider.length;
  const completeProviderCount = eligibleCurrent.length;
  const currentCompleteness = providerCount === 0
    ? 0
    : completeProviderCount / providerCount;
  const historicalCompleteness = snapshots.length === 0
    ? 0
    : snapshots.filter((snapshot) => snapshot.structural_status === "complete").length /
      snapshots.length;

  if (currentCompleteness < 1) {
    issues.push("market_incomplete");
    limitations.push("One or more latest provider snapshots are incomplete or ambiguous.");
  }
  if (latestByProvider.some((snapshot) => snapshot.missing_selections.length > 0)) {
    issues.push("selection_missing");
    limitations.push("A latest provider snapshot is missing a required market selection.");
  }
  if (providerCount === 1) {
    issues.push("single_provider");
    limitations.push("Only one distinct provider is available for the current market state.");
  }
  if (currentConsensus?.excluded_provider_keys.length) {
    issues.push("provider_outlier");
    limitations.push("At least one provider was excluded by robust probability aggregation.");
  }
  if (
    currentConsensus !== null &&
    currentConsensus.provider_dispersion >= POLICY.provider_disagreement_dispersion
  ) {
    issues.push("provider_disagreement");
    limitations.push("Current provider probabilities show material disagreement.");
  }

  const generatedAtMs = Date.parse(input.generated_at);
  const latestTimestampMs = effectiveLatestTimestamp === null ? null : Date.parse(effectiveLatestTimestamp);
  const ageMs = latestTimestampMs === null ? Number.POSITIVE_INFINITY : generatedAtMs - latestTimestampMs;
  const freshness = latestTimestampMs === null ? 0 : freshnessScore(ageMs);
  if (freshness === 0 && effectiveLatestTimestamp !== null) {
    issues.push("stale_snapshot");
    limitations.push("The latest market snapshot exceeds the hard freshness limit.");
  }

  const history = snapshots.length === 0 ? [] : buildConsensusHistory(snapshots);
  const historyPointCount = history.length;
  if (historyPointCount < 3) {
    issues.push("insufficient_history");
    limitations.push("Fewer than three consensus time buckets are available.");
  }

  const temporalBySelection = new Map<string, {
    movement: ReturnType<typeof calculateTemporalMovement>;
    points: OddsProbabilityTimePoint[];
  }>();
  let volatilityTotal = 0;
  let volatilityCount = 0;
  let maxJump = 0;

  for (const selection of currentConsensus?.selections ?? []) {
    const points = history.flatMap((consensus) => {
      const candidate = consensus.selections.find((entry) => (
        entry.selection === selection.selection && entry.line === selection.line
      ));
      return candidate === undefined
        ? []
        : [{
            observed_at: consensus.observed_through,
            probability: candidate.consensus_probability,
          }];
    });
    const movement = calculateTemporalMovement(points, {
      as_of: input.generated_at,
      anchor_tolerance_ms: POLICY.temporal_anchor_tolerance_ms,
      max_velocity_gap_ms: POLICY.max_velocity_gap_ms,
    });
    temporalBySelection.set(selection.selection, { movement, points });
    if (points.length > 0) {
      const volatility = calculateVolatilityMetrics(points);
      const selectionVolatility = clamp01(
        0.4 * (volatility.population_standard_deviation / 0.04) +
        0.35 * (volatility.root_mean_square_change / 0.03) +
        0.25 * (volatility.max_absolute_change / 0.08)
      );
      volatilityTotal += selectionVolatility;
      volatilityCount += 1;
      for (const jump of detectProbabilityJumps(points, POLICY.abnormal_jump)) {
        maxJump = Math.max(maxJump, jump.absolute_change);
      }
    }
  }

  const volatilityScore = round12(
    volatilityCount === 0 ? 0 : volatilityTotal / volatilityCount,
  );
  if (maxJump >= POLICY.abnormal_jump) {
    issues.push("abnormal_jump");
    limitations.push("A recent consensus probability jump exceeded the anomaly threshold.");
  }

  const outlierRatio = currentConsensus === null || currentConsensus.provider_count === 0
    ? 0
    : currentConsensus.excluded_provider_keys.length / currentConsensus.provider_count;
  const anomalyScore = round12(clamp01(Math.max(
    maxJump / POLICY.hard_abnormal_jump,
    outlierRatio,
    currentConsensus === null
      ? 0
      : currentConsensus.provider_dispersion / POLICY.hard_provider_dispersion,
  )));

  const eventScore = input.event_evidence?.score ?? 0.5;
  if (input.event_evidence === undefined) {
    limitations.push("No event-consistency evidence was supplied for this market.");
  } else if (input.event_evidence.score < 0.4 || input.event_evidence.critical) {
    issues.push("event_inconsistency");
    limitations.push("Market movement is inconsistent with supplied event evidence.");
  }

  const structuralValidity = consistentIdentity && snapshots.length > 0
    ? clamp01(0.6 * currentCompleteness + 0.4 * historicalCompleteness)
    : 0;
  const marketCompleteness = currentConsensus !== null && currentCanonical !== null
    ? currentCompleteness
    : 0;
  const providerQuality = clamp01(
    providerCoverageScore(providerCount) * currentCompleteness,
  );
  const consensusScore = providerConsensusScore(
    currentConsensus?.provider_count ?? 0,
    currentConsensus?.provider_dispersion ?? null,
  );
  const dispersionQuality = dispersionQualityScore(
    currentConsensus?.provider_dispersion ?? null,
  );
  const movementIntegrity = clamp01(
    1 - 0.65 * volatilityScore - 0.35 * anomalyScore,
  );
  const historicalSupport = historicalSupportScore(historyPointCount);

  const baseComponents = {
    structural_validity: round12(structuralValidity),
    freshness: round12(freshness),
    market_completeness: round12(marketCompleteness),
    provider_quality: round12(providerQuality),
    provider_consensus: round12(consensusScore),
    dispersion_quality: round12(dispersionQuality),
    movement_integrity: round12(movementIntegrity),
    event_consistency: round12(eventScore),
    historical_support: round12(historicalSupport),
  };
  const overall = componentOverall(baseComponents);
  const components: OddsComponentScores = {
    ...baseComponents,
    overall_reliability: overall,
  };

  const hardGate =
    !consistentIdentity ||
    currentConsensus === null ||
    currentCanonical === null ||
    freshness === 0 ||
    (currentConsensus?.provider_dispersion ?? 0) >= POLICY.hard_provider_dispersion ||
    maxJump >= POLICY.hard_abnormal_jump ||
    input.event_evidence?.critical === true;
  const invalid =
    !consistentIdentity ||
    ["double_chance", "correct_score", "unknown"].includes(first.market_type);
  const issueList = uniqueSorted(issues);
  const reliabilityLevel = marketReliabilityLevel({
    score: overall,
    hardGate,
    invalid,
    providerCount,
    historyPointCount,
    issues: issueList,
  });
  const usable =
    !hardGate &&
    !invalid &&
    overall >= POLICY.minimum_usable_reliability &&
    ["limited", "reliable", "high_confidence"].includes(reliabilityLevel);
  const recommendedWeight = usable ? modelWeight(reliabilityLevel, overall) : 0;

  const canonicalFairBySelection = new Map(
    currentCanonical?.mathematics?.selections.map((selection) => [
      selection.selection,
      selection.fair_probability,
    ]) ?? [],
  );
  const selections = (currentConsensus?.selections ?? []).map((selection) => {
    const temporal = temporalBySelection.get(selection.selection)?.movement ?? null;
    return {
      selection: selection.selection,
      line: selection.line,
      fair_probability:
        canonicalFairBySelection.get(selection.selection) ??
        selection.consensus_probability,
      consensus_probability: selection.consensus_probability,
      probability_change_1m: temporal?.probability_change_1m ?? null,
      probability_change_5m: temporal?.probability_change_5m ?? null,
      movement_velocity: temporal?.movement_velocity_per_minute ?? null,
      movement_acceleration:
        temporal?.movement_acceleration_per_minute_squared ?? null,
    };
  });

  const market: OddsMarketIntelligence = {
    market_key: first.market_key,
    market_type: first.market_type,
    line: consistentIdentity ? first.line : null,
    complete: currentConsensus !== null && currentCanonical !== null,
    usable,
    selection_count: selections.length,
    provider_count: providerCount,
    snapshot_count: snapshots.length,
    overround: currentCanonical?.mathematics?.overround ?? null,
    provider_dispersion: currentConsensus?.provider_dispersion ?? null,
    volatility_score: volatilityScore,
    selections,
    component_scores: components,
    reliability_level: reliabilityLevel,
    reliability_score: overall,
    recommended_model_weight: recommendedWeight,
    issues: issueList,
    limitations: uniqueSorted(limitations),
    latest_timestamp: effectiveLatestTimestamp,
  };

  return { market, anomaly_score: anomalyScore };
}

function weightedAverage(
  values: readonly { value: number; weight: number }[],
): number {
  const usable = values.filter((entry) => entry.weight > 0);
  if (usable.length === 0) return 0;
  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  return round12(
    usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0) /
      totalWeight,
  );
}

function rootReliabilityLevel(input: {
  score: number;
  usableMarkets: readonly OddsMarketIntelligence[];
  primary: OddsMarketIntelligence | null;
  allInvalid: boolean;
}): OddsReliabilityLevel {
  if (input.usableMarkets.length === 0) {
    return input.allInvalid ? "invalid" : "unreliable";
  }
  if (
    input.score >= POLICY.reliable_reliability &&
    input.primary?.reliability_level === "high_confidence"
  ) {
    return "high_confidence";
  }
  if (
    input.score >= POLICY.limited_reliability &&
    input.primary !== null &&
    ["reliable", "high_confidence"].includes(input.primary.reliability_level)
  ) {
    return "reliable";
  }
  return "limited";
}

export function assessOddsIntelligence(
  input: OddsIntelligenceAssessmentInput,
): InternalOddsIntelligenceContext {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Odds intelligence input is required.");
  }
  if (typeof input.fixture_id !== "string" || input.fixture_id.trim() === "") {
    throw new TypeError("fixture_id must be non-empty.");
  }
  if (!Array.isArray(input.observations)) {
    throw new TypeError("observations must be an array.");
  }

  const generatedAt = canonicalIso(input.generated_at, "generated_at");
  const eventEvidence = validateEventEvidence(input.event_consistency ?? []);
  if (input.observations.length === 0) {
    return unavailableContext({ fixture_id: input.fixture_id, generated_at: generatedAt });
  }

  const fatalIssues: OddsValidationIssue[] = [];
  const fatalLimitations: string[] = [];
  for (const observation of input.observations) {
    if (observation.fixture_id !== input.fixture_id) {
      fatalIssues.push("fixture_mismatch");
    }
    if (
      typeof observation.decimal_odds !== "number" ||
      !Number.isFinite(observation.decimal_odds) ||
      observation.decimal_odds <= 1
    ) {
      fatalIssues.push("invalid_odds_value");
    }
    try {
      const observedAt = observationTimestamp(observation);
      canonicalIso(observation.created_at, "created_at");
      if (Date.parse(observedAt) > Date.parse(generatedAt)) {
        fatalIssues.push("invalid_timestamp");
      }
    } catch {
      fatalIssues.push("invalid_timestamp");
    }
  }
  if (fatalIssues.includes("fixture_mismatch")) {
    fatalLimitations.push("At least one normalized observation belongs to a different fixture.");
  }
  if (fatalIssues.includes("invalid_odds_value")) {
    fatalLimitations.push("At least one decimal-odds value is invalid.");
  }
  if (fatalIssues.includes("invalid_timestamp")) {
    fatalLimitations.push("At least one odds timestamp is invalid or later than generated_at.");
  }
  if (fatalIssues.length > 0) {
    return invalidContext({
      fixture_id: input.fixture_id,
      generated_at: generatedAt,
      issues: fatalIssues,
      limitations: fatalLimitations,
    });
  }

  const sorted = sortObservations(input.observations);
  const deduplicated: NormalizedStoredOddsObservation[] = [];
  const duplicateMarketKeys = new Set<string>();
  let previousIdentity: string | null = null;
  for (const observation of sorted) {
    const identity = observationIdentity(observation);
    if (identity === previousIdentity) {
      duplicateMarketKeys.add(observation.market_key);
      continue;
    }
    deduplicated.push(observation);
    previousIdentity = identity;
  }

  const groups = new Map<string, NormalizedStoredOddsObservation[]>();
  for (const observation of deduplicated) {
    const group = groups.get(observation.market_key);
    if (group === undefined) groups.set(observation.market_key, [observation]);
    else group.push(observation);
  }

  const diagnostics = [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([marketKey, observations]) => buildMarketDiagnostics({
      fixture_id: input.fixture_id,
      generated_at: generatedAt,
      observations,
      duplicate_market_keys: duplicateMarketKeys,
      event_evidence: eventEvidence.get(marketKey),
    }));
  const markets = diagnostics
    .map((entry) => entry.market)
    .sort((left, right) => compareText(left.market_key, right.market_key));
  const usableMarkets = markets.filter((market) => market.usable);
  const primary = usableMarkets
    .filter((market) => market.market_type === "match_result_1x2")
    .sort((left, right) => (
      right.reliability_score - left.reliability_score ||
      compareText(right.latest_timestamp ?? "", left.latest_timestamp ?? "") ||
      compareText(left.market_key, right.market_key)
    ))[0] ?? null;

  const overallReliability = weightedAverage(usableMarkets.map((market) => ({
    value: market.reliability_score,
    weight: MARKET_PRIORITY[market.market_type],
  })));
  const consensusScore = weightedAverage(markets.map((market) => ({
    value: market.component_scores.provider_consensus,
    weight: Math.max(1, market.provider_count),
  })));
  const freshness = weightedAverage(markets.map((market) => ({
    value: market.component_scores.freshness,
    weight: Math.max(1, market.snapshot_count),
  })));
  const volatility = weightedAverage(markets.map((market) => ({
    value: market.volatility_score,
    weight: Math.max(1, market.snapshot_count),
  })));
  const anomaly = round12(
    diagnostics.length === 0
      ? 0
      : Math.max(...diagnostics.map((entry) => entry.anomaly_score)),
  );
  const allInvalid = markets.length > 0 && markets.every((market) => (
    market.reliability_level === "invalid"
  ));
  const status = rootReliabilityLevel({
    score: overallReliability,
    usableMarkets,
    primary,
    allInvalid,
  });
  const usableForModel = usableMarkets.length > 0;
  const averageWeight = weightedAverage(usableMarkets.map((market) => ({
    value: market.recommended_model_weight,
    weight: MARKET_PRIORITY[market.market_type],
  })));
  const recommendedWeight = usableForModel
    ? round12(primary === null ? Math.min(0.15, averageWeight) : averageWeight)
    : 0;
  const issues = uniqueSorted(markets.flatMap((market) => market.issues));
  const limitations = uniqueSorted(markets.flatMap((market) => market.limitations));
  const providers = new Set(deduplicated.map((observation) => (
    providerIdentity(observation.provider_key)
  )));
  const snapshotCount = markets.reduce((sum, market) => sum + market.snapshot_count, 0);

  const identityObservations = deduplicated.map((observation) => ({
    fixture_id: observation.fixture_id,
    external_seq: observation.external_seq,
    provider_key: observation.provider_key,
    market_key: observation.market_key,
    market_type: observation.market_type,
    selection: observation.selection,
    line: observation.line,
    decimal_odds: observation.decimal_odds,
    previous_decimal_odds: observation.previous_decimal_odds,
    change_percent: observation.change_percent,
    direction: observation.direction,
    observed_at: observationTimestamp(observation),
    created_at: canonicalIso(observation.created_at, "created_at"),
  }));
  const identityEvidence = [...eventEvidence.values()]
    .sort((left, right) => compareText(left.market_key, right.market_key));
  const assessmentId = `odds-assessment-v1:${computeStorageContentHash({
    policy: ODDS_ASSESSMENT_POLICY_VERSION,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    observations: identityObservations,
    duplicate_market_keys: [...duplicateMarketKeys].sort(compareText),
    event_consistency: identityEvidence,
  })}`;

  return buildInternalOddsIntelligenceContext({
    odds_intelligence_version: "odds-intelligence-v1",
    assessment_id: assessmentId,
    fixture_id: input.fixture_id,
    generated_at: generatedAt,
    status,
    usable_for_model: usableForModel,
    overall_reliability_score: overallReliability,
    recommended_market_model_weight: recommendedWeight,
    market_count: markets.length,
    usable_market_count: usableMarkets.length,
    provider_count: providers.size,
    snapshot_count: snapshotCount,
    consensus_score: consensusScore,
    freshness_score: freshness,
    volatility_score: volatility,
    anomaly_score: anomaly,
    primary_match_result_market: primary,
    markets,
    issues,
    limitations,
  });
}
