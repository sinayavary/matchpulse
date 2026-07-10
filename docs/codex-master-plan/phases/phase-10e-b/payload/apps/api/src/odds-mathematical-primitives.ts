import type {
  NormalizedStoredOddsObservation,
} from "./odds-market-normalization.js";
import type {
  NormalizedOddsMarketType,
  NormalizedOddsSelectionType,
} from "./odds-intelligence-contract.js";

export type SupportedProbabilityMarketType =
  | "match_result_1x2"
  | "total_goals"
  | "both_teams_to_score"
  | "asian_handicap"
  | "next_goal";

export type RequiredProbabilitySelection =
  | "home"
  | "draw"
  | "away"
  | "none"
  | "yes"
  | "no"
  | "over"
  | "under";

export type OddsSnapshotStructuralStatus =
  | "complete"
  | "incomplete"
  | "ambiguous"
  | "unsupported";

export type OddsSnapshotObservation = {
  external_seq: string | null;
  selection: NormalizedOddsSelectionType;
  line: number | null;
  decimal_odds: number;
  implied_probability: number;
  source_timestamp: string | null;
  created_at: string;
};

export type OddsSelectionProbability = {
  selection: RequiredProbabilitySelection;
  line: number | null;
  decimal_odds: number;
  implied_probability: number;
  fair_probability: number;
};

export type OddsCompleteMarketMathematics = {
  implied_probability_sum: number;
  overround: number;
  selections: OddsSelectionProbability[];
};

export type OddsProviderMarketSnapshot = {
  snapshot_key: string;
  fixture_id: string;
  market_key: string;
  market_type: NormalizedOddsMarketType;
  line: number | null;
  provider_key: string | null;
  observed_at: string;
  structural_status: OddsSnapshotStructuralStatus;
  required_selections: RequiredProbabilitySelection[];
  present_selections: NormalizedOddsSelectionType[];
  missing_selections: RequiredProbabilitySelection[];
  unexpected_selections: NormalizedOddsSelectionType[];
  duplicate_selections: NormalizedOddsSelectionType[];
  observations: OddsSnapshotObservation[];
  mathematics: OddsCompleteMarketMathematics | null;
};

export type OddsMarketTimeBucket = {
  bucket_key: string;
  fixture_id: string;
  market_key: string;
  market_type: NormalizedOddsMarketType;
  line: number | null;
  bucket_start: string;
  bucket_end_exclusive: string;
  observed_from: string;
  observed_through: string;
  provider_snapshot_count: number;
  distinct_provider_count: number;
  complete_provider_snapshot_count: number;
  snapshots: OddsProviderMarketSnapshot[];
};

export type RobustOutlierResult = {
  index: number;
  value: number;
  median: number;
  median_absolute_deviation: number;
  modified_z_score: number | null;
  outlier: boolean;
};

export type OddsConsensusSelection = {
  selection: RequiredProbabilitySelection;
  line: number | null;
  consensus_probability: number;
  raw_median_probability: number;
  median_absolute_deviation: number;
  raw_provider_count: number;
  used_provider_count: number;
  outlier_provider_keys: Array<string | null>;
};

export type OddsProviderConsensus = {
  fixture_id: string;
  market_key: string;
  market_type: SupportedProbabilityMarketType;
  line: number | null;
  observed_from: string;
  observed_through: string;
  provider_count: number;
  excluded_provider_keys: Array<string | null>;
  provider_dispersion: number;
  selections: OddsConsensusSelection[];
};

