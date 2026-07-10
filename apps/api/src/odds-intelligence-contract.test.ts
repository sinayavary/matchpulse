import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_MARKET_SAFETY_NOTE,
  assertInternalOddsIntelligenceValid,
  assertPublicMarketIntelligenceSafe,
  buildInternalOddsIntelligenceContext,
  buildPublicMarketIntelligence,
  type InternalOddsIntelligenceContext,
  type PublicMarketIntelligence,
} from "./odds-intelligence-contract.js";
const component = () => ({
  structural_validity: 1,
  freshness: 1,
  market_completeness: 1,
  provider_quality: 0.8,
  provider_consensus: 0.8,
  dispersion_quality: 0.9,
  movement_integrity: 0.8,
  event_consistency: 1,
  historical_support: 0.5,
  overall_reliability: 0.8,
});
const market = () => ({
  market_key: "1x2",
  market_type: "match_result_1x2" as const,
  line: null,
  complete: true,
  usable: true,
  selection_count: 3,
  provider_count: 2,
  snapshot_count: 4,
  overround: null,
  provider_dispersion: 0.1,
  volatility_score: 0.2,
  selections: [
    {
      selection: "home" as const,
      line: null,
      fair_probability: 0.4,
      consensus_probability: 0.4,
      probability_change_1m: null,
      probability_change_5m: null,
      movement_velocity: null,
      movement_acceleration: null,
    },
    {
      selection: "draw" as const,
      line: null,
      fair_probability: 0.3,
      consensus_probability: 0.3,
      probability_change_1m: null,
      probability_change_5m: null,
      movement_velocity: null,
      movement_acceleration: null,
    },
    {
      selection: "away" as const,
      line: null,
      fair_probability: 0.3,
      consensus_probability: 0.3,
      probability_change_1m: null,
      probability_change_5m: null,
      movement_velocity: null,
      movement_acceleration: null,
    },
  ],
  component_scores: component(),
  reliability_level: "reliable" as const,
  reliability_score: 0.8,
  recommended_model_weight: 0.3,
  issues: [],
  limitations: [],
  latest_timestamp: "2026-07-10T10:00:00Z",
});
const internal = (): InternalOddsIntelligenceContext => ({
  odds_intelligence_version: "odds-intelligence-v1",
  assessment_id: "a1",
  fixture_id: "f1",
  generated_at: "2026-07-10T10:00:00Z",
  status: "reliable",
  usable_for_model: true,
  overall_reliability_score: 0.8,
  recommended_market_model_weight: 0.3,
  market_count: 1,
  usable_market_count: 1,
  provider_count: 2,
  snapshot_count: 4,
  consensus_score: 0.8,
  freshness_score: 1,
  volatility_score: 0.2,
  anomaly_score: 0.1,
  primary_match_result_market: market(),
  markets: [market()],
  issues: [],
  limitations: [],
});
const pub = (): PublicMarketIntelligence => ({
  market_intelligence_version: "public-market-intelligence-v1",
  fixture_id: "f1",
  generated_at: "2026-07-10T10:00:00Z",
  availability: "available",
  reliability: "good",
  freshness: "fresh",
  provider_coverage: "broad",
  provider_agreement: "strong",
  volatility: "low",
  market_count: 1,
  usable_market_count: 1,
  provider_count: 2,
  notable_movements: [
    {
      market_label: "Match result",
      selection_label: "Home",
      direction: "stable",
      strength: "low",
      summary: "Stable movement.",
    },
  ],
  summary: "Market data is available.",
  limitations: [],
  last_update: "2026-07-10T10:00:00Z",
  safety_note: PUBLIC_MARKET_SAFETY_NOTE,
});
test("valid internal odds passes and builder clones", () => {
  const input = internal();
  const copy = buildInternalOddsIntelligenceContext(input);
  assert.notStrictEqual(copy, input);
  input.limitations.push("changed");
  assert.deepEqual(copy.limitations, []);
});
test("internal odds rejects boundedness, timestamps, duplicates and forbidden payloads", () => {
  for (const mutate of [
    (x: InternalOddsIntelligenceContext) => (x.overall_reliability_score = 2),
    (x: InternalOddsIntelligenceContext) =>
      (x.markets[0].provider_dispersion = -1),
    (x: InternalOddsIntelligenceContext) =>
      (x.markets[0].latest_timestamp = "bad"),
    (x: InternalOddsIntelligenceContext) => x.markets.push(market()),
    (x: InternalOddsIntelligenceContext) =>
      (x.markets[0].selections[1].fair_probability = 2),
    (x: InternalOddsIntelligenceContext) =>
      ((x as unknown as Record<string, unknown>).provider_payload = {}),
  ]) {
    const x = internal();
    mutate(x);
    assert.throws(() => assertInternalOddsIntelligenceValid(x));
  }
});
test("public output permits summaries but rejects internal keys", () => {
  const input = pub();
  assert.doesNotThrow(() => assertPublicMarketIntelligenceSafe(input));
  const copy = buildPublicMarketIntelligence(input);
  assert.notStrictEqual(copy, input);
  for (const key of [
    "recommended_model_weight",
    "fair_probability",
    "component_scores",
  ]) {
    const x = pub() as unknown as Record<string, unknown>;
    x[key] = 0.5;
    assert.throws(() => assertPublicMarketIntelligenceSafe(x));
  }
});
test("component scores require the exact declared key set", () => {
  const x = internal();
  delete (x.markets[0].component_scores as Record<string, unknown>).freshness;
  assert.throws(() => assertInternalOddsIntelligenceValid(x));
  const y = internal();
  (y.markets[0].component_scores as Record<string, unknown>).unexpected = 0.5;
  assert.throws(() => assertInternalOddsIntelligenceValid(y));
});
test("market and root counts and usability are consistent", () => {
  const x = internal();
  x.market_count = 2;
  assert.throws(() => assertInternalOddsIntelligenceValid(x));
  const y = internal();
  y.markets[0].usable = false;
  y.markets[0].recommended_model_weight = 0.1;
  assert.throws(() => assertInternalOddsIntelligenceValid(y));
  const z = internal();
  z.usable_for_model = false;
  z.recommended_market_model_weight = 0.1;
  assert.throws(() => assertInternalOddsIntelligenceValid(z));
});
test("complete fair and consensus probabilities must sum to one", () => {
  const x = internal();
  x.markets[0].selections[0].fair_probability = 0.5;
  assert.throws(() => assertInternalOddsIntelligenceValid(x));
  const y = internal();
  y.markets[0].selections[0].consensus_probability = 0.5;
  assert.throws(() => assertInternalOddsIntelligenceValid(y));
});
test("primary market attachment and timestamp are enforced", () => {
  const x = internal();
  x.primary_match_result_market!.market_type = "next_goal";
  assert.throws(() => assertInternalOddsIntelligenceValid(x));
  const y = internal();
  y.markets[0].latest_timestamp = "2026-07-11T00:00:00Z";
  assert.throws(() => assertInternalOddsIntelligenceValid(y));
});
test("public provider/count/timestamp invariants and movement deduplication are enforced", () => {
  const x = pub();
  x.provider_count = 0;
  assert.throws(() => assertPublicMarketIntelligenceSafe(x));
  const y = pub();
  y.availability = "unavailable";
  assert.throws(() => assertPublicMarketIntelligenceSafe(y));
  const z = pub();
  z.notable_movements.push({ ...z.notable_movements[0] });
  const copy = buildPublicMarketIntelligence(z);
  assert.equal(copy.notable_movements.length, 1);
});

