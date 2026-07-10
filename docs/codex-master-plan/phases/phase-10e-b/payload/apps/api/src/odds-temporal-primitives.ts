export type OddsProbabilityTimePoint = {
  observed_at: string;
  probability: number;
};

export type OddsTemporalMovementOptions = {
  as_of?: string;
  anchor_tolerance_ms: number;
  max_velocity_gap_ms: number;
};

export type OddsTemporalMovement = {
  latest_observed_at: string;
  latest_probability: number;
  point_count: number;
  probability_change_1m: number | null;
  probability_change_5m: number | null;
  movement_velocity_per_minute: number | null;
  movement_acceleration_per_minute_squared: number | null;
};

export type OddsVolatilityMetrics = {
  observation_count: number;
  change_count: number;
  mean_probability: number;
  population_standard_deviation: number;
  mean_absolute_change: number;
  root_mean_square_change: number;
  max_absolute_change: number;
};

export type OddsProbabilityJump = {
  from_observed_at: string;
  to_observed_at: string;
  from_probability: number;
  to_probability: number;
  change: number;
  absolute_change: number;
  direction: "up" | "down";
};

const EPSILON = 1e-12;

function assertFinite(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite.`);
  }
}

function assertProbability(
  value: unknown,
  name: string,
): asserts value is number {
  assertFinite(value, name);
  if (value < 0 || value > 1) {
    throw new RangeError(`${name} must be in 0..1.`);
  }
}

function assertPositiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
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

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeProbabilityTimePoints(
  input: readonly OddsProbabilityTimePoint[],
  asOf?: string,
): Array<OddsProbabilityTimePoint & { time_ms: number }> {
  if (!Array.isArray(input)) {
    throw new TypeError("input must be an array.");
  }

  const asOfMs = asOf === undefined
    ? Number.POSITIVE_INFINITY
    : Date.parse(canonicalIso(asOf, "as_of"));
  const sorted = input
    .map((point) => {
      const observedAtValue = canonicalIso(
        point.observed_at,
        "observed_at",
      );
      assertProbability(point.probability, "probability");
      return {
        observed_at: observedAtValue,
        probability: point.probability,
        time_ms: Date.parse(observedAtValue),
      };
    })
    .filter((point) => point.time_ms <= asOfMs)
    .sort((left, right) => (
      compareNumbers(left.time_ms, right.time_ms) ||
      compareNumbers(left.probability, right.probability)
    ));

  const deduplicated: Array<
    OddsProbabilityTimePoint & { time_ms: number }
  > = [];
  for (const point of sorted) {
    const previous = deduplicated.at(-1);
    if (previous?.time_ms === point.time_ms) {
      if (
        Math.abs(previous.probability - point.probability) > EPSILON
      ) {
        throw new TypeError(
          "Conflicting probabilities share the same timestamp.",
        );
      }
      continue;
    }
    deduplicated.push(point);
  }

  return deduplicated;
}

function probabilityChangeAtWindow(
  points: readonly (OddsProbabilityTimePoint & { time_ms: number })[],
  windowMs: number,
  anchorToleranceMs: number,
): number | null {
  const latest = points.at(-1);
  if (latest === undefined) return null;

  const target = latest.time_ms - windowMs;
  let anchor:
    | (OddsProbabilityTimePoint & { time_ms: number })
    | undefined;
  for (const point of points) {
    if (point.time_ms <= target) anchor = point;
    else break;
  }

  if (
    anchor === undefined ||
    target - anchor.time_ms > anchorToleranceMs
  ) {
    return null;
  }

  return latest.probability - anchor.probability;
}

export function calculateTemporalMovement(
  input: readonly OddsProbabilityTimePoint[],
  options: OddsTemporalMovementOptions,
): OddsTemporalMovement | null {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options are required.");
  }
  if (
    typeof options.anchor_tolerance_ms !== "number" ||
    !Number.isInteger(options.anchor_tolerance_ms) ||
    options.anchor_tolerance_ms < 0
  ) {
    throw new RangeError(
      "anchor_tolerance_ms must be a non-negative integer.",
    );
  }
  assertPositiveInteger(
    options.max_velocity_gap_ms,
    "max_velocity_gap_ms",
  );

  const points = normalizeProbabilityTimePoints(
    input,
    options.as_of,
  );
  const latest = points.at(-1);
  if (latest === undefined) return null;

  let velocity: number | null = null;
  let acceleration: number | null = null;
  const previous = points.at(-2);
  if (previous !== undefined) {
    const gapMs = latest.time_ms - previous.time_ms;
    if (gapMs > 0 && gapMs <= options.max_velocity_gap_ms) {
      const gapMinutes = gapMs / 60_000;
      velocity =
        (latest.probability - previous.probability) / gapMinutes;

      const prior = points.at(-3);
      if (prior !== undefined) {
        const priorGapMs = previous.time_ms - prior.time_ms;
        if (
          priorGapMs > 0 &&
          priorGapMs <= options.max_velocity_gap_ms
        ) {
          const priorVelocity =
            (previous.probability - prior.probability) /
            (priorGapMs / 60_000);
          const currentMidpoint =
            (latest.time_ms + previous.time_ms) / 2;
          const priorMidpoint =
            (previous.time_ms + prior.time_ms) / 2;
          const midpointGapMinutes =
            (currentMidpoint - priorMidpoint) / 60_000;
          acceleration =
            (velocity - priorVelocity) / midpointGapMinutes;
        }
      }
    }
  }

  return {
    latest_observed_at: latest.observed_at,
    latest_probability: latest.probability,
    point_count: points.length,
    probability_change_1m: probabilityChangeAtWindow(
      points,
      60_000,
      options.anchor_tolerance_ms,
    ),
    probability_change_5m: probabilityChangeAtWindow(
      points,
      300_000,
      options.anchor_tolerance_ms,
    ),
    movement_velocity_per_minute: velocity,
    movement_acceleration_per_minute_squared: acceleration,
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) /
    values.length;
}

export function calculateVolatilityMetrics(
  input: readonly OddsProbabilityTimePoint[],
): OddsVolatilityMetrics {
  const points = normalizeProbabilityTimePoints(input);
  if (points.length === 0) {
    throw new TypeError("input must contain at least one point.");
  }

  const probabilities = points.map((point) => point.probability);
  const average = mean(probabilities);
  const variance = mean(
    probabilities.map((probability) =>
      (probability - average) ** 2
    ),
  );
  const changes = probabilities
    .slice(1)
    .map((probability, index) =>
      probability - probabilities[index]!
    );
  const absoluteChanges = changes.map(Math.abs);

  return {
    observation_count: probabilities.length,
    change_count: changes.length,
    mean_probability: average,
    population_standard_deviation: Math.sqrt(variance),
    mean_absolute_change: mean(absoluteChanges),
    root_mean_square_change: changes.length === 0
      ? 0
      : Math.sqrt(mean(changes.map((change) => change ** 2))),
    max_absolute_change:
      absoluteChanges.length === 0
        ? 0
        : Math.max(...absoluteChanges),
  };
}

export function detectProbabilityJumps(
  input: readonly OddsProbabilityTimePoint[],
  minimumAbsoluteChange: number,
): OddsProbabilityJump[] {
  assertFinite(minimumAbsoluteChange, "minimumAbsoluteChange");
  if (minimumAbsoluteChange <= 0 || minimumAbsoluteChange > 1) {
    throw new RangeError(
      "minimumAbsoluteChange must be greater than 0 and at most 1.",
    );
  }

  const points = normalizeProbabilityTimePoints(input);
  const jumps: OddsProbabilityJump[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const change = current.probability - previous.probability;
    const absoluteChange = Math.abs(change);
    if (absoluteChange + EPSILON < minimumAbsoluteChange) continue;

    jumps.push({
      from_observed_at: previous.observed_at,
      to_observed_at: current.observed_at,
      from_probability: previous.probability,
      to_probability: current.probability,
      change,
      absolute_change: absoluteChange,
      direction: change > 0 ? "up" : "down",
    });
  }

  return jumps;
}