const EPSILON = 1e-12;
const MODIFIED_Z_SCALE = 0.6744897501960817;
const SELECTION_ORDER: readonly NormalizedOddsSelectionType[] = [
  "home",
  "draw",
  "away",
  "none",
  "yes",
  "no",
  "over",
  "under",
  "other",
  "unknown",
];
const MARKET_TYPES = new Set<NormalizedOddsMarketType>([
  "match_result_1x2",
  "double_chance",
  "total_goals",
  "both_teams_to_score",
  "asian_handicap",
  "next_goal",
  "correct_score",
  "unknown",
]);
const SELECTIONS = new Set<NormalizedOddsSelectionType>(SELECTION_ORDER);

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

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNullableText(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return compareText(left, right);
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectionRank(selection: NormalizedOddsSelectionType): number {
  return SELECTION_ORDER.indexOf(selection);
}

function compareSelections(
  left: NormalizedOddsSelectionType,
  right: NormalizedOddsSelectionType,
): number {
  const rankComparison = compareNumbers(
    selectionRank(left),
    selectionRank(right),
  );
  return rankComparison !== 0 ? rankComparison : compareText(left, right);
}

function canonicalLine(line: number | null): number | null {
  if (line === null) return null;
  assertFinite(line, "line");
  return Object.is(line, -0) ? 0 : line;
}

function sameLine(left: number | null, right: number | null): boolean {
  return canonicalLine(left) === canonicalLine(right);
}

function observedAt(observation: NormalizedStoredOddsObservation): string {
  return canonicalIso(
    observation.source_timestamp ?? observation.created_at,
    "observation timestamp",
  );
}

function providerIdentity(providerKey: string | null): string {
  return JSON.stringify(providerKey);
}

function buildSnapshotKey(input: {
  fixture_id: string;
  market_key: string;
  provider_key: string | null;
  observed_at: string;
}): string {
  return JSON.stringify([
    input.fixture_id,
    input.market_key,
    input.provider_key,
    input.observed_at,
  ]);
}

function compareNormalizedObservations(
  left: NormalizedStoredOddsObservation,
  right: NormalizedStoredOddsObservation,
): number {
  return (
    compareText(left.fixture_id, right.fixture_id) ||
    compareText(left.market_key, right.market_key) ||
    compareNullableText(left.provider_key, right.provider_key) ||
    compareText(observedAt(left), observedAt(right)) ||
    compareSelections(left.selection, right.selection) ||
    compareText(left.created_at, right.created_at) ||
    compareNullableText(left.external_seq, right.external_seq) ||
    compareNumbers(left.decimal_odds, right.decimal_odds) ||
    compareNullableText(left.direction, right.direction)
  );
}

function validateNormalizedObservation(
  observation: NormalizedStoredOddsObservation,
): void {
  if (
    observation === null ||
    typeof observation !== "object" ||
    typeof observation.fixture_id !== "string" ||
    observation.fixture_id.trim() === "" ||
    typeof observation.market_key !== "string" ||
    observation.market_key.trim() === ""
  ) {
    throw new TypeError("Normalized odds observation identity is invalid.");
  }

  if (!MARKET_TYPES.has(observation.market_type)) {
    throw new TypeError("Normalized odds market type is invalid.");
  }
  if (!SELECTIONS.has(observation.selection)) {
    throw new TypeError("Normalized odds selection is invalid.");
  }

  decimalOddsToImpliedProbability(observation.decimal_odds);
  canonicalLine(observation.line);
  canonicalIso(observation.created_at, "created_at");
  if (observation.source_timestamp !== null) {
    canonicalIso(observation.source_timestamp, "source_timestamp");
  }
}

function uniqueSelections(
  values: readonly NormalizedOddsSelectionType[],
): NormalizedOddsSelectionType[] {
  return [...new Set(values)].sort(compareSelections);
}

export function getRequiredSelectionsForMarket(
  marketType: NormalizedOddsMarketType,
): RequiredProbabilitySelection[] | null {
  switch (marketType) {
    case "match_result_1x2":
      return ["home", "draw", "away"];
    case "total_goals":
      return ["over", "under"];
    case "both_teams_to_score":
      return ["yes", "no"];
    case "asian_handicap":
      return ["home", "away"];
    case "next_goal":
      return ["home", "none", "away"];
    default:
      return null;
  }
}

export function decimalOddsToImpliedProbability(decimalOdds: number): number {
  if (
    typeof decimalOdds !== "number" ||
    !Number.isFinite(decimalOdds) ||
    decimalOdds <= 1
  ) {
    throw new RangeError(
      "decimalOdds must be finite and greater than 1.",
    );
  }

  return 1 / decimalOdds;
}

export function calculateOverround(decimalOdds: readonly number[]): number {
  if (!Array.isArray(decimalOdds) || decimalOdds.length === 0) {
    throw new TypeError("decimalOdds must contain at least one value.");
  }

  return decimalOdds.reduce(
    (sum, value) => sum + decimalOddsToImpliedProbability(value),
    0,
  ) - 1;
}

export function normalizeImpliedProbabilities<T extends string>(
  values: readonly { key: T; implied_probability: number }[],
): Array<{ key: T; fair_probability: number }> {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError("values must contain at least one probability.");
  }

  const seen = new Set<T>();
  let total = 0;
  for (const value of values) {
    if (seen.has(value.key)) {
      throw new TypeError("Probability keys must be unique.");
    }
    seen.add(value.key);
    assertFinite(value.implied_probability, "implied_probability");
    if (value.implied_probability <= 0) {
      throw new RangeError("implied_probability must be greater than 0.");
    }
    total += value.implied_probability;
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Implied probability total must be positive.");
  }

  return values.map((value) => ({
    key: value.key,
    fair_probability: value.implied_probability / total,
  }));
}