// Phase 10C-H2 traceability: one named test per permanent Odds invariant.
test("valid internal Odds context passes", () => assert.doesNotThrow(() => assertInternalOddsIntelligenceValid(internal())));
test("internal Odds builder returns a deep clone", () => { const input = internal(); const copy = buildInternalOddsIntelligenceContext(input); assert.notStrictEqual(copy.markets, input.markets); assert.notStrictEqual(copy.markets[0].selections, input.markets[0].selections); });
test("internal Odds builder preserves all probability and reliability values exactly", () => { const input = internal(); input.markets[0].selections[0].fair_probability = 0.400001; input.markets[0].selections[0].consensus_probability = 0.400001; input.markets[0].reliability_score = 0.800001; input.markets[0].component_scores.overall_reliability = 0.800001; const copy = buildInternalOddsIntelligenceContext(input); assert.equal(copy.markets[0].selections[0].fair_probability, 0.400001); assert.equal(copy.markets[0].selections[0].consensus_probability, 0.400001); assert.equal(copy.markets[0].reliability_score, 0.800001); });
test("internal Odds builder deduplicates root issues", () => { const x = internal(); x.issues = ["single_provider", "single_provider"]; assert.deepEqual(buildInternalOddsIntelligenceContext(x).issues, ["single_provider"]); });
test("internal Odds builder deduplicates market issues", () => { const x = internal(); x.markets[0].issues = ["single_provider", "single_provider"]; assert.deepEqual(buildInternalOddsIntelligenceContext(x).markets[0].issues, ["single_provider"]); });
test("missing component score fails", () => { const x = internal(); delete (x.markets[0].component_scores as Record<string, unknown>).freshness; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("unexpected component score fails", () => { const x = internal(); (x.markets[0].component_scores as Record<string, unknown>).unexpected = 0.5; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("component score outside 0..1 fails", () => { const x = internal(); x.markets[0].component_scores.freshness = 2; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("component overall reliability must match market reliability", () => { const x = internal(); x.markets[0].component_scores.overall_reliability = 0.7; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root market count must match array length", () => { const x = internal(); x.market_count = 2; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("usable-market count must match actual usable markets", () => { const x = internal(); x.usable_market_count = 0; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("selection count must match selections length", () => { const x = internal(); x.markets[0].selection_count = 2; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root provider count cannot be lower than market provider count", () => { const x = internal(); x.provider_count = 1; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root snapshot count cannot be lower than market snapshot count", () => { const x = internal(); x.snapshot_count = 3; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("complete fair probabilities must sum to one", () => { const x = internal(); x.markets[0].selections[0].fair_probability = 0.5; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("complete consensus probabilities must sum to one", () => { const x = internal(); x.markets[0].selections[0].consensus_probability = 0.5; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("duplicate selection and line fails", () => { const x = internal(); x.markets[0].selections.push({ ...x.markets[0].selections[0], fair_probability: 0, consensus_probability: 0 }); x.markets[0].selection_count = 4; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("duplicate market key fails", () => { const x = internal(); x.markets.push({ ...market(), selections: market().selections.map((s) => ({ ...s })), component_scores: component() }); x.market_count = 2; x.usable_market_count = 2; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("unusable market requires zero model weight", () => { const x = internal(); x.markets[0].usable = false; x.markets[0].recommended_model_weight = 0.1; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("usable market requires complete market", () => { const x = internal(); x.markets[0].complete = false; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("usable market requires positive model weight", () => { const x = internal(); x.markets[0].recommended_model_weight = 0; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root unusable context requires zero market-model weight", () => { const x = internal(); x.usable_for_model = false; x.recommended_market_model_weight = 0.1; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root usable context requires usable markets", () => { const x = internal(); x.usable_market_count = 0; x.markets[0].usable = false; x.markets[0].recommended_model_weight = 0; x.primary_match_result_market = null; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("root usable context requires positive reliability", () => { const x = internal(); x.overall_reliability_score = 0; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("primary market must be match_result_1x2", () => { const x = internal(); x.primary_match_result_market!.market_type = "next_goal"; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("primary market key must exist in markets", () => { const x = internal(); x.primary_match_result_market!.market_key = "detached"; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("invalid market timestamp fails", () => { const x = internal(); x.markets[0].latest_timestamp = "bad"; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("market timestamp after generated time fails", () => { const x = internal(); x.markets[0].latest_timestamp = "2026-07-11T00:00:00Z"; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("empty markets require unavailable or invalid status", () => { const x = internal(); x.markets = []; x.market_count = 0; x.usable_market_count = 0; x.primary_match_result_market = null; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("recursive provider payload fails", () => { const x = internal() as unknown as Record<string, unknown>; x.nested = [{ provider_payload: {} }]; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("private provider weights fail", () => { const x = internal() as unknown as Record<string, unknown>; x.nested = { private_provider_weights: {} }; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });
test("raw Odds rows fail", () => { const x = internal() as unknown as Record<string, unknown>; x.raw_odds_rows = []; assert.throws(() => assertInternalOddsIntelligenceValid(x)); });

test("valid public output passes", () => assert.doesNotThrow(() => assertPublicMarketIntelligenceSafe(pub())));
test("public builder returns a deep clone", () => { const input = pub(); const copy = buildPublicMarketIntelligence(input); assert.notStrictEqual(copy, input); assert.notStrictEqual(copy.notable_movements, input.notable_movements); });
test("public builder preserves public counts and labels exactly", () => { const input = pub(); const copy = buildPublicMarketIntelligence(input); assert.equal(copy.market_count, input.market_count); assert.equal(copy.availability, input.availability); assert.equal(copy.provider_coverage, input.provider_coverage); });
test("public builder deduplicates limitations", () => { const x = pub(); x.limitations = ["a", "a"]; assert.deepEqual(buildPublicMarketIntelligence(x).limitations, ["a"]); });
test("public builder deduplicates identical movements", () => { const x = pub(); x.notable_movements.push({ ...x.notable_movements[0] }); assert.equal(buildPublicMarketIntelligence(x).notable_movements.length, 1); });
test("usable count cannot exceed market count", () => { const x = pub(); x.usable_market_count = 2; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("unavailable output requires zero usable markets", () => { const x = pub(); x.availability = "unavailable"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("zero providers require none coverage", () => { const x = pub(); x.provider_count = 0; x.provider_coverage = "single"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("one provider requires single coverage", () => { const x = pub(); x.provider_count = 1; x.provider_coverage = "broad"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("invalid generated timestamp fails", () => { const x = pub(); x.generated_at = "bad"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("invalid last-update timestamp fails", () => { const x = pub(); x.last_update = "bad"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("last update after generated time fails", () => { const x = pub(); x.last_update = "2026-07-11T00:00:00Z"; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public fair probability fails", () => { const x = pub() as unknown as Record<string, unknown>; x.fair_probability = 0.5; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public consensus probability fails", () => { const x = pub() as unknown as Record<string, unknown>; x.consensus_probability = 0.5; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public model weight fails", () => { const x = pub() as unknown as Record<string, unknown>; x.recommended_model_weight = 0.5; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public provider-quality internals fail", () => { const x = pub() as unknown as Record<string, unknown>; x.provider_quality = 0.5; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public component scores fail", () => { const x = pub() as unknown as Record<string, unknown>; x.component_scores = {}; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("public feature reference fails", () => { const x = pub() as unknown as Record<string, unknown>; x.feature_reference = {}; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
test("negative betting disclaimer text remains allowed", () => { const x = pub(); x.summary = "Not a betting recommendation."; assert.doesNotThrow(() => assertPublicMarketIntelligenceSafe(x)); });
test("recursive nested forbidden key fails", () => { const x = pub() as unknown as Record<string, unknown>; x.nested = [{ odds_intelligence_reference: {} }]; assert.throws(() => assertPublicMarketIntelligenceSafe(x)); });
