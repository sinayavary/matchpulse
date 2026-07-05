import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { parseWorkerConfig, WorkerConfigError } from "./worker-config.js";
import { runWorker } from "./worker-runner.js";

function findRepoRoot(): string {
  let current = process.cwd();
  for (let index = 0; index < 8; index += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(process.cwd(), "..", "..");
}

function loadWorkerEnv(): void {
  const envPath = path.join(findRepoRoot(), ".env");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

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
    loadWorkerEnv();
    const config = parseWorkerConfig(process.argv.slice(2));
    const outcome = await runWorker(config, { executeIngestion });

    console.log(outcome.planText);
    if (!outcome.executed) {
      console.log("Dry-run only. No ingestion was executed.");
      return;
    }

    console.log(JSON.stringify(outcome.result, null, 2));
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