function buildCompleteMathematics(input: {
  observations: readonly NormalizedStoredOddsObservation[];
  requiredSelections: readonly RequiredProbabilitySelection[];
}): OddsCompleteMarketMathematics {
  const selected = input.requiredSelections.map((selection) => {
    const observation = input.observations.find(
      (candidate) => candidate.selection === selection,
    );
    if (observation === undefined) {
      throw new TypeError("Complete market is missing a required selection.");
    }

    return {
      observation,
      selection,
      impliedProbability: decimalOddsToImpliedProbability(
        observation.decimal_odds,
      ),
    };
  });

  const fair = normalizeImpliedProbabilities(
    selected.map((entry) => ({
      key: entry.selection,
      implied_probability: entry.impliedProbability,
    })),
  );
  const fairBySelection = new Map(
    fair.map((entry) => [entry.key, entry.fair_probability]),
  );
  const impliedProbabilitySum = selected.reduce(
    (sum, entry) => sum + entry.impliedProbability,
    0,
  );

  return {
    implied_probability_sum: impliedProbabilitySum,
    overround: impliedProbabilitySum - 1,
    selections: selected.map((entry) => ({
      selection: entry.selection,
      line: canonicalLine(entry.observation.line),
      decimal_odds: entry.observation.decimal_odds,
      implied_probability: entry.impliedProbability,
      fair_probability: fairBySelection.get(entry.selection)!,
    })),
  };
}

