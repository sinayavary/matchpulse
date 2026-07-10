import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateProviderProbabilities,
  buildProviderMarketSnapshots,
  calculateOverround,
  decimalOddsToImpliedProbability,
  detectRobustOutliers,
  getRequiredSelectionsForMarket,
  groupMarketSnapshotsByTimeWindow,
  median,
  medianAbsoluteDeviation,
  normalizeImpliedProbabilities,
} from "./odds-mathematical-primitives.js";
import type {
  NormalizedStoredOddsObservation,
} from "./odds-market-normalization.js";

const TOLERANCE = 1e-12;

function close(actual: number, expected: number, tolerance = TOLERANCE): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`,
  );
}

function observation(
  overrides: Partial<NormalizedStoredOddsObservation> = {},
): NormalizedStoredOddsObservation {
  return {
    fixture_id: "fixture-1",
    external_seq: "seq-1",
    provider_key: "Provider-A",
    market_key: "match_result_1x2|period:0",
    market_type: "match_result_1x2",
    selection: "home",
    line: null,
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:01.000Z",
    ...overrides,
  };
}

function complete1x2(input: {
  provider?: string | null;
  timestamp?: string;
  home?: number;
  draw?: number;
  away?: number;
} = {}): NormalizedStoredOddsObservation[] {
  const provider = input.provider === undefined ? "Provider-A" : input.provider;
  const timestamp = input.timestamp ?? "2026-01-01T00:00:00.000Z";
  return [
    observation({
      provider_key: provider,
      source_timestamp: timestamp,
      selection: "home",
      decimal_odds: input.home ?? 2,
      external_seq: `${provider ?? "unknown"}-home-${timestamp}`,
    }),
    observation({
      provider_key: provider,
      source_timestamp: timestamp,
      selection: "draw",
      decimal_odds: input.draw ?? 4,
      external_seq: `${provider ?? "unknown"}-draw-${timestamp}`,
    }),
    observation({
      provider_key: provider,
      source_timestamp: timestamp,
      selection: "away",
      decimal_odds: input.away ?? 4,
      external_seq: `${provider ?? "unknown"}-away-${timestamp}`,
    }),
  ];
}

function completeSnapshot(input: Parameters<typeof complete1x2>[0] = {}) {
  const snapshots = buildProviderMarketSnapshots(complete1x2(input));
  assert.equal(snapshots.length, 1);
  return snapshots[0]!;
}

test("decimal odds convert to implied probability", () => {
  close(decimalOddsToImpliedProbability(2), 0.5);
  close(decimalOddsToImpliedProbability(4), 0.25);
});

test("decimal odds conversion rejects one", () => {
  assert.throws(() => decimalOddsToImpliedProbability(1), RangeError);
});

test("decimal odds conversion rejects values below one", () => {
  assert.throws(() => decimalOddsToImpliedProbability(0.99), RangeError);
});

test("decimal odds conversion rejects NaN and Infinity", () => {
  assert.throws(() => decimalOddsToImpliedProbability(Number.NaN), RangeError);
  assert.throws(() => decimalOddsToImpliedProbability(Infinity), RangeError);
});

test("overround is implied probability sum minus one", () => {
  close(calculateOverround([2, 4, 4]), 0);
  close(calculateOverround([1.8, 3.5, 4.2]), (1 / 1.8) + (1 / 3.5) + (1 / 4.2) - 1);
});

test("overround rejects an empty collection", () => {
  assert.throws(() => calculateOverround([]), TypeError);
});

test("normalizing implied probabilities produces a unit distribution", () => {
  const result = normalizeImpliedProbabilities([
    { key: "home", implied_probability: 0.6 },
    { key: "away", implied_probability: 0.4 },
  ]);
  close(result[0]!.fair_probability, 0.6);
  close(result[1]!.fair_probability, 0.4);
  close(result.reduce((sum, row) => sum + row.fair_probability, 0), 1);
});

test("normalizing implied probabilities rejects duplicate keys", () => {
  assert.throws(() => normalizeImpliedProbabilities([
    { key: "home", implied_probability: 0.5 },
    { key: "home", implied_probability: 0.5 },
  ]), TypeError);
});

test("normalizing implied probabilities rejects non-positive values", () => {
  assert.throws(() => normalizeImpliedProbabilities([
    { key: "home", implied_probability: 0 },
  ]), RangeError);
});

test("required selections are exact for supported markets", () => {
  assert.deepEqual(getRequiredSelectionsForMarket("match_result_1x2"), ["home", "draw", "away"]);
  assert.deepEqual(getRequiredSelectionsForMarket("total_goals"), ["over", "under"]);
  assert.deepEqual(getRequiredSelectionsForMarket("both_teams_to_score"), ["yes", "no"]);
  assert.deepEqual(getRequiredSelectionsForMarket("asian_handicap"), ["home", "away"]);
  assert.deepEqual(getRequiredSelectionsForMarket("next_goal"), ["home", "none", "away"]);
});

test("unsupported markets have no required probability selection set", () => {
  assert.equal(getRequiredSelectionsForMarket("double_chance"), null);
  assert.equal(getRequiredSelectionsForMarket("correct_score"), null);
  assert.equal(getRequiredSelectionsForMarket("unknown"), null);
});

test("complete 1x2 snapshot is reconstructed", () => {
  const snapshot = completeSnapshot();
  assert.equal(snapshot.structural_status, "complete");
  assert.deepEqual(snapshot.required_selections, ["home", "draw", "away"]);
  assert.deepEqual(snapshot.present_selections, ["home", "draw", "away"]);
  assert.deepEqual(snapshot.missing_selections, []);
  assert.deepEqual(snapshot.unexpected_selections, []);
  assert.deepEqual(snapshot.duplicate_selections, []);
  assert.ok(snapshot.mathematics);
});

test("complete snapshot mathematics contains exact fair probabilities", () => {
  const mathematics = completeSnapshot().mathematics!;
  close(mathematics.implied_probability_sum, 1);
  close(mathematics.overround, 0);
  assert.deepEqual(
    mathematics.selections.map((row) => row.selection),
    ["home", "draw", "away"],
  );
  close(mathematics.selections[0]!.fair_probability, 0.5);
  close(mathematics.selections[1]!.fair_probability, 0.25);
  close(mathematics.selections[2]!.fair_probability, 0.25);
});

test("incomplete snapshot reports a missing selection", () => {
  const rows = complete1x2().filter((row) => row.selection !== "away");
  const snapshot = buildProviderMarketSnapshots(rows)[0]!;
  assert.equal(snapshot.structural_status, "incomplete");
  assert.deepEqual(snapshot.missing_selections, ["away"]);
  assert.equal(snapshot.mathematics, null);
});

test("unexpected selection makes a supported snapshot incomplete", () => {
  const rows = [
    ...complete1x2(),
    observation({
      selection: "unknown",
      decimal_odds: 10,
      external_seq: "unexpected",
    }),
  ];
  const snapshot = buildProviderMarketSnapshots(rows)[0]!;
  assert.equal(snapshot.structural_status, "incomplete");
  assert.deepEqual(snapshot.unexpected_selections, ["unknown"]);
  assert.equal(snapshot.mathematics, null);
});

test("duplicate required selection makes a snapshot ambiguous", () => {
  const rows = [
    ...complete1x2(),
    observation({
      selection: "home",
      decimal_odds: 2.1,
      external_seq: "duplicate-home",
    }),
  ];
  const snapshot = buildProviderMarketSnapshots(rows)[0]!;
  assert.equal(snapshot.structural_status, "ambiguous");
  assert.deepEqual(snapshot.duplicate_selections, ["home"]);
  assert.equal(snapshot.mathematics, null);
});

test("unsupported market snapshot remains visible without mathematics", () => {
  const snapshot = buildProviderMarketSnapshots([
    observation({
      market_key: "correct_score|period:0",
      market_type: "correct_score",
      selection: "other",
      decimal_odds: 8,
    }),
  ])[0]!;
  assert.equal(snapshot.structural_status, "unsupported");
  assert.deepEqual(snapshot.required_selections, []);
  assert.equal(snapshot.mathematics, null);
});

test("null provider remains one explicit provider snapshot", () => {
  const snapshot = completeSnapshot({ provider: null });
  assert.equal(snapshot.provider_key, null);
  assert.equal(snapshot.structural_status, "complete");
});

test("StablePrice is represented as one provider snapshot", () => {
  const snapshots = buildProviderMarketSnapshots(
    complete1x2({ provider: "TXLineStablePriceDemargined" }),
  );
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]!.provider_key, "TXLineStablePriceDemargined");
});

test("source timestamp defines snapshot time when available", () => {
  const snapshot = completeSnapshot({
    timestamp: "2026-01-01T00:05:00Z",
  });
  assert.equal(snapshot.observed_at, "2026-01-01T00:05:00.000Z");
});

test("created timestamp is used when source timestamp is absent", () => {
  const rows = complete1x2().map((row) => ({
    ...row,
    source_timestamp: null,
    created_at: "2026-01-01T00:07:00Z",
  }));
  const snapshot = buildProviderMarketSnapshots(rows)[0]!;
  assert.equal(snapshot.observed_at, "2026-01-01T00:07:00.000Z");
});

test("snapshot construction is input permutation invariant", () => {
  const rows = complete1x2();
  const forward = buildProviderMarketSnapshots(rows);
  const reverse = buildProviderMarketSnapshots([...rows].reverse());
  assert.deepEqual(forward, reverse);
});

test("different providers create different provider snapshots", () => {
  const snapshots = buildProviderMarketSnapshots([
    ...complete1x2({ provider: "A" }),
    ...complete1x2({ provider: "B" }),
  ]);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots.map((row) => row.provider_key), ["A", "B"]);
});

test("same snapshot identity rejects conflicting market types", () => {
  const rows = complete1x2();
  rows[2] = {
    ...rows[2]!,
    market_type: "next_goal",
  };
  assert.throws(() => buildProviderMarketSnapshots(rows), TypeError);
});

test("same snapshot identity rejects conflicting lines", () => {
  const rows = complete1x2();
  rows[2] = {
    ...rows[2]!,
    line: 2.5,
  };
  assert.throws(() => buildProviderMarketSnapshots(rows), TypeError);
});

test("snapshot construction rejects invalid timestamps", () => {
  assert.throws(() => buildProviderMarketSnapshots([
    observation({
      source_timestamp: "invalid",
    }),
  ]), TypeError);
});

test("snapshot construction does not mutate input", () => {
  const rows = complete1x2();
  const before = structuredClone(rows);
  buildProviderMarketSnapshots(rows);
  assert.deepEqual(rows, before);
});

test("time windows use deterministic epoch-aligned boundaries", () => {
  const snapshots = [
    completeSnapshot({ provider: "A", timestamp: "2026-01-01T00:00:10Z" }),
    completeSnapshot({ provider: "B", timestamp: "2026-01-01T00:00:50Z" }),
    completeSnapshot({ provider: "C", timestamp: "2026-01-01T00:01:00Z" }),
  ];
  const buckets = groupMarketSnapshotsByTimeWindow(snapshots, 60_000);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0]!.bucket_start, "2026-01-01T00:00:00.000Z");
  assert.equal(buckets[0]!.bucket_end_exclusive, "2026-01-01T00:01:00.000Z");
  assert.equal(buckets[1]!.bucket_start, "2026-01-01T00:01:00.000Z");
});

test("time bucket counts snapshots providers and complete snapshots", () => {
  const completeA = completeSnapshot({ provider: "A", timestamp: "2026-01-01T00:00:10Z" });
  const completeB = completeSnapshot({ provider: "B", timestamp: "2026-01-01T00:00:20Z" });
  const incomplete = buildProviderMarketSnapshots(
    complete1x2({ provider: "C", timestamp: "2026-01-01T00:00:30Z" })
      .filter((row) => row.selection !== "away"),
  )[0]!;
  const bucket = groupMarketSnapshotsByTimeWindow(
    [completeA, completeB, incomplete],
    60_000,
  )[0]!;
  assert.equal(bucket.provider_snapshot_count, 3);
  assert.equal(bucket.distinct_provider_count, 3);
  assert.equal(bucket.complete_provider_snapshot_count, 2);
});

test("time bucket construction is permutation invariant", () => {
  const snapshots = [
    completeSnapshot({ provider: "A", timestamp: "2026-01-01T00:00:10Z" }),
    completeSnapshot({ provider: "B", timestamp: "2026-01-01T00:00:20Z" }),
  ];
  assert.deepEqual(
    groupMarketSnapshotsByTimeWindow(snapshots, 60_000),
    groupMarketSnapshotsByTimeWindow([...snapshots].reverse(), 60_000),
  );
});

test("time window must be a positive integer", () => {
  assert.throws(() => groupMarketSnapshotsByTimeWindow([], 0), RangeError);
  assert.throws(() => groupMarketSnapshotsByTimeWindow([], 1.5), RangeError);
});

test("median supports odd and even collections", () => {
  close(median([3, 1, 2]), 2);
  close(median([4, 1, 3, 2]), 2.5);
});

test("median rejects empty and non-finite collections", () => {
  assert.throws(() => median([]), TypeError);
  assert.throws(() => median([1, Number.NaN]), TypeError);
});

test("median absolute deviation is deterministic", () => {
  close(medianAbsoluteDeviation([1, 2, 3, 4, 100]), 1);
});

test("fewer than three values cannot be robust outliers", () => {
  const results = detectRobustOutliers([0.2, 0.9]);
  assert.deepEqual(results.map((row) => row.outlier), [false, false]);
});

test("modified z-score marks an obvious provider outlier", () => {
  const results = detectRobustOutliers([0.5, 0.52, 0.9]);
  assert.deepEqual(results.map((row) => row.outlier), [false, false, true]);
  assert.ok(results[2]!.modified_z_score! > 3.5);
});

test("zero MAD marks a deviating value as an outlier", () => {
  const results = detectRobustOutliers([0.5, 0.5, 0.7]);
  assert.deepEqual(results.map((row) => row.outlier), [false, false, true]);
  assert.equal(results[2]!.modified_z_score, null);
});

test("robust outlier threshold must be positive", () => {
  assert.throws(() => detectRobustOutliers([1, 2, 3], 0), RangeError);
});

test("single-provider consensus preserves the fair distribution", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot(),
  ])!;
  assert.equal(consensus.provider_count, 1);
  assert.deepEqual(consensus.excluded_provider_keys, []);
  close(consensus.selections[0]!.consensus_probability, 0.5);
  close(consensus.selections[1]!.consensus_probability, 0.25);
  close(consensus.selections[2]!.consensus_probability, 0.25);
});

test("StablePrice consensus counts one source", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "TXLineStablePriceDemargined" }),
  ])!;
  assert.equal(consensus.provider_count, 1);
  assert.equal(consensus.selections[0]!.raw_provider_count, 1);
});

test("provider consensus uses medians and normalizes to one", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A", home: 2, draw: 4, away: 4 }),
    completeSnapshot({ provider: "B", home: 1 / 0.52, draw: 1 / 0.24, away: 1 / 0.24 }),
    completeSnapshot({ provider: "C", home: 1 / 0.48, draw: 1 / 0.26, away: 1 / 0.26 }),
  ])!;
  close(
    consensus.selections.reduce(
      (sum, row) => sum + row.consensus_probability,
      0,
    ),
    1,
  );
  close(consensus.selections[0]!.raw_median_probability, 0.5);
});

test("provider consensus excludes robust outliers with sufficient evidence", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A", home: 1 / 0.5, draw: 1 / 0.25, away: 1 / 0.25 }),
    completeSnapshot({ provider: "B", home: 1 / 0.52, draw: 1 / 0.24, away: 1 / 0.24 }),
    completeSnapshot({ provider: "C", home: 1 / 0.9, draw: 1 / 0.05, away: 1 / 0.05 }),
  ])!;
  assert.deepEqual(consensus.excluded_provider_keys, ["C"]);
  close(consensus.selections[0]!.consensus_probability, 0.51);
  close(consensus.selections[1]!.consensus_probability, 0.245);
  close(consensus.selections[2]!.consensus_probability, 0.245);
  assert.equal(consensus.selections[0]!.used_provider_count, 2);
});


test("outliers are not reported excluded when exclusion would leave fewer than two providers", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A", home: 10, draw: 2.5, away: 2 }),
    completeSnapshot({ provider: "B", home: 5, draw: 2.5, away: 2.5 }),
    completeSnapshot({ provider: "C", home: 1 / 0.3, draw: 2.5, away: 1 / 0.3 }),
  ], 0.1)!;
  assert.deepEqual(consensus.excluded_provider_keys, []);
  assert.ok(consensus.selections.every((row) => row.used_provider_count === 3));
});

test("provider dispersion is the mean selection MAD", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A", home: 1 / 0.5, draw: 1 / 0.25, away: 1 / 0.25 }),
    completeSnapshot({ provider: "B", home: 1 / 0.52, draw: 1 / 0.24, away: 1 / 0.24 }),
    completeSnapshot({ provider: "C", home: 1 / 0.9, draw: 1 / 0.05, away: 1 / 0.05 }),
  ])!;
  close(consensus.provider_dispersion, (0.02 + 0.01 + 0.01) / 3);
});

test("latest complete snapshot is selected once per provider", () => {
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A", timestamp: "2026-01-01T00:00:00Z", home: 2, draw: 4, away: 4 }),
    completeSnapshot({ provider: "A", timestamp: "2026-01-01T00:01:00Z", home: 2.5, draw: 4, away: 1 / 0.35 }),
  ])!;
  assert.equal(consensus.provider_count, 1);
  assert.equal(consensus.observed_from, "2026-01-01T00:01:00.000Z");
  assert.equal(consensus.observed_through, "2026-01-01T00:01:00.000Z");
});

test("incomplete provider snapshots are ignored by consensus", () => {
  const incomplete = buildProviderMarketSnapshots(
    complete1x2({ provider: "B" }).filter((row) => row.selection !== "away"),
  )[0]!;
  const consensus = aggregateProviderProbabilities([
    completeSnapshot({ provider: "A" }),
    incomplete,
  ])!;
  assert.equal(consensus.provider_count, 1);
});

test("consensus returns null when no complete provider exists", () => {
  const incomplete = buildProviderMarketSnapshots(
    complete1x2().filter((row) => row.selection !== "away"),
  )[0]!;
  assert.equal(aggregateProviderProbabilities([incomplete]), null);
});

test("consensus rejects incompatible market snapshots", () => {
  const first = completeSnapshot();
  const second = {
    ...completeSnapshot({ provider: "B" }),
    market_key: "different-market",
  };
  assert.throws(() => aggregateProviderProbabilities([first, second]), TypeError);
});
