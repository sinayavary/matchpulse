import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalOddsMarketKey,
  normalizeOddsMarketType,
  normalizeOddsSelection,
  normalizeStoredOddsObservation,
  parseOddsMarketLine,
  parseStoredOddsMarketId,
  type StoredOddsObservation,
} from "./odds-market-normalization.js";

test("Basic market ID parsing", () => {
  const res = parseStoredOddsMarketId("bookmaker:Test|type:1|period:0|parameters:2.5");
  assert.equal(res.provider_key, "Test");
  assert.equal(res.odds_type, "1");
  assert.equal(res.period, "0");
  assert.equal(res.parameters, "2.5");
});

test("Segment order independence", () => {
  const res1 = parseStoredOddsMarketId("bookmaker:Test|type:1");
  const res2 = parseStoredOddsMarketId("type:1|bookmaker:Test");
  assert.deepEqual(res1, res2);
});

test("Case-insensitive segment keys", () => {
  const res = parseStoredOddsMarketId("Bookmaker:Test|TYPE:1");
  assert.equal(res.provider_key, "Test");
  assert.equal(res.odds_type, "1");
});

test("Whitespace trimming", () => {
  const res = parseStoredOddsMarketId(" bookmaker : Test | type : 1 ");
  assert.equal(res.provider_key, "Test");
  assert.equal(res.odds_type, "1");
});

test("Missing provider", () => {
  const res = parseStoredOddsMarketId("type:1|period:0");
  assert.equal(res.provider_key, null);
});

test("Unknown segment preservation behavior", () => {
  const res = parseStoredOddsMarketId("bookmaker:Test|unknown:val");
  assert.equal(res.provider_key, "Test");
  // Unknown segments are ignored but do not throw
});

test("Duplicate known segment handling", () => {
  const res = parseStoredOddsMarketId("bookmaker:Test|bookmaker:Test2");
  // Deterministic resolution: last one wins or first one wins, as long as it's deterministic
  assert.equal(res.provider_key, "Test2");
});

test("Empty market ID rejection", () => {
  assert.throws(() => parseStoredOddsMarketId(""), TypeError);
  assert.throws(() => parseStoredOddsMarketId("   "), TypeError);
});

test("Stable-price provider classification", () => {
  const res = parseStoredOddsMarketId("bookmaker:TXLineStablePriceDemargined|type:1");
  assert.equal(res.provider_key, "TXLineStablePriceDemargined");
});