export function buildProviderMarketSnapshots(
  input: readonly NormalizedStoredOddsObservation[],
): OddsProviderMarketSnapshot[] {
  if (!Array.isArray(input)) {
    throw new TypeError("input must be an array.");
  }

  const observations = [...input];
  observations.forEach(validateNormalizedObservation);
  observations.sort(compareNormalizedObservations);

  const groups = new Map<string, NormalizedStoredOddsObservation[]>();
  for (const observation of observations) {
    const timestamp = observedAt(observation);
    const key = buildSnapshotKey({
      fixture_id: observation.fixture_id,
      market_key: observation.market_key,
      provider_key: observation.provider_key,
      observed_at: timestamp,
    });
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [observation]);
    } else {
      group.push(observation);
    }
  }

  const snapshots = [...groups.entries()].map(([snapshotKey, rows]) => {
    const first = rows[0]!;
    const timestamp = observedAt(first);
    const marketType = first.market_type;
    const line = canonicalLine(first.line);

    for (const row of rows) {
      if (row.market_type !== marketType) {
        throw new TypeError(
          "A provider market snapshot cannot contain multiple market types.",
        );
      }
      if (!sameLine(row.line, line)) {
        throw new TypeError(
          "A provider market snapshot cannot contain multiple lines.",
        );
      }
    }

    const required = getRequiredSelectionsForMarket(marketType);
    const present = uniqueSelections(rows.map((row) => row.selection));
    const counts = new Map<NormalizedOddsSelectionType, number>();
    for (const row of rows) {
      counts.set(row.selection, (counts.get(row.selection) ?? 0) + 1);
    }

    const duplicateSelections = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([selection]) => selection)
      .sort(compareSelections);
    const missingSelections = required === null
      ? []
      : required.filter((selection) => !counts.has(selection));
    const requiredSet = new Set<NormalizedOddsSelectionType>(required ?? []);
    const unexpectedSelections = required === null
      ? [...present]
      : present.filter((selection) => !requiredSet.has(selection));

    const structuralStatus: OddsSnapshotStructuralStatus =
      required === null
        ? "unsupported"
        : duplicateSelections.length > 0
          ? "ambiguous"
          : missingSelections.length > 0 || unexpectedSelections.length > 0
            ? "incomplete"
            : "complete";

    const mathematics =
      structuralStatus === "complete" && required !== null
        ? buildCompleteMathematics({
            observations: rows,
            requiredSelections: required,
          })
        : null;

    return {
      snapshot_key: snapshotKey,
      fixture_id: first.fixture_id,
      market_key: first.market_key,
      market_type: marketType,
      line,
      provider_key: first.provider_key,
      observed_at: timestamp,
      structural_status: structuralStatus,
      required_selections: required === null ? [] : [...required],
      present_selections: present,
      missing_selections: missingSelections,
      unexpected_selections: unexpectedSelections,
      duplicate_selections: duplicateSelections,
      observations: rows.map((row) => ({
        external_seq: row.external_seq,
        selection: row.selection,
        line: canonicalLine(row.line),
        decimal_odds: row.decimal_odds,
        implied_probability: decimalOddsToImpliedProbability(
          row.decimal_odds,
        ),
        source_timestamp: row.source_timestamp,
        created_at: row.created_at,
      })),
      mathematics,
    };
  });

  return snapshots.sort((left, right) => (
    compareText(left.fixture_id, right.fixture_id) ||
    compareText(left.market_key, right.market_key) ||
    compareText(left.observed_at, right.observed_at) ||
    compareNullableText(left.provider_key, right.provider_key) ||
    compareText(left.snapshot_key, right.snapshot_key)
  ));
}

function ensureCompatibleSnapshots(
  snapshots: readonly OddsProviderMarketSnapshot[],
): {
  fixtureId: string;
  marketKey: string;
  marketType: NormalizedOddsMarketType;
  line: number | null;
} {
  if (snapshots.length === 0) {
    throw new TypeError("snapshots must not be empty.");
  }

  const first = snapshots[0]!;
  for (const snapshot of snapshots) {
    if (
      snapshot.fixture_id !== first.fixture_id ||
      snapshot.market_key !== first.market_key ||
      snapshot.market_type !== first.market_type ||
      !sameLine(snapshot.line, first.line)
    ) {
      throw new TypeError(
        "All snapshots must describe the same fixture and market.",
      );
    }
  }

  return {
    fixtureId: first.fixture_id,
    marketKey: first.market_key,
    marketType: first.market_type,
    line: canonicalLine(first.line),
  };
}

