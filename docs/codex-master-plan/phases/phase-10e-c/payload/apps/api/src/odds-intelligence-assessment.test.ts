import assert from "node:assert/strict";
import test from "node:test";
import {
  ODDS_ASSESSMENT_POLICY_VERSION,
  assessOddsIntelligence,
  type OddsEventConsistencyEvidence,
} from "./odds-intelligence-assessment.js";
import type { NormalizedStoredOddsObservation } from "./odds-market-normalization.js";

const BASE = Date.parse("2026-01-01T00:00:00.000Z");

function iso(minute: number, seconds = 0): string {
  return new Date(BASE + minute * 60_000 + seconds * 1_000).toISOString();
}

function observation(
  overrides: Partial<NormalizedStoredOddsObservation> = {},
): NormalizedStoredOddsObservation {
  return {
    fixture_id: "fixture-1",
    external_seq: "seq",
    provider_key: "Provider-A",
    market_key: "match_result_1x2|period:0",
    market_type: "match_result_1x2",
    selection: "home",
    line: null,
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: iso(0),
    created_at: iso(0, 1),
    ...overrides,
  };
}

function complete1x2(input: {
  provider?: string | null;
  minute?: number;
  home?: number;
  draw?: number;
  away?: number;
  market_key?: string;
} = {}): NormalizedStoredOddsObservation[] {
  const provider = input.provider === undefined ? "Provider-A" : input.provider;
  const minute = input.minute ?? 0;
  const timestamp = iso(minute);
  const marketKey = input.market_key ?? "match_result_1x2|period:0";
  return [
    observation({ provider_key: provider, market_key: marketKey, source_timestamp: timestamp, created_at: iso(minute, 1), selection: "home", decimal_odds: input.home ?? 2, external_seq: `${provider}-h-${minute}` }),
    observation({ provider_key: provider, market_key: marketKey, source_timestamp: timestamp, created_at: iso(minute, 1), selection: "draw", decimal_odds: input.draw ?? 4, external_seq: `${provider}-d-${minute}` }),
    observation({ provider_key: provider, market_key: marketKey, source_timestamp: timestamp, created_at: iso(minute, 1), selection: "away", decimal_odds: input.away ?? 4, external_seq: `${provider}-a-${minute}` }),
  ];
}

function timeline(input: {
  providers?: string[];
  minutes?: number[];
  prices?: (minute: number, provider: string) => { home: number; draw: number; away: number };
} = {}): NormalizedStoredOddsObservation[] {
  const providers = input.providers ?? ["Provider-A"];
  const minutes = input.minutes ?? [0];
  return minutes.flatMap((minute) => providers.flatMap((provider) => {
    const prices = input.prices?.(minute, provider) ?? { home: 2, draw: 4, away: 4 };
    return complete1x2({ provider, minute, ...prices });
  }));
}

function evidence(
  overrides: Partial<OddsEventConsistencyEvidence> = {},
): OddsEventConsistencyEvidence[] {
  return [{
    market_key: "match_result_1x2|period:0",
    score: 1,
    critical: false,
    ...overrides,
  }];
}

function assess(
  observations: readonly NormalizedStoredOddsObservation[],
  overrides: Partial<Parameters<typeof assessOddsIntelligence>[0]> = {},
) {
  return assessOddsIntelligence({
    fixture_id: "fixture-1",
    generated_at: iso(10, 30),
    observations,
    event_consistency: evidence(),
    ...overrides,
  });
}

function close(actual: number, expected: number, tolerance = 1e-12): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("policy version is fixed", () => {
  assert.equal(ODDS_ASSESSMENT_POLICY_VERSION, "odds-assessment-policy-v1");
});

test("empty observations produce an unavailable context", () => {
  const result = assess([]);
  assert.equal(result.status, "unavailable");
  assert.equal(result.usable_for_model, false);
  assert.equal(result.market_count, 0);
  assert.equal(result.recommended_market_model_weight, 0);
});