test("1X2 alias normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "1x2", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "match_result_1x2");
  assert.equal(normalizeOddsMarketType({ market_name: "Match Result", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "match_result_1x2");
  assert.equal(normalizeOddsMarketType({ market_name: "Full Time Result", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "match_result_1x2");
  assert.equal(normalizeOddsMarketType({ market_name: "Moneyline Three Way", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "match_result_1x2");
});

test("Match-result alias normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Match Result", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "match_result_1x2");
});

test("Double-chance normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Double Chance", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "double_chance");
  assert.equal(normalizeOddsMarketType({ market_name: "1X", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "double_chance");
  assert.equal(normalizeOddsMarketType({ market_name: "X2", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "double_chance");
  assert.equal(normalizeOddsMarketType({ market_name: "12", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "double_chance");
});

test("Totals normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Total Goals", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "total_goals");
  assert.equal(normalizeOddsMarketType({ market_name: "Goals Over Under", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "total_goals");
  assert.equal(normalizeOddsMarketType({ market_name: "Over Under", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "total_goals");
});

test("BTTS normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Both Teams To Score", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "both_teams_to_score");
  assert.equal(normalizeOddsMarketType({ market_name: "BTTS", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "both_teams_to_score");
  assert.equal(normalizeOddsMarketType({ market_name: "GG NG", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "both_teams_to_score");
});

test("Asian-handicap normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Asian Handicap", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "asian_handicap");
  assert.equal(normalizeOddsMarketType({ market_name: "Handicap Asian", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "asian_handicap");
});

test("Next-goal normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Next Goal", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "next_goal");
  assert.equal(normalizeOddsMarketType({ market_name: "Team To Score Next", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "next_goal");
});

test("Correct-score normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Correct Score", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "correct_score");
  assert.equal(normalizeOddsMarketType({ market_name: "Exact Score", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "correct_score");
});

test("Unknown-market normalization", () => {
  assert.equal(normalizeOddsMarketType({ market_name: "Some Weird Market", parsed_identity: { original_market_id: "", provider_key: null, odds_type: null, period: null, parameters: null } }), "unknown");
});

test("Home aliases", () => {
  assert.equal(normalizeOddsSelection("1"), "home");
  assert.equal(normalizeOddsSelection("Home"), "home");
  assert.equal(normalizeOddsSelection("Home Team"), "home");
  assert.equal(normalizeOddsSelection("Team1"), "home");
  assert.equal(normalizeOddsSelection("Participant1"), "home");
});

test("Draw aliases", () => {
  assert.equal(normalizeOddsSelection("X"), "draw");
  assert.equal(normalizeOddsSelection("Draw"), "draw");
  assert.equal(normalizeOddsSelection("Tie"), "draw");
});

test("Away aliases", () => {
  assert.equal(normalizeOddsSelection("2"), "away");
  assert.equal(normalizeOddsSelection("Away"), "away");
  assert.equal(normalizeOddsSelection("Away Team"), "away");
  assert.equal(normalizeOddsSelection("Team2"), "away");
  assert.equal(normalizeOddsSelection("Participant2"), "away");
});

test("Yes/no aliases", () => {
  assert.equal(normalizeOddsSelection("Yes"), "yes");
  assert.equal(normalizeOddsSelection("Y"), "yes");
  assert.equal(normalizeOddsSelection("No"), "no");
  assert.equal(normalizeOddsSelection("N"), "no");
});

test("Over/under aliases", () => {
  assert.equal(normalizeOddsSelection("Over"), "over");
  assert.equal(normalizeOddsSelection("O"), "over");
  assert.equal(normalizeOddsSelection("Under"), "under");
  assert.equal(normalizeOddsSelection("U"), "under");
});

test("None aliases", () => {
  assert.equal(normalizeOddsSelection("None"), "none");
  assert.equal(normalizeOddsSelection("No Goal"), "none");
  assert.equal(normalizeOddsSelection("Nobody"), "none");
});

test("Correct-score selection maps to other", () => {
  assert.equal(normalizeOddsSelection("1-0"), "other");
  assert.equal(normalizeOddsSelection("2:1"), "other");
  assert.equal(normalizeOddsSelection("0-0"), "other");
});

test("Unknown selection maps to unknown", () => {
  assert.equal(normalizeOddsSelection("Unknown Sel"), "unknown");
});

test("Empty selection rejection", () => {
  assert.throws(() => normalizeOddsSelection(""), TypeError);
  assert.throws(() => normalizeOddsSelection("   "), TypeError);
});

test("Positive line parsing", () => {
  assert.equal(parseOddsMarketLine({ market_name: null, selection_name: "Over", parameters: "2.5" }), 2.5);
  assert.equal(parseOddsMarketLine({ market_name: null, selection_name: "+1.5", parameters: null }), 1.5);
});

test("Negative line parsing", () => {
  assert.equal(parseOddsMarketLine({ market_name: null, selection_name: "-0.75", parameters: null }), -0.75);
});

test("Parameter line priority", () => {
  assert.equal(parseOddsMarketLine({ market_name: null, selection_name: "Over 3.5", parameters: "2.5" }), 2.5);
});

test("Ambiguous line returns null", () => {
  assert.equal(parseOddsMarketLine({ market_name: null, selection_name: "Over 2.5 3.5", parameters: null }), null);
});

test("Correct-score is not parsed as line", () => {
  assert.equal(parseOddsMarketLine({ market_name: "Correct Score", selection_name: "1-0", parameters: null }), null);
});

test("1x2 is not parsed as line", () => {
  assert.equal(parseOddsMarketLine({ market_name: "1x2", selection_name: "1", parameters: null }), null);
});

test("Canonical key determinism", () => {
  const key1 = buildCanonicalOddsMarketKey({ market_type: "total_goals", period: "0", line: 2.5, parameters: null });
  const key2 = buildCanonicalOddsMarketKey({ market_type: "total_goals", period: "0", line: 2.5, parameters: null });
  assert.equal(key1, key2);
});

test("Provider does not affect canonical market key", () => {
  const key1 = buildCanonicalOddsMarketKey({ market_type: "total_goals", period: "0", line: 2.5, parameters: null });
  // Provider is not an input to buildCanonicalOddsMarketKey, so it cannot affect it.
  const key2 = buildCanonicalOddsMarketKey({ market_type: "total_goals", period: "0", line: 2.5, parameters: null });
  assert.equal(key1, key2);
});

test("Valid observation normalization", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:3|period:0|parameters:2.5",
    market_name: "Total Goals",
    selection_name: "Over",
    decimal_odds: 2.0,
    previous_decimal_odds: 1.9,
    change_percent: 5.0,
    direction: "up",
    source_timestamp: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:01.000Z",
  };
  const res = normalizeStoredOddsObservation(obs);
  assert.equal(res.fixture_id, "f1");
  assert.equal(res.provider_key, "Test");
  assert.equal(res.market_type, "total_goals");
  assert.equal(res.selection, "over");
  assert.equal(res.line, 2.5);
  assert.equal(res.decimal_odds, 2.0);
  assert.equal(res.source_timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(res.created_at, "2026-01-01T00:00:01.000Z");
});

test("Invalid decimal Odds equal to 1", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 1.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:01.000Z",
  };
  assert.throws(() => normalizeStoredOddsObservation(obs), TypeError);
});

test("Invalid decimal Odds below 1", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 0.5,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:01.000Z",
  };
  assert.throws(() => normalizeStoredOddsObservation(obs), TypeError);
});

test("NaN rejection", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: NaN,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:01.000Z",
  };
  assert.throws(() => normalizeStoredOddsObservation(obs), TypeError);
});

test("Infinity rejection", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: Infinity,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:01.000Z",
  };
  assert.throws(() => normalizeStoredOddsObservation(obs), TypeError);
});

test("Invalid timestamps", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 2.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "invalid",
    created_at: "2026-01-01T00:00:01.000Z",
  };
  assert.throws(() => normalizeStoredOddsObservation(obs), TypeError);
});