export function groupMarketSnapshotsByTimeWindow(
  snapshots: readonly OddsProviderMarketSnapshot[],
  windowMs: number,
): OddsMarketTimeBucket[] {
  if (!Array.isArray(snapshots)) {
    throw new TypeError("snapshots must be an array.");
  }
  assertPositiveInteger(windowMs, "windowMs");

  const sorted = [...snapshots].sort((left, right) => (
    compareText(left.fixture_id, right.fixture_id) ||
    compareText(left.market_key, right.market_key) ||
    compareText(left.observed_at, right.observed_at) ||
    compareNullableText(left.provider_key, right.provider_key) ||
    compareText(left.snapshot_key, right.snapshot_key)
  ));

  const groups = new Map<string, OddsProviderMarketSnapshot[]>();
  for (const snapshot of sorted) {
    const time = Date.parse(canonicalIso(snapshot.observed_at, "observed_at"));
    const bucketStartMs = Math.floor(time / windowMs) * windowMs;
    const key = JSON.stringify([
      snapshot.fixture_id,
      snapshot.market_key,
      snapshot.market_type,
      canonicalLine(snapshot.line),
      bucketStartMs,
    ]);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [snapshot]);
    } else {
      group.push(snapshot);
    }
  }

  return [...groups.entries()]
    .map(([bucketKey, bucketSnapshots]) => {
      const identity = ensureCompatibleSnapshots(bucketSnapshots);
      const times = bucketSnapshots.map((snapshot) =>
        Date.parse(snapshot.observed_at)
      );
      const bucketStartMs =
        Math.floor(Math.min(...times) / windowMs) * windowMs;
      const providers = new Set(
        bucketSnapshots.map((snapshot) =>
          providerIdentity(snapshot.provider_key)
        ),
      );

      return {
        bucket_key: bucketKey,
        fixture_id: identity.fixtureId,
        market_key: identity.marketKey,
        market_type: identity.marketType,
        line: identity.line,
        bucket_start: new Date(bucketStartMs).toISOString(),
        bucket_end_exclusive: new Date(
          bucketStartMs + windowMs,
        ).toISOString(),
        observed_from: new Date(Math.min(...times)).toISOString(),
        observed_through: new Date(Math.max(...times)).toISOString(),
        provider_snapshot_count: bucketSnapshots.length,
        distinct_provider_count: providers.size,
        complete_provider_snapshot_count: bucketSnapshots.filter(
          (snapshot) => snapshot.structural_status === "complete",
        ).length,
        snapshots: [...bucketSnapshots],
      };
    })
    .sort((left, right) => (
      compareText(left.fixture_id, right.fixture_id) ||
      compareText(left.market_key, right.market_key) ||
      compareText(left.bucket_start, right.bucket_start) ||
      compareText(left.bucket_key, right.bucket_key)
    ));
}

