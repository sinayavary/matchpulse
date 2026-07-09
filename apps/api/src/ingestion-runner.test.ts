import assert from "node:assert/strict";
import test from "node:test";
import {
  IngestionRunnerValidationError,
  normalizeIngestionRunnerInput,
  runTargetIngestionCycle,
  runFixtureIngestionPipeline,
  summarizeCanonicalState,
  TARGET_INGESTION_SAFE_SCOPE_NOTE,
  TARGET_SCORE_INGESTION_SCOPE,
  type IngestionRunnerDependencies
} from "./ingestion-runner.js";
import type { CanonicalMatchState } from "./match-state-builder.js";
import { readFile } from "node:fs/promises";

function canonicalState(
  quality: CanonicalMatchState["quality"]["status"] = "complete"
): CanonicalMatchState {
  const empty = quality === "empty";
  const partial = quality === "partial";
  return {
    fixture_id: "17588223",
    identity: {
      fixture_id: "17588223",
      competition: empty ? null : "72",
      home_team: empty ? null : "Mexico",
      away_team: empty ? null : "South Korea",
      start_time_utc: null,
      status: null
    },
    scoreboard: {
      available: !empty && !partial,
      home_score: null,
      away_score: null,
      phase: null,
      last_data_received_at: null
    },
    odds: {
      available: !empty,
      count: empty ? 0 : 1,
      markets: empty ? [] : [{
        market_id: "market",
        market_name: "winner",
        selection_name: "home",
        odds: 2,
        direction: "flat",
        source_timestamp: "2026-06-11T23:40:00.000Z"
      }]
    },
    freshness: {
      built_at: "2026-06-11T23:40:00.000Z",
      latest_score_timestamp: null,
      latest_odds_timestamp: empty ? null : "2026-06-11T23:40:00.000Z",
      latest_data_timestamp: empty ? null : "2026-06-11T23:40:00.000Z"
    },
    quality: {
      status: quality,
      has_fixture: !empty,
      has_scoreboard: !empty && !partial,
      has_odds: !empty,
      issues: []
    }
  };
}

const buildState: IngestionRunnerDependencies["buildState"] = async () => canonicalState();

test("normalizeIngestionRunnerInput requires fixtureId", () => {
  assert.throws(
    () => normalizeIngestionRunnerInput({ fixtureId: "  " }),
    IngestionRunnerValidationError
  );
});

test("asOf defaults to current time and produces a valid epoch", () => {
  const before = Date.now();
  const input = normalizeIngestionRunnerInput({ fixtureId: "17588223" });
  assert.ok(input.asOf >= before && input.asOf <= Date.now());
  assert.doesNotThrow(() => new Date(input.asOf).toISOString());
});

test("includeFixture defaults false without competition and day", () => {
  const input = normalizeIngestionRunnerInput({ fixtureId: "17588223" });
  assert.equal(input.includeFixture, false);
});

test("includeFixture runs when competition and day are provided", async () => {
  let calls = 0;
  const result = await runFixtureIngestionPipeline({
    fixtureId: "17588223",
    competitionId: 72,
    startEpochDay: 20600,
    includeScore: false,
    includeOdds: false
  }, {
    ingestFixtures: async () => {
      calls += 1;
      return {
        fetchedCount: 1,
        normalizedCount: 1,
        upsertedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        fixtures: [{
          fixture_id: "17588223",
          competition: "72",
          home_team: "Mexico",
          away_team: "South Korea",
          start_time_utc: null,
          status: "unknown"
        }]
      };
    },
    buildState,
    createRunId: () => "run-1"
  });

  assert.equal(calls, 1);
  assert.equal(result.data.steps.fixture_ingest.attempted, true);
  assert.equal(result.data.steps.fixture_ingest.summary?.target_fixture_included, true);
});

test("score and odds default to included", () => {
  const input = normalizeIngestionRunnerInput({ fixtureId: "17588223" });
  assert.equal(input.includeScore, true);
  assert.equal(input.includeOdds, true);
});

test("oddsLimit caps at 50", () => {
  const input = normalizeIngestionRunnerInput({ fixtureId: "17588223", oddsLimit: 500 });
  assert.equal(input.oddsLimit, 50);
});

