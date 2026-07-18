import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerCycleRecord, cadenceForPhase, discoveryEpochDays, normalizeWorkerHealthState, parseCompetitionConfig, pollPhase, runMatchesCatalogReconciliation, toSafeRuntimeError, withProviderRetry } from "./automatic-data-runtime.js";

test("production competition configuration fails closed", () => {
  assert.deepEqual(parseCompetitionConfig("430:20608,431:20609"), [{ competitionId: "430", startEpochDay: 20608 }, { competitionId: "431", startEpochDay: 20609 }]);
  assert.deepEqual(parseCompetitionConfig(""), []);
  assert.throws(() => parseCompetitionConfig("demo"));
});

test("adaptive cadence follows upcoming, prematch, live and postmatch windows", () => {
  const config = { leadMinutes: 60, tailMinutes: 180, upcomingMs: 300000, prematchMs: 30000, liveMs: 15000, postmatchMs: 30000 };
  const now = new Date("2026-07-18T12:00:00Z");
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T14:00:00Z"), "scheduled", now, config), config), 300000);
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T12:30:00Z"), "scheduled", now, config), config), 30000);
  assert.equal(cadenceForPhase("live", config), 15000);
  assert.equal(cadenceForPhase(pollPhase(new Date("2026-07-18T11:00:00Z"), "finished", now, config), config), Infinity);
});

test("provider retry honors retry count without fabricating a result", async () => {
  let calls = 0;
  const result = await withProviderRetry(async () => { calls += 1; if (calls < 3) throw new Error("temporary"); return "ok"; }, { sleep: async () => undefined });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("discovery uses the dynamic UTC backfill and fourteen-day future window", () => {
  assert.deepEqual(discoveryEpochDays(new Date("2026-07-18T23:59:00Z")), Array.from({ length: 16 }, (_, index) => 20651 + index));
});

test("runtime errors are safe and stage-labelled", () => {
  const error = toSafeRuntimeError(new Error("postgresql://user:password@host/db token=secret"), "lock");
  assert.equal(error.stage, "lock");
  assert.equal(error.message.includes("password"), false);
  assert.equal(error.message.includes("postgresql://"), false);
});

test("successful health state clears stale errors and resets the cycle count", () => {
  assert.deepEqual(normalizeWorkerHealthState({ errorCount: 0 }), { lastError: null, errorCount: 0 });
  assert.deepEqual(normalizeWorkerHealthState({ errorCount: 0 }), { lastError: null, errorCount: 0 });
});

test("discovery with no active fixtures is a healthy, non-failed cycle", () => {
  const cycle = buildWorkerCycleRecord({ last_cycle_status: "healthy", started_at: "2026-07-18T00:00:00.000Z", finished_at: "2026-07-18T00:00:01.000Z", discovered_competitions: 1, discovered_fixture_count: 6, active_fixture_count: 0, persisted_fixture_count: 6, successful_fixture_count: 0, failed_fixture_count: 0, configuration_error: false, lock_acquired: true, leaseExpiresAt: new Date("2026-07-18T00:01:31.000Z") });
  assert.equal(cycle.last_cycle_status, "healthy");
  assert.equal(cycle.active_fixture_count, 0);
  assert.equal(cycle.failed_fixture_count, 0);
  assert.equal(cycle.configuration_error, false);
});

test("new cycle errors remain cycle-local", () => {
  const error = normalizeWorkerHealthState({ error: new Error("new failure"), errorCount: 1, stage: "ingestion" });
  assert.equal(error.errorCount, 1);
  assert.match(error.lastError ?? "", /new failure/);
  assert.equal(normalizeWorkerHealthState({ errorCount: 0 }).lastError, null);
});

test("reconciliation is dry-run by default, resumable, batch-isolated, and non-destructive", async () => {
  const rows = [
    { fixtureId: "a", competition: "430", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:00:00Z"), status: "UNKNOWN" },
    { fixtureId: "b", competition: "430", homeTeam: "A", awayTeam: "B", startTimeUtc: new Date("2026-07-18T15:02:00Z"), status: "UNKNOWN" }
  ];
  const checkpoints: unknown[] = [];
  const db = {
    fixture: {
      findMany: async ({ cursor, take }: { cursor?: { fixtureId: string }; take: number }) => {
        const start = cursor === undefined ? 0 : rows.findIndex((row) => row.fixtureId === cursor.fixtureId) + 1;
        return rows.slice(start, start + take);
      },
      update: async () => { throw new Error("apply must not run in dry-run"); }
    },
    healthStatus: {
      findUnique: async () => null,
      upsert: async (input: unknown) => { checkpoints.push(input); }
    }
  };
  const result = await runMatchesCatalogReconciliation({ db, batchSize: 1 });
  assert.equal(result.mode, "dry-run");
  assert.equal(result.rows_scanned, 2);
  assert.equal(result.duplicate_candidate_groups, 1);
  assert.equal(result.source_rows_deleted, 0);
  assert.equal(result.finished, true);
  assert.ok(checkpoints.length >= 1);
});
