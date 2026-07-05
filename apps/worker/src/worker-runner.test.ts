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
  assert.equal(result.result, null);
});

test("execute mode calls injected runner exactly once", async () => {
  let calls = 0;
  const config = parseWorkerConfig([
    "--fixtureId", "17952170",
    "--competitionId", "430",
    "--startEpochDay", "20608",
    "--execute"
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
  assert.deepEqual(result.result, {
    fixtureId: "17952170",
    mode: "execute",
    metaStatus: "live",
    runId: "run-1"
  });
});