test("unavailable context has a deterministic assessment ID", () => {
  assert.equal(assess([]).assessment_id, assess([]).assessment_id);
});

test("fixture_id must be non-empty", () => {
  assert.throws(() => assessOddsIntelligence({ fixture_id: "", generated_at: iso(1), observations: [] }), TypeError);
});

test("generated_at must be valid", () => {
  assert.throws(() => assessOddsIntelligence({ fixture_id: "f", generated_at: "bad", observations: [] }), TypeError);
});

test("observations must be an array", () => {
  assert.throws(() => assessOddsIntelligence({ fixture_id: "f", generated_at: iso(1), observations: null as never }), TypeError);
});

test("fixture mismatch returns invalid without markets", () => {
  const result = assess(complete1x2().map((row) => ({ ...row, fixture_id: "other" })));
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues, ["fixture_mismatch"]);
  assert.equal(result.market_count, 0);
});

test("invalid odds return invalid without throwing", () => {
  const rows = complete1x2();
  rows[0] = { ...rows[0]!, decimal_odds: 1 };
  const result = assess(rows);
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues, ["invalid_odds_value"]);
});

test("invalid observation timestamp returns invalid", () => {
  const rows = complete1x2();
  rows[0] = { ...rows[0]!, source_timestamp: "bad" };
  const result = assess(rows);
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues, ["invalid_timestamp"]);
});

test("future observation timestamp returns invalid", () => {
  const result = assess(complete1x2({ minute: 11 }));
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues, ["invalid_timestamp"]);
});

test("single fresh provider creates one limited usable market", () => {
  const result = assess(complete1x2({ minute: 10 }));
  assert.equal(result.market_count, 1);
  assert.equal(result.usable_market_count, 1);
  assert.equal(result.status, "limited");
  assert.equal(result.markets[0]!.reliability_level, "limited");
  assert.equal(result.markets[0]!.usable, true);
  assert.ok(result.markets[0]!.recommended_model_weight > 0);
  assert.deepEqual(result.markets[0]!.issues, ["insufficient_history", "single_provider"]);
});

test("complete probabilities are normalized", () => {
  const market = assess(complete1x2({ minute: 10 })).markets[0]!;
  close(market.selections.reduce((sum, row) => sum + row.fair_probability, 0), 1);
  close(market.selections.reduce((sum, row) => sum + row.consensus_probability, 0), 1);
});

test("single-provider consensus equals canonical fair probabilities", () => {
  const market = assess(complete1x2({ minute: 10 })).markets[0]!;
  for (const selection of market.selections) {
    close(selection.fair_probability, selection.consensus_probability);
  }
});

test("overround is copied from the canonical current snapshot", () => {
  const market = assess(complete1x2({ minute: 10, home: 1.8, draw: 3.5, away: 4.2 })).markets[0]!;
  close(market.overround!, (1 / 1.8) + (1 / 3.5) + (1 / 4.2) - 1);
});

test("freshness score is one inside the fresh window", () => {
  const market = assess(complete1x2({ minute: 10 })).markets[0]!;
  assert.equal(market.component_scores.freshness, 1);
});

test("aging freshness score is deterministic", () => {
  const result = assess(complete1x2({ minute: 6 }), { generated_at: iso(10) });
  assert.equal(result.markets[0]!.component_scores.freshness, 0.85);
});

test("soft-stale freshness score is deterministic", () => {
  const result = assess(complete1x2({ minute: 0 }), { generated_at: iso(10) });
  assert.equal(result.markets[0]!.component_scores.freshness, 0.6);
});

test("hard-stale data is unusable", () => {
  const result = assess(complete1x2({ minute: 0 }), { generated_at: iso(31) });
  assert.equal(result.markets[0]!.component_scores.freshness, 0);
  assert.equal(result.markets[0]!.usable, false);
  assert.equal(result.markets[0]!.recommended_model_weight, 0);
  assert.ok(result.markets[0]!.issues.includes("stale_snapshot"));
});

