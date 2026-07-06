import { parseWorkerConfig, WorkerConfigError } from "./worker-config.js";
import { runWorker } from "./worker-runner.js";
import { createWorkerOutputEnvelope } from "./worker-safety.js";

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

async function main() {
  try {
    const config = parseWorkerConfig(process.argv.slice(2));
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
