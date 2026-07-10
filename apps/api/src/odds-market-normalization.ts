import type {
  NormalizedOddsMarketType,
  NormalizedOddsSelectionType,
} from "./odds-intelligence-contract.js";

export type StoredOddsObservation = {
  fixture_id: string;
  external_seq: string | null;
  market_id: string;
  market_name: string | null;
  selection_name: string;
  decimal_odds: number;
  previous_decimal_odds: number | null;
  change_percent: number | null;
  direction: string;
  source_timestamp: string | null;
  created_at: string;
};

export type ParsedOddsMarketIdentity = {
  original_market_id: string;
  provider_key: string | null;
  odds_type: string | null;
  period: string | null;
  parameters: string | null;
};

export type NormalizedStoredOddsObservation = {
  fixture_id: string;
  external_seq: string | null;
  provider_key: string | null;
  market_key: string;
  market_type: NormalizedOddsMarketType;
  selection: NormalizedOddsSelectionType;
  line: number | null;
  decimal_odds: number;
  previous_decimal_odds: number | null;
  change_percent: number | null;
  direction: string;
  source_timestamp: string | null;
  created_at: string;
};

const MARKET_ALIASES: ReadonlyArray<{
  type: NormalizedOddsMarketType;
  aliases: ReadonlySet<string>;
}> = [
  {
    type: "match_result_1x2",
    aliases: new Set([
      "1x2",
      "match result",
      "full time result",
      "moneyline three way",
      "three way moneyline",
    ]),
  },
  {
    type: "double_chance",
    aliases: new Set([
      "double chance",
      "1x",
      "1 x",
      "x2",
      "x 2",
      "12",
      "1 2",
    ]),
  },
  {
    type: "total_goals",
    aliases: new Set([
      "total goals",
      "goals over under",
      "over under",
      "goal total",
    ]),
  },
  {
    type: "both_teams_to_score",
    aliases: new Set([
      "both teams to score",
      "btts",
      "gg ng",
      "ggng",
    ]),
  },
  {
    type: "asian_handicap",
    aliases: new Set([
      "asian handicap",
      "handicap asian",
    ]),
  },
  {
    type: "next_goal",
    aliases: new Set([
      "next goal",
      "team to score next",
      "next team to score",
    ]),
  },
  {
    type: "correct_score",
    aliases: new Set([
      "correct score",
      "exact score",
    ]),
  },
];

function normalizeAliasText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyComponent(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\/]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*\|\s*/g, "|")
    .trim();
}

function canonicalMarketIdSegment(segment: string): string | null {
  const trimmed = segment.trim();
  if (trimmed === "") return null;

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex < 0) return trimmed;

  const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
  const value = trimmed.slice(colonIndex + 1).trim();

  if (key === "" || value === "") return trimmed;
  return `${key}:${value}`;
}

function compareDeterministically(left: string, right: string): number {
  const normalizedLeft = normalizeKeyComponent(left);
  const normalizedRight = normalizeKeyComponent(right);

  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
}

function chooseDuplicateValue(values: string[]): string | null {
  if (values.length === 0) return null;
  return [...values].sort(compareDeterministically).at(-1) ?? null;
}

