import { parseWorkerConfig, WorkerConfigError } from "./worker-config.js";
import { runWorker } from "./worker-runner.js";
import { createWorkerOutputEnvelope } from "./worker-safety.js";
import {
  isScheduleInvocation,
  parseScheduleConfig,
  ScheduleConfigError
} from "./schedule-config.js";
import {
  runScheduleDryRun,
  runScheduleExecute,
  ScheduleRunnerError
} from "./schedule-runner.js";

async function executeIngestion(input: {
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  asOf?: string;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
}) {
  const ingestionRunnerModulePath = "../../api/src/ingestion-runner.js";
  const apiModule = await import(ingestionRunnerModulePath) as {
    runFixtureIngestionPipeline: (payload: typeof input) => Promise<{
      data?: { run_id?: string | null };
      meta?: { status?: string | null };
    }>;
  };
  return apiModule.runFixtureIngestionPipeline(input);
}

async function runSchedule(args: string[]) {
  try {
    const config = parseScheduleConfig(args);
    const output = config.execute
      ? await runScheduleExecute(config, { executeIngestion })
      : runScheduleDryRun(config);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (error instanceof ScheduleConfigError || error instanceof ScheduleRunnerError) {
      console.error(`Schedule error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("Schedule execution failed.");
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (isScheduleInvocation(args)) {
    await runSchedule(args);
    return;
  }

  try {
    const config = parseWorkerConfig(args);
    try {
      const outcome = await runWorker(config, { executeIngestion });
      console.log(JSON.stringify(outcome.output, null, 2));
    } catch {
      console.error(JSON.stringify(
        createWorkerOutputEnvelope(config, {
          error: {
            message: "Worker execution failed."
          }
        }),
        null,
        2
      ));
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof WorkerConfigError) {
      console.error(`Worker configuration error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("Worker execution failed.");
    process.exitCode = 1;
  }
}

void main();