export function median(values: readonly number[]): number {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError("values must contain at least one number.");
  }
  const sorted = [...values];
  sorted.forEach((value) => assertFinite(value, "value"));
  sorted.sort(compareNumbers);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function medianAbsoluteDeviation(
  values: readonly number[],
): number {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

export function detectRobustOutliers(
  values: readonly number[],
  threshold = 3.5,
): RobustOutlierResult[] {
  assertFinite(threshold, "threshold");
  if (threshold <= 0) {
    throw new RangeError("threshold must be greater than 0.");
  }

  const center = median(values);
  const deviation = medianAbsoluteDeviation(values);
  const enoughEvidence = values.length >= 3;

  return values.map((value, index) => {
    assertFinite(value, "value");
    if (!enoughEvidence) {
      return {
        index,
        value,
        median: center,
        median_absolute_deviation: deviation,
        modified_z_score: null,
        outlier: false,
      };
    }

    if (deviation <= EPSILON) {
      return {
        index,
        value,
        median: center,
        median_absolute_deviation: deviation,
        modified_z_score: null,
        outlier: Math.abs(value - center) > EPSILON,
      };
    }

    const modifiedZ = MODIFIED_Z_SCALE * (value - center) / deviation;
    return {
      index,
      value,
      median: center,
      median_absolute_deviation: deviation,
      modified_z_score: modifiedZ,
      outlier: Math.abs(modifiedZ) > threshold,
    };
  });
}

function latestCompleteSnapshotsByProvider(
  snapshots: readonly OddsProviderMarketSnapshot[],
): OddsProviderMarketSnapshot[] {
  const latest = new Map<string, OddsProviderMarketSnapshot>();

  for (const snapshot of snapshots) {
    if (
      snapshot.structural_status !== "complete" ||
      snapshot.mathematics === null
    ) {
      continue;
    }

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

function uniqueNullableProviders(
  values: readonly (string | null)[],
): Array<string | null> {
  const map = new Map<string, string | null>();
  for (const value of values) {
    map.set(providerIdentity(value), value);
  }
  return [...map.values()].sort(compareNullableText);
}

export function aggregateProviderProbabilities(
  snapshots: readonly OddsProviderMarketSnapshot[],
  outlierThreshold = 3.5,
): OddsProviderConsensus | null {
  if (!Array.isArray(snapshots)) {
    throw new TypeError("snapshots must be an array.");
  }
  if (snapshots.length === 0) return null;

  const identity = ensureCompatibleSnapshots(snapshots);
  const required = getRequiredSelectionsForMarket(identity.marketType);
  if (required === null) return null;

  const providers = latestCompleteSnapshotsByProvider(snapshots);
  if (providers.length === 0) return null;

  const rawSelections = required.map((selection) => {
    const entries = providers.map((snapshot) => {
      const probability = snapshot.mathematics!.selections.find(
        (candidate) => candidate.selection === selection,
      );
      if (probability === undefined) {
        throw new TypeError(
          "Complete snapshot mathematics is missing a required selection.",
        );
      }
      return {
        provider_key: snapshot.provider_key,
        probability: probability.fair_probability,
      };
    });

    const outlierResults = detectRobustOutliers(
      entries.map((entry) => entry.probability),
      outlierThreshold,
    );
    const candidateInliers = entries.filter(
      (_, index) => !outlierResults[index]!.outlier,
    );
    const canExcludeOutliers =
      entries.length >= 3 && candidateInliers.length >= 2;
    const used = canExcludeOutliers ? candidateInliers : entries;
    const rawMedian = median(
      used.map((entry) => entry.probability),
    );

    return {
      selection,
      line: identity.line,
      rawMedian,
      medianAbsoluteDeviation: medianAbsoluteDeviation(
        entries.map((entry) => entry.probability),
      ),
      rawProviderCount: entries.length,
      usedProviderCount: used.length,
      outlierProviderKeys: canExcludeOutliers
        ? entries
            .filter((_, index) => outlierResults[index]!.outlier)
            .map((entry) => entry.provider_key)
        : [],
    };
  });

  const normalized = normalizeImpliedProbabilities(
    rawSelections.map((selection) => ({
      key: selection.selection,
      implied_probability: selection.rawMedian,
    })),
  );
  const normalizedBySelection = new Map(
    normalized.map((entry) => [entry.key, entry.fair_probability]),
  );
  const excludedProviders = uniqueNullableProviders(
    rawSelections.flatMap((selection) => selection.outlierProviderKeys),
  );

  return {
    fixture_id: identity.fixtureId,
    market_key: identity.marketKey,
    market_type: identity.marketType as SupportedProbabilityMarketType,
    line: identity.line,
    observed_from: providers
      .map((snapshot) => snapshot.observed_at)
      .sort(compareText)[0]!,
    observed_through: providers
      .map((snapshot) => snapshot.observed_at)
      .sort(compareText)
      .at(-1)!,
    provider_count: providers.length,
    excluded_provider_keys: excludedProviders,
    provider_dispersion:
      rawSelections.reduce(
        (sum, selection) =>
          sum + selection.medianAbsoluteDeviation,
        0,
      ) / rawSelections.length,
    selections: rawSelections.map((selection) => ({
      selection: selection.selection,
      line: selection.line,
      consensus_probability: normalizedBySelection.get(
        selection.selection,
      )!,
      raw_median_probability: selection.rawMedian,
      median_absolute_deviation:
        selection.medianAbsoluteDeviation,
      raw_provider_count: selection.rawProviderCount,
      used_provider_count: selection.usedProviderCount,
      outlier_provider_keys: uniqueNullableProviders(
        selection.outlierProviderKeys,
      ),
    })),
  };
}