test("runner tolerates score no_data and still builds state", async () => {
  let stateBuilds = 0;
  const result = await runFixtureIngestionPipeline({
    fixtureId: "17588223",
    asOf: "2026-06-11T23:40:00.000Z",
    includeOdds: false
  }, {
    ingestScore: async () => ({
      fixtureId: "17588223",
      fetchedCount: 0,
      selectedSeq: null,
      selectedTs: null,
      action: null,
      scoreAvailable: false,
      upserted: false,
      matchState: null
    }),
    buildState: async () => {
      stateBuilds += 1;
      return canonicalState("partial");
    },
    createRunId: () => "run-2"
  });

  assert.equal(result.data.steps.score_ingest.status, "no_data");
  assert.equal(stateBuilds, 1);
  assert.notEqual(result.data.state, null);
});

test("runner tolerates odds no_data and still builds state", async () => {
  let stateBuilds = 0;
  const result = await runFixtureIngestionPipeline({
    fixtureId: "17588223",
    asOf: 1_781_226_000_000,
    includeScore: false
  }, {
    ingestOdds: async () => ({
      requested: { fixture_id: "17588223", as_of: "1781226000000" },
      result: {
        fetched_count: 0,
        mapped_count: 0,
        upserted_count: 0,
        skipped_count: 0,
        failed_count: 0
      },
      odds_snapshots: []
    }),
    buildState: async () => {
      stateBuilds += 1;
      return canonicalState("partial");
    },
    createRunId: () => "run-3"
  });

  assert.equal(result.data.steps.odds_ingest.status, "no_data");
  assert.equal(stateBuilds, 1);
});

test("runner safely marks errors without exposing their details", async () => {
  const result = await runFixtureIngestionPipeline({
    fixtureId: "17588223",
    includeOdds: false
  }, {
    ingestScore: async () => {
      throw new Error("token=super-secret raw_payload={bad:true}");
    },
    buildState,
    createRunId: () => "run-4"
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.data.steps.score_ingest.status, "error");
  assert.equal(result.data.steps.score_ingest.message, "Score ingestion failed.");
  assert.equal(serialized.includes("super-secret"), false);
  assert.equal(serialized.includes("raw_payload"), false);
});

test("summaries exclude raw ingestion payloads", async () => {
  const result = await runFixtureIngestionPipeline({
    fixtureId: "17588223",
    includeScore: false
  }, {
    ingestOdds: async () => ({
      requested: { fixture_id: "17588223", as_of: "1781226000000" },
      result: {
        fetched_count: 1,
        mapped_count: 1,
        upserted_count: 1,
        skipped_count: 0,
        failed_count: 0
      },
      odds_snapshots: [{
        fixture_id: "17588223",
        market_id: "market",
        market_name: null,
        selection_name: "home",
        odds: 2,
        direction: "flat",
        source_timestamp: null,
        raw: "must-not-escape"
      } as never]
    }),
    buildState,
    createRunId: () => "run-5"
  });

  assert.equal(JSON.stringify(result).includes("must-not-escape"), false);
});

test("summary contains no restricted analytical or wagering fields", () => {
  const forbidden = new Set([
    "signalcore", "confidence", "probability", "edge", "recommendation", "betting", "wagering"
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbidden.has(key.toLowerCase()), false, `unexpected field: ${key}`);
      visit(child);
    }
  };

  visit(summarizeCanonicalState(canonicalState()));
});

test("target cycle returns ok when mocked ingestion steps succeed", async () => {
  const scoreInputs: Parameters<IngestionRunnerDependencies["ingestScore"]>[0][] = [];

  const result = await runTargetIngestionCycle({}, {
    ingestFixtures: async () => ({
      fetchedCount: 1,
      normalizedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      fixtures: [{
        fixture_id: "17952170",
        competition: "430",
        home_team: "Slovenia",
        away_team: "Cyprus",
        start_time_utc: null,
        status: "unknown"
      }]
    }),
    ingestScore: async (input) => {
      scoreInputs.push(input);
      return {
        fixtureId: "17952170",
        fetchedCount: 1,
        selectedSeq: 960,
        selectedTs: 1_781_226_000_000,
        action: "game_finalised",
        scoreAvailable: true,
        upserted: true,
        matchState: null
      };
    },
    ingestOdds: async () => ({
      requested: { fixture_id: "17588223", as_of: "1781226000000" },
      result: {
        fetched_count: 1,
        mapped_count: 1,
        upserted_count: 1,
        skipped_count: 0,
        failed_count: 0
      },
      odds_snapshots: []
    })
  });

  assert.equal(result.status, "ok");
  assert.equal(result.targets.fixtures.status, "ok");
  assert.equal(result.targets.scores.status, "ok");
  assert.equal(result.targets.odds.status, "ok");
  assert.equal(result.safe_scope_note, TARGET_INGESTION_SAFE_SCOPE_NOTE);
  assert.equal(scoreInputs.length, 1);
  const scoreInput = scoreInputs[0];
  assert.equal(scoreInput?.fixtureId, TARGET_SCORE_INGESTION_SCOPE.fixtureId);
  assert.equal(scoreInput?.asOf, TARGET_SCORE_INGESTION_SCOPE.asOf);
  assert.equal(scoreInput?.includeRaw, false);
});