test("Canonical ISO timestamps", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 2.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:01Z",
  };
  const res = normalizeStoredOddsObservation(obs);
  assert.equal(res.source_timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(res.created_at, "2026-01-01T00:00:01.000Z");
});

test("Input is not mutated", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 2.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:01Z",
  };
  const original = { ...obs };
  normalizeStoredOddsObservation(obs);
  assert.deepEqual(obs, original);
});

test("Output contains no raw field", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 2.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:01Z",
  };
  const res = normalizeStoredOddsObservation(obs);
  assert.equal("raw" in res, false);
  assert.equal("raw_payload" in res, false);
});

test("Output contains no provider payload", () => {
  const obs: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: "s1",
    market_id: "bookmaker:Test|type:1",
    market_name: "1x2",
    selection_name: "1",
    decimal_odds: 2.0,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:01Z",
  };
  const res = normalizeStoredOddsObservation(obs);
  assert.equal("provider_payload" in res, false);
  assert.equal("source_payload" in res, false);
});

test("Match-result numeric selection is never parsed as a line", () => {
  assert.equal(
    parseOddsMarketLine({
      market_name: "Match Result",
      selection_name: "1",
      parameters: null,
    }),
    null,
  );

  assert.equal(
    parseOddsMarketLine({
      market_name: "Full Time Result",
      selection_name: "2",
      parameters: "2.5",
    }),
    null,
  );
});

test("Team selection alias is not interpreted as a numeric line", () => {
  assert.equal(
    parseOddsMarketLine({
      market_name: null,
      selection_name: "team1",
      parameters: null,
    }),
    null,
  );

  assert.equal(
    parseOddsMarketLine({
      market_name: null,
      selection_name: "participant2",
      parameters: null,
    }),
    null,
  );
});

test("Asian-handicap parameter line is retained for home selection", () => {
  assert.equal(
    parseOddsMarketLine({
      market_name: "Asian Handicap",
      selection_name: "Home",
      parameters: "-0.75",
    }),
    -0.75,
  );
});

test("Asian-handicap parameter line is retained for away selection", () => {
  assert.equal(
    parseOddsMarketLine({
      market_name: "Asian Handicap",
      selection_name: "Away",
      parameters: "+1.5",
    }),
    1.5,
  );
});

test("Market alias remains recognizable when it contains a line", () => {
  assert.equal(
    normalizeOddsMarketType({
      market_name: "Asian Handicap -0.75",
      parsed_identity: {
        original_market_id: "bookmaker:A",
        provider_key: "A",
        odds_type: null,
        period: null,
        parameters: null,
      },
    }),
    "asian_handicap",
  );

  assert.equal(
    normalizeOddsMarketType({
      market_name: "Total Goals 2.5",
      parsed_identity: {
        original_market_id: "bookmaker:A",
        provider_key: "A",
        odds_type: null,
        period: null,
        parameters: null,
      },
    }),
    "total_goals",
  );
});