test("incomplete current market is unusable", () => {
  const rows = complete1x2({ minute: 10 }).filter((row) => row.selection !== "away");
  const result = assess(rows);
  assert.equal(result.markets[0]!.complete, false);
  assert.equal(result.markets[0]!.usable, false);
  assert.ok(result.markets[0]!.issues.includes("selection_missing"));
});

test("one incomplete provider degrades but does not erase another complete provider", () => {
  const incomplete = complete1x2({ provider: "B", minute: 10 }).filter((row) => row.selection !== "away");
  const result = assess([...complete1x2({ provider: "A", minute: 10 }), ...incomplete]);
  const market = result.markets[0]!;
  assert.equal(market.provider_count, 2);
  assert.equal(market.complete, true);
  assert.ok(market.issues.includes("market_incomplete"));
  assert.equal(market.component_scores.market_completeness, 0.5);
});

test("unsupported correct-score market is invalid and unusable", () => {
  const rows = [observation({
    market_key: "correct_score|period:0",
    market_type: "correct_score",
    selection: "other",
    decimal_odds: 8,
    source_timestamp: iso(10),
  })];
  const result = assess(rows, { event_consistency: [] });
  assert.equal(result.markets[0]!.reliability_level, "invalid");
  assert.equal(result.markets[0]!.usable, false);
  assert.ok(result.markets[0]!.issues.includes("unknown_market"));
});

test("unknown normalized selection is reported", () => {
  const rows = complete1x2({ minute: 10 });
  rows.push(observation({ selection: "unknown", decimal_odds: 10, source_timestamp: iso(10), external_seq: "unknown" }));
  const result = assess(rows);
  assert.ok(result.markets[0]!.issues.includes("unknown_selection"));
  assert.equal(result.markets[0]!.usable, false);
});

test("conflicting lines under one market key are invalid", () => {
  const rows = complete1x2({ minute: 10 });
  rows[2] = { ...rows[2]!, line: 2.5 };
  const result = assess(rows);
  assert.equal(result.markets[0]!.reliability_level, "invalid");
  assert.equal(result.markets[0]!.usable, false);
});

test("exact duplicate rows are removed and reported", () => {
  const rows = complete1x2({ minute: 10 });
  const result = assess([...rows, { ...rows[0]! }]);
  assert.ok(result.markets[0]!.issues.includes("duplicate_snapshot"));
  assert.equal(result.markets[0]!.selection_count, 3);
});

test("duplicate evidence changes assessment identity", () => {
  const rows = complete1x2({ minute: 10 });
  assert.notEqual(assess(rows).assessment_id, assess([...rows, { ...rows[0]! }]).assessment_id);
});

test("input permutation does not change the assessment", () => {
  const rows = timeline({ providers: ["A", "B"], minutes: [8, 9, 10] });
  assert.deepEqual(assess(rows), assess([...rows].reverse()));
});

test("three providers and ten stable buckets can reach high confidence", () => {
  const rows = timeline({ providers: ["A", "B", "C"], minutes: [1,2,3,4,5,6,7,8,9,10] });
  const result = assess(rows);
  assert.equal(result.status, "high_confidence");
  assert.equal(result.markets[0]!.reliability_level, "high_confidence");
  assert.equal(result.markets[0]!.issues.length, 0);
  assert.ok(result.recommended_market_model_weight > 0.2);
});

test("high-confidence component formula is exact", () => {
  const rows = timeline({ providers: ["A", "B", "C"], minutes: [1,2,3,4,5,6,7,8,9,10] });
  const component = assess(rows).markets[0]!.component_scores;
  assert.equal(component.structural_validity, 1);
  assert.equal(component.freshness, 1);
  assert.equal(component.market_completeness, 1);
  assert.equal(component.provider_quality, 0.85);
  assert.equal(component.provider_consensus, 0.9325);
  assert.equal(component.dispersion_quality, 1);
  assert.equal(component.movement_integrity, 1);
  assert.equal(component.event_consistency, 1);
  assert.equal(component.historical_support, 0.85);
  close(component.overall_reliability, 0.96925);
});

