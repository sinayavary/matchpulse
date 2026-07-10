import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTemporalMovement,
  calculateVolatilityMetrics,
  detectProbabilityJumps,
  type OddsProbabilityTimePoint,
} from "./odds-temporal-primitives.js";

const TOLERANCE = 1e-12;

function close(actual: number, expected: number, tolerance = TOLERANCE): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`,
  );
}

function point(
  observed_at: string,
  probability: number,
): OddsProbabilityTimePoint {
  return { observed_at, probability };
}


test("empty temporal series returns null movement", () => {
  assert.equal(calculateTemporalMovement([], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  }), null);
});

test("temporal series rejects invalid timestamps", () => {
  assert.throws(() => calculateTemporalMovement([
    point("invalid", 0.5),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  }), TypeError);
});

test("temporal series rejects probabilities outside the unit interval", () => {
  assert.throws(() => calculateTemporalMovement([
    point("2026-01-01T00:00:00Z", 1.1),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  }), RangeError);
});

test("one-minute and five-minute changes use observations at or before anchors", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:04:00Z", 0.55),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 120_000,
  })!;
  close(movement.probability_change_1m!, 0.05);
  close(movement.probability_change_5m!, 0.2);
});

test("anchor outside tolerance produces no window change", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:03:00Z", 0.5),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 30_000,
    max_velocity_gap_ms: 180_000,
  })!;
  assert.equal(movement.probability_change_1m, null);
});

test("as-of filtering prevents future probability leakage", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:03:00Z", 0.45),
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:05:00Z", 0.9),
  ], {
    as_of: "2026-01-01T00:04:30Z",
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 120_000,
  })!;
  assert.equal(movement.latest_observed_at, "2026-01-01T00:04:00.000Z");
  close(movement.latest_probability, 0.5);
  assert.equal(movement.point_count, 2);
});

test("movement velocity is probability change per minute", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  })!;
  close(movement.movement_velocity_per_minute!, 0.1);
});

test("movement acceleration uses consecutive interval midpoints", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:03:00Z", 0.45),
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  })!;
  close(movement.movement_acceleration_per_minute_squared!, 0.05);
});

test("identical same-timestamp points are deduplicated", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  })!;
  assert.equal(movement.point_count, 2);
});

test("conflicting same-timestamp points are rejected", () => {
  assert.throws(() => calculateTemporalMovement([
    point("2026-01-01T00:04:00Z", 0.5),
    point("2026-01-01T00:04:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  }), TypeError);
});

test("velocity and acceleration are unavailable across oversized gaps", () => {
  const movement = calculateTemporalMovement([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:05:00Z", 0.6),
  ], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 60_000,
  })!;
  assert.equal(movement.movement_velocity_per_minute, null);
  assert.equal(movement.movement_acceleration_per_minute_squared, null);
});

test("movement options enforce explicit gap policies", () => {
  assert.throws(() => calculateTemporalMovement([], {
    anchor_tolerance_ms: -1,
    max_velocity_gap_ms: 60_000,
  }), RangeError);
  assert.throws(() => calculateTemporalMovement([], {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 0,
  }), RangeError);
});

test("constant probability has zero volatility", () => {
  const metrics = calculateVolatilityMetrics([
    point("2026-01-01T00:00:00Z", 0.5),
    point("2026-01-01T00:01:00Z", 0.5),
    point("2026-01-01T00:02:00Z", 0.5),
  ]);
  close(metrics.population_standard_deviation, 0);
  close(metrics.mean_absolute_change, 0);
  close(metrics.root_mean_square_change, 0);
  close(metrics.max_absolute_change, 0);
});

test("volatility metrics use population standard deviation", () => {
  const metrics = calculateVolatilityMetrics([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:01:00Z", 0.5),
    point("2026-01-01T00:02:00Z", 0.6),
  ]);
  close(metrics.mean_probability, 0.5);
  close(metrics.population_standard_deviation, Math.sqrt(0.02 / 3));
  close(metrics.mean_absolute_change, 0.1);
  close(metrics.root_mean_square_change, 0.1);
  close(metrics.max_absolute_change, 0.1);
});

test("single probability point has zero change metrics", () => {
  const metrics = calculateVolatilityMetrics([
    point("2026-01-01T00:00:00Z", 0.4),
  ]);
  assert.equal(metrics.observation_count, 1);
  assert.equal(metrics.change_count, 0);
  close(metrics.mean_absolute_change, 0);
  close(metrics.root_mean_square_change, 0);
  close(metrics.max_absolute_change, 0);
});

test("volatility metrics reject an empty series", () => {
  assert.throws(() => calculateVolatilityMetrics([]), TypeError);
});

test("probability jump detection returns exact direction and magnitude", () => {
  const jumps = detectProbabilityJumps([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:01:00Z", 0.52),
    point("2026-01-01T00:02:00Z", 0.45),
  ], 0.1);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0]!.direction, "up");
  close(jumps[0]!.change, 0.12);
  close(jumps[0]!.absolute_change, 0.12);
});

test("probability jump detection includes an exact threshold match", () => {
  const jumps = detectProbabilityJumps([
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:01:00Z", 0.5),
  ], 0.1);
  assert.equal(jumps.length, 1);
});

test("probability jump threshold must be in the open-closed unit interval", () => {
  assert.throws(() => detectProbabilityJumps([], 0), RangeError);
  assert.throws(() => detectProbabilityJumps([], 1.1), RangeError);
});

test("temporal and volatility calculations are input-order invariant", () => {
  const points = [
    point("2026-01-01T00:00:00Z", 0.4),
    point("2026-01-01T00:04:00Z", 0.55),
    point("2026-01-01T00:05:00Z", 0.6),
  ];
  const options = {
    anchor_tolerance_ms: 0,
    max_velocity_gap_ms: 120_000,
  };
  assert.deepEqual(
    calculateTemporalMovement(points, options),
    calculateTemporalMovement([...points].reverse(), options),
  );
  assert.deepEqual(
    calculateVolatilityMetrics(points),
    calculateVolatilityMetrics([...points].reverse()),
  );
});
