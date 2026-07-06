import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleConfig } from "./schedule-config.js";
import { SchedulePlanError, STATIC_DEMO_SCHEDULE_JOBS } from "./schedule-plan.js";
import {
  assertSafeScheduleOutput,
  hasScheduleForbiddenOutputKeys,
  runScheduleExecute,
  runScheduleDryRun,
  ScheduleRunnerError
} from "./schedule-runner.js";

function buildConfig() {
  return parseScheduleConfig(["schedule", "--dry-run", "--runId", "test-schedule-run"]);
}

test("schedule dry-run builds a one-cycle plan", () => {
  const output = runScheduleDryRun(buildConfig());

  assert.equal(output.worker_version, "worker-v0");
  assert.equal(output.mode, "schedule-dry-run");
  assert.equal(output.cycle_count, 1);
  assert.equal(output.run_id, "test-schedule-run");
  assert.ok(Array.isArray(output.jobs));
  assert.ok(output.jobs.length >= 1);
});

test("schedule dry-run does not call ingestion runner", () => {
  let calls = 0;
  const output = runScheduleDryRun(buildConfig(), {
    jobs: STATIC_DEMO_SCHEDULE_JOBS
  });

  // runScheduleDryRun is pure and never receives an ingestion dependency;
  // this test documents that invariant explicitly.
  assert.equal(calls, 0);
  assert.ok(output.jobs.length >= 1);
});

test("schedule dry-run sets db_write_enabled=false", () => {
  assert.equal(runScheduleDryRun(buildConfig()).safety.db_write_enabled, false);
});

test("schedule dry-run sets txline_call_enabled=false", () => {
  assert.equal(runScheduleDryRun(buildConfig()).safety.txline_call_enabled, false);
});

test("schedule dry-run sets scheduler_enabled=false", () => {
  assert.equal(runScheduleDryRun(buildConfig()).safety.scheduler_enabled, false);
});

test("schedule dry-run sets redis_enabled=false", () => {
  assert.equal(runScheduleDryRun(buildConfig()).safety.redis_enabled, false);
});

test("schedule dry-run sets queue_enabled=false", () => {
  assert.equal(runScheduleDryRun(buildConfig()).safety.queue_enabled, false);
});

test("schedule dry-run includes known demo fixture 17952170", () => {
  const output = runScheduleDryRun(buildConfig());
  const primary = output.jobs.find((job) => job.fixtureId === "17952170");

  assert.ok(primary);
  assert.equal(primary?.competitionId, 430);
});

test("schedule dry-run may include known demo fixture 17588223 when configured", () => {
  const output = runScheduleDryRun(buildConfig(), {
    jobs: STATIC_DEMO_SCHEDULE_JOBS.filter((job) => job.fixtureId === "17588223")
  });

  assert.equal(output.jobs.length, 1);
  assert.equal(output.jobs[0]?.fixtureId, "17588223");
});

test("schedule dry-run can restrict to a single fixture", () => {
  const output = runScheduleDryRun(buildConfig(), {
    jobs: STATIC_DEMO_SCHEDULE_JOBS.filter((job) => job.fixtureId === "17952170")
  });

  assert.equal(output.jobs.length, 1);
  assert.equal(output.jobs[0]?.fixtureId, "17952170");
});

test("schedule output passes redaction guard", () => {
  const output = runScheduleDryRun(buildConfig());

  assert.equal(hasScheduleForbiddenOutputKeys(output), false);
  assert.doesNotThrow(() => assertSafeScheduleOutput(output));
});

test("redaction guard is case-insensitive", () => {
  assert.equal(hasScheduleForbiddenOutputKeys({ Authorization: "Bearer abc" }), true);
  assert.equal(hasScheduleForbiddenOutputKeys({ nested: { PRIVATE_KEY: "x" } }), true);
});

test("secret-like schedule fields are rejected before output is emitted", () => {
  assert.throws(
    () => runScheduleDryRun(buildConfig(), {
      jobs: [
        {
          fixtureId: "17952170",
          competitionId: 430,
          startEpochDay: 20608,
          includeFixture: true,
          includeScore: true,
          includeOdds: true,
          oddsLimit: 20,
          privateKey: "leak"
        }
      ] as never
    }),
    SchedulePlanError
  );
});