test("two providers and three buckets can be reliable", () => {
  const rows = timeline({ providers: ["A", "B"], minutes: [8, 9, 10] });
  const result = assess(rows);
  assert.equal(result.markets[0]!.reliability_level, "reliable");
  assert.equal(result.status, "reliable");
});

test("provider disagreement is reported", () => {
  const rows = [
    ...complete1x2({ provider: "A", minute: 10, home: 1.3, draw: 6, away: 12 }),
    ...complete1x2({ provider: "B", minute: 10, home: 5, draw: 3.5, away: 1.8 }),
  ];
  const result = assess(rows);
  assert.ok(result.markets[0]!.issues.includes("provider_disagreement"));
});

test("hard provider dispersion makes the market unusable", () => {
  const rows = [
    ...complete1x2({ provider: "A", minute: 10, home: 1.15, draw: 12, away: 20 }),
    ...complete1x2({ provider: "B", minute: 10, home: 8, draw: 4, away: 1.4 }),
  ];
  const market = assess(rows).markets[0]!;
  assert.ok(market.provider_dispersion! >= 0.08);
  assert.equal(market.usable, false);
});

test("robust provider outlier is reported without changing selection count", () => {
  const rows = [
    ...complete1x2({ provider: "A", minute: 10 }),
    ...complete1x2({ provider: "B", minute: 10 }),
    ...complete1x2({ provider: "C", minute: 10, home: 1.1, draw: 15, away: 15 }),
  ];
  const market = assess(rows).markets[0]!;
  assert.ok(market.issues.includes("provider_outlier"));
  assert.equal(market.selection_count, 3);
});

test("temporal movement exposes one-minute and five-minute changes", () => {
  const rows = timeline({
    providers: ["A"],
    minutes: [5, 9, 10],
    prices: (minute) => minute === 10
      ? { home: 1.6666666667, draw: 5, away: 5 }
      : { home: 2, draw: 4, away: 4 },
  });
  const home = assess(rows).markets[0]!.selections.find((row) => row.selection === "home")!;
  assert.notEqual(home.probability_change_1m, null);
  assert.notEqual(home.probability_change_5m, null);
  assert.ok(home.probability_change_1m! > 0);
  assert.ok(home.probability_change_5m! > 0);
});

test("temporal velocity and acceleration are exposed", () => {
  const rows = timeline({
    minutes: [8, 9, 10],
    prices: (minute) => ({ home: minute === 8 ? 2.2 : minute === 9 ? 2 : 1.7, draw: 4, away: 4 }),
  });
  const home = assess(rows).markets[0]!.selections.find((row) => row.selection === "home")!;
  assert.notEqual(home.movement_velocity, null);
  assert.notEqual(home.movement_acceleration, null);
});

test("insufficient temporal anchors remain null", () => {
  const home = assess(complete1x2({ minute: 10 })).markets[0]!.selections.find((row) => row.selection === "home")!;
  assert.equal(home.probability_change_1m, null);
  assert.equal(home.probability_change_5m, null);
  assert.equal(home.movement_velocity, null);
});

test("abnormal movement is reported", () => {
  const rows = timeline({
    minutes: [9, 10],
    prices: (minute) => minute === 9
      ? { home: 3, draw: 3, away: 3 }
      : { home: 1.5, draw: 6, away: 6 },
  });
  const market = assess(rows).markets[0]!;
  assert.ok(market.issues.includes("abnormal_jump"));
  assert.ok(market.volatility_score > 0);
  assert.ok(assess(rows).anomaly_score > 0);
});

test("hard abnormal movement makes market unusable", () => {
  const rows = timeline({
    minutes: [9, 10],
    prices: (minute) => minute === 9
      ? { home: 10, draw: 2, away: 2 }
      : { home: 1.1, draw: 20, away: 20 },
  });
  assert.equal(assess(rows).markets[0]!.usable, false);
});

