import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkerConfig } from "./worker-config.js";
import { runWorker } from "./worker-runner.js";

test("dry-run does not call ingestion runner", async () => {
  let calls = 0;
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608",
    "--dry-run"
  ]);

  const result = await runWorker(config, {
    executeIngestion: async () => {
      calls += 1;
      return {};
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.executed, false);
  assert.equal(result.output.mode, "dry-run");
  assert.equal(result.output.safety.db_write_enabled, false);
  assert.equal(result.output.safety.txline_call_enabled, false);
  assert.equal(result.output.safety.scheduler_enabled, false);
});

test("execute mode without confirmation never calls injected runner because parse fails first", async () => {
  await assert.rejects(
    async () => runWorker(
      parseWorkerConfig([
        "--fixtureId", "17952170",
        "--competitionId", "430",
        "--startEpochDay", "20608",
        "--execute"
      ]),
      {
        executeIngestion: async () => {
          throw new Error("should not run");
        }
      }
    ),
    /execute mode requires --confirm-db-write/i
  );
});

test("execute mode calls injected runner exactly once only when confirmed", async () => {
  let calls = 0;
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608",
    "--execute",
    "--confirm-db-write",
    "--runId", "manual-run"
  ]);

  const result = await runWorker(config, {
    executeIngestion: async (input) => {
      calls += 1;
      assert.equal(input.fixtureId, "17952170");
      assert.equal(input.competitionId, 430);
      assert.equal(input.startEpochDay, 20608);
      return {
        data: { run_id: "run-1" },
        meta: { status: "live" }
      };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.executed, true);
  assert.equal(result.output.mode, "execute");
  assert.equal(result.output.run_id, "manual-run");
  assert.equal(result.output.safety.db_write_enabled, true);
  assert.equal(result.output.safety.txline_call_enabled, true);
  assert.equal(result.output.safety.scheduler_enabled, false);
  assert.deepEqual(result.output.result, {
    fixtureId: "17952170",
    metaStatus: "live",
    runId: "run-1"
  });
});
