import assert from "node:assert/strict";
import test from "node:test";
import {
  assessStoredOddsReliability,
  type OddsReliabilityAssessment
} from "./odds-reliability-foundation.js";
import {
  PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES,
  assertNoForbiddenProductIntelligenceFields
} from "./product-intelligence-contract.js";

const REFERENCE_TIME = new Date("2026-07-09T12:00:00.000Z");

function makeRows(options: {
  count: number;
  marketCount: number;
  sourceTimestamp?: string | null;
  providerId?: string | null;
}): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < options.count; index += 1) {
    rows.push({
      market_id: `market-${(index % options.marketCount) + 1}`,
      selection_name: `selection-${index + 1}`,
      source_timestamp: options.sourceTimestamp ?? "2026-07-09T11:30:00.000Z",
      ...(options.providerId === undefined ? {} : { provider_id: options.providerId })
    });
  }
  return rows;
}

function collectObjectKeys(value: unknown, seen = new WeakSet<object>()): string[] {
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item, seen));
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue, seen)
  ]);
}

test("no stored odds returns unavailable", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: [],
    reference_time: REFERENCE_TIME
  });

  assert.equal(assessment.status, "unavailable");
  assert.equal(assessment.snapshot_count, 0);
  assert.equal(assessment.market_count, 0);
  assert.equal(assessment.provider_count, 0);
  assert.equal(assessment.latest_timestamp, null);
  assert.ok(assessment.limitations.length > 0);
  assert.equal(assessment.signals[0]?.category, "MARKET_DATA_AVAILABILITY");
});

test("stored odds with minimal data returns limited", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 1,
      marketCount: 1,
      sourceTimestamp: "2026-07-09T11:30:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });

  assert.equal(assessment.status, "limited");
  assert.equal(assessment.snapshot_count, 1);
  assert.equal(assessment.market_count, 1);
  assert.equal(assessment.provider_count, 1);
  assert.equal(assessment.latest_timestamp, "2026-07-09T11:30:00.000Z");
});

test("enough mapped rows can be available or conservative limited", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });

  assert.ok(["available", "limited"].includes(assessment.status));
  assert.equal(assessment.snapshot_count, 10);
  assert.equal(assessment.market_count, 5);
  assert.equal(assessment.latest_timestamp, "2026-07-09T11:45:00.000Z");
});

test("single-source/provider case includes a source-diversity limitation", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z",
      providerId: "provider-a"
    }),
    reference_time: REFERENCE_TIME
  });

  assert.ok(
    assessment.limitations.some((limitation) =>
      limitation.toLowerCase().includes("limited source diversity")
    ),
    assessment.limitations.join(" | ")
  );
});

test("freshness limitations appear when timestamp is stale or missing", () => {
  const staleAssessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-01T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });
  const missingAssessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: [{
      market_id: "market-1",
      selection_name: "selection-1",
      source_timestamp: null
    }],
    reference_time: REFERENCE_TIME
  });

  assert.ok(
    staleAssessment.limitations.some((limitation) =>
      limitation.toLowerCase().includes("freshness window")
    )
  );
  assert.ok(
    missingAssessment.limitations.some((limitation) =>
      limitation.toLowerCase().includes("freshness checks")
    )
  );
});

test("final assessment does not include forbidden fields", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });

  assert.doesNotThrow(() => assertNoForbiddenProductIntelligenceFields(assessment));
});

test("signals use only approved product intelligence categories", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });

  const categories = new Set(assessment.signals.map((signal) => signal.category));
  for (const category of categories) {
    assert.ok(PRODUCT_INTELLIGENCE_ALLOWED_CATEGORIES.includes(category));
  }
});

test("no raw payload or secret material leaks into the assessment", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: [{
      market_id: "market-1",
      selection_name: "selection-1",
      source_timestamp: "2026-07-09T11:45:00.000Z",
      raw_payload: "must-not-escape",
      api_secret: "must-not-escape"
    } as never],
    reference_time: REFERENCE_TIME
  });
  const serialized = JSON.stringify(assessment);

  assert.equal(serialized.includes("must-not-escape"), false);
  assert.equal(serialized.includes("api_secret"), false);
  assert.equal(serialized.includes("raw_payload"), false);
});

test("no prediction probability betting EV edge or winner fields are present", () => {
  const assessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });
  const forbidden = new Set([
    "prediction",
    "probability",
    "confidence",
    "winner",
    "edge",
    "expected_value",
    "recommended_bet",
    "bet",
    "wager",
    "stake",
    "profit",
    "payout",
    "wallet",
    "deposit"
  ]);

  for (const key of collectObjectKeys(assessment).map((value) => value.toLowerCase())) {
    assert.equal(forbidden.has(key), false, `unexpected field key: ${key}`);
  }
});

test("assessment output stays structurally small and safe", () => {
  const assessment: OddsReliabilityAssessment = assessStoredOddsReliability({
    fixture_id: "17588223",
    odds_rows: makeRows({
      count: 10,
      marketCount: 5,
      sourceTimestamp: "2026-07-09T11:45:00.000Z"
    }),
    reference_time: REFERENCE_TIME
  });

  assert.deepEqual(Object.keys(assessment).sort(), [
    "fixture_id",
    "latest_timestamp",
    "limitations",
    "market_count",
    "provider_count",
    "safe_scope_note",
    "signals",
    "snapshot_count",
    "source",
    "status"
  ]);
});