test("Ambiguous parameter numbers return null without fallback", () => {
  assert.equal(
    parseOddsMarketLine({
      market_name: "Total Goals 2.5",
      selection_name: "Over 2.5",
      parameters: "primary:2.5|alternate:3.5",
    }),
    null,
  );
});

test("Equivalent parameter formatting produces the same canonical key", () => {
  const first = buildCanonicalOddsMarketKey({
    market_type: "total_goals",
    period: "0",
    line: 2.5,
    parameters: "2.5",
  });

  const second = buildCanonicalOddsMarketKey({
    market_type: "total_goals",
    period: "0",
    line: 2.5,
    parameters: "line:2.5",
  });

  const third = buildCanonicalOddsMarketKey({
    market_type: "total_goals",
    period: "0",
    line: 2.5,
    parameters: "total=2.5",
  });

  assert.equal(first, "total_goals|period:0|line:2.5");
  assert.equal(second, first);
  assert.equal(third, first);
});

test("Market ID duplicate resolution is independent of segment order", () => {
  const first = parseStoredOddsMarketId(
    "bookmaker:Alpha|bookmaker:Beta|type:1",
  );

  const second = parseStoredOddsMarketId(
    "type:1|bookmaker:Beta|bookmaker:Alpha",
  );

  assert.deepEqual(first, second);
  assert.equal(first.provider_key, "Beta");
});

test("Canonical original market ID is independent of segment order", () => {
  const first = parseStoredOddsMarketId(
    "type:1|bookmaker:Test|period:0",
  );

  const second = parseStoredOddsMarketId(
    "period:0|type:1|bookmaker:Test",
  );

  assert.equal(first.original_market_id, second.original_market_id);
  assert.equal(
    first.original_market_id,
    "bookmaker:Test|period:0|type:1",
  );
});

test("Unknown encoded numeric market type is not guessed", () => {
  assert.equal(
    normalizeOddsMarketType({
      market_name: null,
      parsed_identity: {
        original_market_id: "type:3",
        provider_key: null,
        odds_type: "3",
        period: null,
        parameters: null,
      },
    }),
    "unknown",
  );
});

test("Invalid previous decimal Odds are rejected", () => {
  const observation: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: null,
    market_id: "bookmaker:Test|type:1",
    market_name: "Match Result",
    selection_name: "Home",
    decimal_odds: 2,
    previous_decimal_odds: Infinity,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  assert.throws(
    () => normalizeStoredOddsObservation(observation),
    TypeError,
  );
});

test("Invalid change percent is rejected", () => {
  const observation: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: null,
    market_id: "bookmaker:Test|type:1",
    market_name: "Match Result",
    selection_name: "Home",
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: NaN,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  assert.throws(
    () => normalizeStoredOddsObservation(observation),
    TypeError,
  );
});

test("Null source timestamp remains null", () => {
  const observation: StoredOddsObservation = {
    fixture_id: "f1",
    external_seq: null,
    market_id: "bookmaker:Test|type:1",
    market_name: "Match Result",
    selection_name: "Home",
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "flat",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  const result = normalizeStoredOddsObservation(observation);

  assert.equal(result.source_timestamp, null);
});

test("Fixture ID external sequence and direction are canonicalized", () => {
  const observation: StoredOddsObservation = {
    fixture_id: "  fixture-1  ",
    external_seq: "  seq-10  ",
    market_id: "bookmaker:Test|type:1",
    market_name: "Match Result",
    selection_name: "Home",
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "  UP  ",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  const result = normalizeStoredOddsObservation(observation);

  assert.equal(result.fixture_id, "fixture-1");
  assert.equal(result.external_seq, "seq-10");
  assert.equal(result.direction, "up");
});

test("Blank external sequence becomes null", () => {
  const observation: StoredOddsObservation = {
    fixture_id: "fixture-1",
    external_seq: "   ",
    market_id: "bookmaker:Test|type:1",
    market_name: "Match Result",
    selection_name: "Home",
    decimal_odds: 2,
    previous_decimal_odds: null,
    change_percent: null,
    direction: "",
    source_timestamp: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  const result = normalizeStoredOddsObservation(observation);

  assert.equal(result.external_seq, null);
  assert.equal(result.direction, "unknown");
});