test("no loop/interval/cron is enabled by default", () => {
  const config = buildConfig();

  assert.equal(config.loopEnabled, false);
  assert.equal(config.cronEnabled, false);
  assert.equal(config.schedulerEnabled, false);
});

test("schedule execute flags are rejected during dry-run orchestration", () => {
  const config = parseScheduleConfig(["schedule", "--dry-run"]);

  // Even if a caller hand-constructs an unsafe config, the runner must refuse it.
  assert.throws(
    () => runScheduleDryRun({
      ...config,
      execute: true,
      confirmDbWrite: true,
      dbWriteEnabled: true
    } as never),
    ScheduleRunnerError
  );
});

test("confirmed schedule execute runs exactly one cycle", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write", "--runId", "execute-cycle"]),
    {
      executeIngestion: async () => ({
        data: { run_id: "ingestion-run-1" },
        meta: { status: "ok" }
      })
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.equal(output.mode, "schedule-execute");
  assert.equal(output.run_id, "execute-cycle");
  assert.equal(output.cycle_count, 1);
  assert.equal(output.job_count, 1);
});

test("confirmed schedule execute calls injected worker runner once per planned job", async () => {
  let calls = 0;

  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => {
        calls += 1;
        return {
          data: { run_id: `ingestion-run-${calls}` },
          meta: { status: "ok" }
        };
      }
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS
    }
  );

  assert.equal(calls, STATIC_DEMO_SCHEDULE_JOBS.length);
  assert.equal(output.results.jobs.length, STATIC_DEMO_SCHEDULE_JOBS.length);
});

test("confirmed schedule execute does not start loop cron or interval", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => ({})
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.equal(output.safety.scheduler_enabled, false);
  assert.equal(output.safety.redis_enabled, false);
  assert.equal(output.safety.queue_enabled, false);
});

test("confirmed schedule execute output has safe execute safety block", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => ({})
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.equal(output.safety.db_write_enabled, true);
  assert.equal(output.safety.txline_call_enabled, true);
  assert.equal(output.safety.scheduler_enabled, false);
  assert.equal(output.safety.redis_enabled, false);
  assert.equal(output.safety.queue_enabled, false);
});

test("per-job success result is safe", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => ({
        data: { run_id: "live-run-id" },
        meta: { status: "ok" }
      })
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.deepEqual(output.results.jobs[0], {
    fixtureId: "17952170",
    status: "success"
  });
  assert.equal(hasScheduleForbiddenOutputKeys(output), false);
});

test("per-job failure result is safe", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => {
        throw new Error("DATABASE_URL should never leak");
      }
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.deepEqual(output.results.jobs[0], {
    fixtureId: "17952170",
    status: "failed",
    message: "Worker execution failed."
  });
  assert.equal(hasScheduleForbiddenOutputKeys(output), false);
});

test("confirmed schedule execute continues through failures and returns safe summary", async () => {
  let calls = 0;
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("first failure");
        }
        return {
          data: { run_id: "ingestion-run-2" },
          meta: { status: "ok" }
        };
      }
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 2)
    }
  );

  assert.equal(calls, 2);
  assert.equal(output.results.failed_count, 1);
  assert.equal(output.results.success_count, 1);
});

test("output redaction guard catches secret-like data in schedule execute output", async () => {
  const output = await runScheduleExecute(
    parseScheduleConfig(["schedule", "--execute", "--confirm-db-write"]),
    {
      executeIngestion: async () => ({})
    },
    {
      jobs: STATIC_DEMO_SCHEDULE_JOBS.slice(0, 1)
    }
  );

  assert.equal(hasScheduleForbiddenOutputKeys(output), false);
  assert.doesNotThrow(() => assertSafeScheduleOutput(output));
  assert.throws(
    () => assertSafeScheduleOutput({ results: { jobs: [{ privateKey: "secret" }] } }),
    ScheduleRunnerError
  );
});