test("missing event evidence uses the neutral evidence score", () => {
  const market = assess(complete1x2({ minute: 10 }), { event_consistency: [] }).markets[0]!;
  assert.equal(market.component_scores.event_consistency, 0.5);
  assert.ok(market.limitations.some((line) => line.includes("event-consistency")));
});

test("low event consistency is reported", () => {
  const market = assess(complete1x2({ minute: 10 }), { event_consistency: evidence({ score: 0.3 }) }).markets[0]!;
  assert.ok(market.issues.includes("event_inconsistency"));
});

test("critical event inconsistency is a hard gate", () => {
  const market = assess(complete1x2({ minute: 10 }), { event_consistency: evidence({ critical: true }) }).markets[0]!;
  assert.equal(market.usable, false);
  assert.equal(market.recommended_model_weight, 0);
});

test("event evidence keys must be unique", () => {
  assert.throws(() => assess(complete1x2({ minute: 10 }), { event_consistency: [...evidence(), ...evidence()] }), TypeError);
});

test("event evidence score must be bounded", () => {
  assert.throws(() => assess(complete1x2({ minute: 10 }), { event_consistency: evidence({ score: 2 }) }), TypeError);
});

test("root counts are aggregated from markets", () => {
  const second = complete1x2({ provider: "A", minute: 10, market_key: "match_result_1x2|period:1" });
  const result = assess([...complete1x2({ provider: "A", minute: 10 }), ...second], {
    event_consistency: [
      ...evidence(),
      { market_key: "match_result_1x2|period:1", score: 1, critical: false },
    ],
  });
  assert.equal(result.market_count, 2);
  assert.equal(result.usable_market_count, 2);
  assert.equal(result.snapshot_count, 2);
  assert.equal(result.provider_count, 1);
});

test("primary match-result market is selected deterministically", () => {
  const second = complete1x2({ provider: "A", minute: 9, market_key: "match_result_1x2|period:1" });
  const result = assess([...complete1x2({ provider: "A", minute: 10 }), ...second], {
    event_consistency: [
      ...evidence(),
      { market_key: "match_result_1x2|period:1", score: 1, critical: false },
    ],
  });
  assert.equal(result.primary_match_result_market?.market_key, "match_result_1x2|period:0");
});

test("no usable market produces zero root model weight", () => {
  const result = assess(complete1x2({ minute: 0 }), { generated_at: iso(31) });
  assert.equal(result.usable_for_model, false);
  assert.equal(result.recommended_market_model_weight, 0);
});

test("root issues and limitations are deduplicated", () => {
  const second = complete1x2({ provider: "A", minute: 10, market_key: "match_result_1x2|period:1" });
  const result = assess([...complete1x2({ provider: "A", minute: 10 }), ...second], { event_consistency: [] });
  assert.equal(result.issues.filter((issue) => issue === "single_provider").length, 1);
  assert.equal(new Set(result.limitations).size, result.limitations.length);
});

test("assessment ID changes when generated_at changes", () => {
  const rows = complete1x2({ minute: 10 });
  assert.notEqual(assess(rows).assessment_id, assess(rows, { generated_at: iso(10, 31) }).assessment_id);
});

test("assessment ID changes when event evidence changes", () => {
  const rows = complete1x2({ minute: 10 });
  assert.notEqual(assess(rows).assessment_id, assess(rows, { event_consistency: evidence({ score: 0.9 }) }).assessment_id);
});

test("assessment ID changes when odds content changes", () => {
  assert.notEqual(
    assess(complete1x2({ minute: 10 })).assessment_id,
    assess(complete1x2({ minute: 10, home: 1.9 })).assessment_id,
  );
});

test("assessment does not mutate observations", () => {
  const rows = timeline({ providers: ["A", "B"], minutes: [9, 10] });
  const before = structuredClone(rows);
  assess(rows);
  assert.deepEqual(rows, before);
});