function stripSingleMarketLine(value: string): string {
  if (/\b1\s*x\s*2\b/i.test(value)) return normalizeAliasText(value);

  const normalized = normalizeAliasText(value);
  const withoutNumbers = normalized
    .replace(/(?:^|\s)[+-]?\d+(?:\.\d+)?(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutNumbers;
}

function findMarketAlias(value: string): NormalizedOddsMarketType | null {
  const normalized = normalizeAliasText(value);
  const withoutLine = stripSingleMarketLine(value);

  for (const mapping of MARKET_ALIASES) {
    if (
      mapping.aliases.has(normalized) ||
      mapping.aliases.has(withoutLine)
    ) {
      return mapping.type;
    }
  }

  return null;
}

function isCorrectScoreValue(value: string): boolean {
  return /^\s*\d+\s*[-:]\s*\d+\s*$/.test(value);
}

function isTeamSelectionAlias(value: string): boolean {
  const normalized = normalizeAliasText(value);

  return [
    "1",
    "2",
    "home",
    "away",
    "home team",
    "away team",
    "team1",
    "team 1",
    "team2",
    "team 2",
    "participant1",
    "participant 1",
    "participant2",
    "participant 2",
  ].includes(normalized);
}

function extractDistinctNumbers(value: string): number[] {
  const trimmed = value.trim();
  if (trimmed === "") return [];

  if (/\b1\s*x\s*2\b/i.test(trimmed)) return [];
  if (isCorrectScoreValue(trimmed)) return [];

  if (
    /^(?:team|participant)\s*[-_]?\s*[12]$/i.test(trimmed)
  ) {
    return [];
  }

  const matches = trimmed.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? [];
  const values = matches
    .map(Number)
    .filter((number) => Number.isFinite(number));

  return [...new Set(values)];
}

function parseSingleLineCandidate(value: string | null): {
  found: boolean;
  ambiguous: boolean;
  value: number | null;
} {
  if (value === null || value.trim() === "") {
    return { found: false, ambiguous: false, value: null };
  }

  const values = extractDistinctNumbers(value);

  if (values.length === 0) {
    return { found: false, ambiguous: false, value: null };
  }

  if (values.length > 1) {
    return { found: true, ambiguous: true, value: null };
  }

  return { found: true, ambiguous: false, value: values[0] };
}

function canonicalTimestamp(
  value: string | null,
  name: string,
  required: boolean,
): string | null {
  if (value === null) {
    if (required) {
      throw new TypeError(`${name} must be a valid timestamp.`);
    }

    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a valid timestamp.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${name} must be a valid timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

export function parseStoredOddsMarketId(
  marketId: string,
): ParsedOddsMarketIdentity {
  if (typeof marketId !== "string" || marketId.trim() === "") {
    throw new TypeError("market_id must be non-empty.");
  }

  const canonicalSegments = marketId
    .split("|")
    .map(canonicalMarketIdSegment)
    .filter((segment): segment is string => segment !== null)
    .sort(compareDeterministically);

  const values = {
    bookmaker: [] as string[],
    type: [] as string[],
    period: [] as string[],
    parameters: [] as string[],
  };

  for (const segment of canonicalSegments) {
    const colonIndex = segment.indexOf(":");
    if (colonIndex < 0) continue;

    const key = segment.slice(0, colonIndex).trim().toLowerCase();
    const value = segment.slice(colonIndex + 1).trim();
    if (value === "") continue;

    if (key === "bookmaker") values.bookmaker.push(value);
    if (key === "type") values.type.push(value);
    if (key === "period") values.period.push(value);
    if (key === "parameters") values.parameters.push(value);
  }

  return {
    original_market_id: canonicalSegments.join("|"),
    provider_key: chooseDuplicateValue(values.bookmaker),
    odds_type: chooseDuplicateValue(values.type),
    period: chooseDuplicateValue(values.period),
    parameters: chooseDuplicateValue(values.parameters),
  };
}

export function normalizeOddsMarketType(input: {
  market_name: string | null;
  parsed_identity: ParsedOddsMarketIdentity;
}): NormalizedOddsMarketType {
  if (input.market_name !== null) {
    const marketNameType = findMarketAlias(input.market_name);
    if (marketNameType !== null) return marketNameType;
  }

  if (input.parsed_identity.odds_type !== null) {
    const encodedType = findMarketAlias(input.parsed_identity.odds_type);
    if (encodedType !== null) return encodedType;
  }

  return "unknown";
}

export function normalizeOddsSelection(
  selectionName: string,
): NormalizedOddsSelectionType {
  if (
    typeof selectionName !== "string" ||
    selectionName.trim() === ""
  ) {
    throw new TypeError("selection_name must be non-empty.");
  }

  const raw = selectionName.trim();
  if (isCorrectScoreValue(raw)) return "other";

  const normalized = normalizeAliasText(raw);

  if (
    ["1", "home", "home team", "team1", "team 1", "participant1", "participant 1"]
      .includes(normalized)
  ) {
    return "home";
  }

  if (["x", "draw", "tie"].includes(normalized)) return "draw";

  if (
    ["2", "away", "away team", "team2", "team 2", "participant2", "participant 2"]
      .includes(normalized)
  ) {
    return "away";
  }

  if (["yes", "y"].includes(normalized)) return "yes";
  if (["no", "n"].includes(normalized)) return "no";
  if (["over", "o"].includes(normalized)) return "over";
  if (["under", "u"].includes(normalized)) return "under";
  if (["none", "no goal", "nobody"].includes(normalized)) return "none";

  return "unknown";
}

export function parseOddsMarketLine(input: {
  market_name: string | null;
  selection_name: string;
  parameters: string | null;
}): number | null {
  if (isCorrectScoreValue(input.selection_name)) return null;

  if (
    input.market_name !== null &&
    findMarketAlias(input.market_name) === "match_result_1x2"
  ) {
    return null;
  }

  const parameterCandidate = parseSingleLineCandidate(input.parameters);
  if (parameterCandidate.ambiguous) return null;
  if (parameterCandidate.found) return parameterCandidate.value;

  if (!isTeamSelectionAlias(input.selection_name)) {
    const selectionCandidate = parseSingleLineCandidate(
      input.selection_name,
    );

    if (selectionCandidate.ambiguous) return null;
    if (selectionCandidate.found) return selectionCandidate.value;
  }

  const marketCandidate = parseSingleLineCandidate(input.market_name);
  if (marketCandidate.ambiguous) return null;
  if (marketCandidate.found) return marketCandidate.value;

  return null;
}

export function buildCanonicalOddsMarketKey(input: {
  market_type: NormalizedOddsMarketType;
  period: string | null;
  line: number | null;
  parameters: string | null;
}): string {
  const parts: string[] = [input.market_type];

  if (input.period !== null && input.period.trim() !== "") {
    parts.push(`period:${normalizeKeyComponent(input.period)}`);
  }

  if (input.line !== null) {
    if (!Number.isFinite(input.line)) {
      throw new TypeError("line must be finite or null.");
    }

    parts.push(`line:${String(input.line)}`);
  }

  if (
    input.line === null &&
    input.parameters !== null &&
    input.parameters.trim() !== ""
  ) {
    parts.push(`params:${normalizeKeyComponent(input.parameters)}`);
  }

  return parts.join("|");
}

export function normalizeStoredOddsObservation(
  observation: StoredOddsObservation,
): NormalizedStoredOddsObservation {
  if (
    typeof observation.fixture_id !== "string" ||
    observation.fixture_id.trim() === ""
  ) {
    throw new TypeError("fixture_id must be non-empty.");
  }

  if (
    typeof observation.market_id !== "string" ||
    observation.market_id.trim() === ""
  ) {
    throw new TypeError("market_id must be non-empty.");
  }

  if (
    typeof observation.selection_name !== "string" ||
    observation.selection_name.trim() === ""
  ) {
    throw new TypeError("selection_name must be non-empty.");
  }

  if (
    typeof observation.decimal_odds !== "number" ||
    !Number.isFinite(observation.decimal_odds) ||
    observation.decimal_odds <= 1
  ) {
    throw new TypeError(
      "decimal_odds must be finite and greater than 1.",
    );
  }

  if (
    observation.previous_decimal_odds !== null &&
    (
      typeof observation.previous_decimal_odds !== "number" ||
      !Number.isFinite(observation.previous_decimal_odds) ||
      observation.previous_decimal_odds <= 1
    )
  ) {
    throw new TypeError(
      "previous_decimal_odds must be finite and greater than 1 or null.",
    );
  }

  if (
    observation.change_percent !== null &&
    (
      typeof observation.change_percent !== "number" ||
      !Number.isFinite(observation.change_percent)
    )
  ) {
    throw new TypeError("change_percent must be finite or null.");
  }

  const parsedIdentity = parseStoredOddsMarketId(observation.market_id);
  const marketType = normalizeOddsMarketType({
    market_name: observation.market_name,
    parsed_identity: parsedIdentity,
  });

  const line = parseOddsMarketLine({
    market_name: observation.market_name,
    selection_name: observation.selection_name,
    parameters: parsedIdentity.parameters,
  });

  return {
    fixture_id: observation.fixture_id.trim(),
    external_seq:
      observation.external_seq === null ||
      observation.external_seq.trim() === ""
        ? null
        : observation.external_seq.trim(),
    provider_key: parsedIdentity.provider_key,
    market_key: buildCanonicalOddsMarketKey({
      market_type: marketType,
      period: parsedIdentity.period,
      line,
      parameters: parsedIdentity.parameters,
    }),
    market_type: marketType,
    selection: normalizeOddsSelection(observation.selection_name),
    line,
    decimal_odds: observation.decimal_odds,
    previous_decimal_odds: observation.previous_decimal_odds,
    change_percent: observation.change_percent,
    direction:
      typeof observation.direction === "string" &&
      observation.direction.trim() !== ""
        ? observation.direction.trim().toLowerCase()
        : "unknown",
    source_timestamp: canonicalTimestamp(
      observation.source_timestamp,
      "source_timestamp",
      false,
    ),
    created_at: canonicalTimestamp(
      observation.created_at,
      "created_at",
      true,
    )!,
  };
}