test("target cycle returns partial when one mocked step fails", async () => {
  const result = await runTargetIngestionCycle({}, {
    ingestFixtures: async () => ({
      fetchedCount: 1,
      normalizedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      fixtures: []
    }),
    ingestScore: async () => {
      throw new Error("token=super-secret raw_payload=hidden");
    },
    ingestOdds: async () => ({
      requested: { fixture_id: "17588223", as_of: "1781226000000" },
      result: {
        fetched_count: 1,
        mapped_count: 1,
        upserted_count: 1,
        skipped_count: 0,
        failed_count: 0
      },
      odds_snapshots: []
    })
  });

  assert.equal(result.status, "partial");
  assert.equal(result.targets.scores.status, "failed");
  assert.equal(result.targets.scores.error, "Score refresh failed.");
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("target cycle respects dryRun and skips ingestion calls", async () => {
  let fixtureCalls = 0;
  let scoreCalls = 0;
  let oddsCalls = 0;

  const result = await runTargetIngestionCycle({ dryRun: true }, {
    ingestFixtures: async () => {
      fixtureCalls += 1;
      throw new Error("should not run");
    },
    ingestScore: async () => {
      scoreCalls += 1;
      throw new Error("should not run");
    },
    ingestOdds: async () => {
      oddsCalls += 1;
      throw new Error("should not run");
    }
  });

  assert.equal(result.status, "ok");
  assert.equal(result.targets.fixtures.status, "dry_run");
  assert.equal(result.targets.scores.status, "dry_run");
  assert.equal(result.targets.odds.status, "dry_run");
  assert.equal(fixtureCalls, 0);
  assert.equal(scoreCalls, 0);
  assert.equal(oddsCalls, 0);
});

test("target cycle summary excludes raw payloads and secrets", async () => {
  const result = await runTargetIngestionCycle({}, {
    ingestFixtures: async () => ({
      fetchedCount: 1,
      normalizedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      fixtures: [{
        fixture_id: "17952170",
        competition: "430",
        home_team: "Slovenia",
        away_team: "Cyprus",
        start_time_utc: null,
        status: "unknown",
        raw_payload: "must-not-escape",
        api_secret: "must-not-escape"
      } as never]
    }),
    ingestScore: async () => ({
      fixtureId: "17952170",
      fetchedCount: 1,
      selectedSeq: 960,
      selectedTs: 1_781_226_000_000,
      action: "game_finalised",
      scoreAvailable: true,
      upserted: true,
      matchState: null
    }),
    ingestOdds: async () => ({
      requested: { fixture_id: "17588223", as_of: "1781226000000" },
      result: {
        fetched_count: 1,
        mapped_count: 1,
        upserted_count: 1,
        skipped_count: 0,
        failed_count: 0
      },
      odds_snapshots: [{
        fixture_id: "17588223",
        market_id: "market",
        market_name: null,
        selection_name: "home",
        odds: 2,
        direction: "flat",
        source_timestamp: null,
        raw_payload: "must-not-escape"
      } as never]
    })
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("raw_payload"), false);
  assert.equal(serialized.includes("api_secret"), false);
  assert.equal(serialized.includes("must-not-escape"), false);
});

test("target cycle remains backend-only and does not touch frontend or public api modules", async () => {
  const source = await readFile(
    new URL("./ingestion-runner.ts", import.meta.url),
    "utf8"
  );

  assert.equal(/apps\/web|apps\\web/i.test(source), false);
  assert.equal(/public-api|registerPublicApiRoutes|telegram/i.test(source), false);
});
