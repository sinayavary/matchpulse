import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSafeOddsRawDiagnostics,
  discoverTxlineOddsAvailabilityWindow,
  normalizeDiscoveryWindowInput
} from "./txline-odds-discovery-window.js";

const normalizedFixture = {
  fixture_id: "fixture-1",
  home_team: "Home",
  away_team: "Away",
  start_time_utc: "2026-07-05T18:00:00.000Z"
};

function discoveryDependencies(rawOdds: unknown) {
  return {
    fetchFixtures: async () => [{}],
    fetchOdds: async () => rawOdds,
    normalizeFixture: () => normalizedFixture,
    wait: async () => undefined
  };
}

test("normalizeDiscoveryWindowInput caps the day range safely", () => {
  const input = normalizeDiscoveryWindowInput({
    startEpochDayFrom: 21000,
    startEpochDayTo: 22000
  });

  assert.equal(input.startEpochDayFrom, 21000);
  assert.equal(input.startEpochDayTo, 21030);
});

test("normalizeDiscoveryWindowInput caps limitPerDay safely", () => {
  assert.equal(normalizeDiscoveryWindowInput({ limitPerDay: 999 }).limitPerDay, 20);
  assert.equal(normalizeDiscoveryWindowInput({ limitPerDay: 0 }).limitPerDay, 10);
});

test("buildSafeOddsRawDiagnostics handles null", () => {
  assert.deepEqual(buildSafeOddsRawDiagnostics(null), {
    raw_response_type: "null",
    raw_items_count: 0,
    first_item_keys: [],
    has_prices_array: false,
    prices_length: null,
    has_price_names_array: false,
    price_names_length: null,
    has_bookmaker: false,
    has_super_odds_type: false,
    has_message_id: false,
    has_ts: false
  });
});

test("buildSafeOddsRawDiagnostics handles an array payload", () => {
  const diagnostics = buildSafeOddsRawDiagnostics([{
    prices: [1.5, 2.5],
    priceNames: ["home", "away"],
    bookmaker: "book",
    superOddsType: "winner",
    messageId: "message",
    ts: 1
  }]);

  assert.equal(diagnostics.raw_response_type, "array");
  assert.equal(diagnostics.raw_items_count, 1);
  assert.equal(diagnostics.prices_length, 2);
  assert.equal(diagnostics.price_names_length, 2);
  assert.equal(diagnostics.has_bookmaker, true);
  assert.equal(diagnostics.has_super_odds_type, true);
  assert.equal(diagnostics.has_message_id, true);
  assert.equal(diagnostics.has_ts, true);
});

test("buildSafeOddsRawDiagnostics recognizes PascalCase TxLINE fields", () => {
  const diagnostics = buildSafeOddsRawDiagnostics([{
    Prices: [1.5, 2.5],
    PriceNames: ["home", "away"],
    Bookmaker: "pascal-book",
    SuperOddsType: "winner",
    MessageId: "pascal-message",
    Ts: 1781226000000
  }]);

  assert.equal(diagnostics.has_prices_array, true);
  assert.equal(diagnostics.prices_length, 2);
  assert.equal(diagnostics.has_price_names_array, true);
  assert.equal(diagnostics.price_names_length, 2);
  assert.equal(diagnostics.has_bookmaker, true);
  assert.equal(diagnostics.has_super_odds_type, true);
  assert.equal(diagnostics.has_message_id, true);
  assert.equal(diagnostics.has_ts, true);
});

test("PascalCase diagnostics do not include raw payload values", () => {
  const diagnostics = buildSafeOddsRawDiagnostics({
    Prices: [987.654],
    PriceNames: ["do-not-leak-selection"],
    Bookmaker: "do-not-leak-bookmaker",
    MessageId: "do-not-leak-message"
  });
  const serialized = JSON.stringify(diagnostics);

  assert.equal(serialized.includes("987.654"), false);
  assert.equal(serialized.includes("do-not-leak"), false);
});

test("buildSafeOddsRawDiagnostics handles an object payload", () => {
  const diagnostics = buildSafeOddsRawDiagnostics({ prices: [], priceNames: [] });

  assert.equal(diagnostics.raw_response_type, "object");
  assert.equal(diagnostics.raw_items_count, 1);
  assert.equal(diagnostics.has_prices_array, true);
  assert.equal(diagnostics.prices_length, 0);
});

test("diagnostics do not include raw payload values", () => {
  const diagnostics = buildSafeOddsRawDiagnostics({
    prices: [123.456],
    messageId: "do-not-leak",
    arbitrary: "private-value"
  });
  const serialized = JSON.stringify(diagnostics);

  assert.equal(serialized.includes("123.456"), false);
  assert.equal(serialized.includes("do-not-leak"), false);
  assert.equal(serialized.includes("private-value"), false);
});

test("result shape represents mapped_odds_found", async () => {
  const result = await discoverTxlineOddsAvailabilityWindow(
    { startEpochDayFrom: 20600, startEpochDayTo: 20600 },
    discoveryDependencies([{ prices: [1.75], priceNames: ["Home"] }])
  );

  assert.equal(result.found, true);
  assert.equal(result.reason, "mapped_odds_found");
  assert.equal(result.candidate?.mapped_count, 1);
  assert.equal(result.candidate?.sample.length, 1);
});

test("result shape represents raw_odds_shape_seen_but_not_mapped", async () => {
  const result = await discoverTxlineOddsAvailabilityWindow(
    { startEpochDayFrom: 20600, startEpochDayTo: 20600 },
    discoveryDependencies({ unfamiliarPrices: [1.75] })
  );

  assert.equal(result.found, false);
  assert.equal(result.reason, "raw_odds_shape_seen_but_not_mapped");
  assert.equal(result.candidate?.mapped_count, 0);
  assert.equal(result.candidate?.diagnostics?.raw_response_type, "object");
});

test("result shape represents no_odds_found", async () => {
  const result = await discoverTxlineOddsAvailabilityWindow(
    { startEpochDayFrom: 20600, startEpochDayTo: 20600 },
    discoveryDependencies([])
  );

  assert.equal(result.found, false);
  assert.equal(result.reason, "no_odds_found");
  assert.equal(result.candidate, null);
  assert.equal(result.checked_candidates, 8);
});

test("discovery window module does not import or call persistence functions", async () => {
  const source = await readFile(
    new URL("./txline-odds-discovery-window.ts", import.meta.url),
    "utf8"
  );

  assert.equal(/getDbClient|writeOddsSnapshot|ingestTxlineOddsSnapshot/.test(source), false);
});

test("results contain no unrelated analysis or transaction fields", async () => {
  const result = await discoverTxlineOddsAvailabilityWindow(
    { startEpochDayFrom: 20600, startEpochDayTo: 20600 },
    discoveryDependencies([])
  );
  const keys = JSON.stringify(result);

  for (const forbidden of [
    "signal_core",
    "movement",
    "confidence",
    "betting",
    "wagering"
  ]) {
    assert.equal(keys.includes(forbidden), false);
  }
});
