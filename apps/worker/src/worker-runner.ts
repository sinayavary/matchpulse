import { type WorkerConfig } from "./worker-config.js";
import { createWorkerOutputEnvelope, type WorkerOutputEnvelope } from "./worker-safety.js";

export type WorkerRunnerDependencies = {
  executeIngestion: (input: {
    fixtureId: string;
    competitionId: number;
    startEpochDay: number;
    asOf?: string;
    includeFixture: boolean;
    includeScore: boolean;
    includeOdds: boolean;
    oddsLimit: number;
  }) => Promise<{
    data?: { run_id?: string | null };
    meta?: { status?: string | null };
  }>;
};

export type WorkerRunResult = {
  output: WorkerOutputEnvelope;
  executed: boolean;
};

export async function runWorker(
  config: WorkerConfig,
  dependencies: WorkerRunnerDependencies
): Promise<WorkerRunResult> {
  if (!config.execute) {
    return {
      output: createWorkerOutputEnvelope(config),
      executed: false,
    };
  }

  const response = await dependencies.executeIngestion({
    fixtureId: config.fixtureId,
    competitionId: config.competitionId,
    startEpochDay: config.startEpochDay,
    ...(config.asOf === undefined ? {} : { asOf: config.asOf }),
    includeFixture: config.includeFixture,
    includeScore: config.includeScore,
    includeOdds: config.includeOdds,
    oddsLimit: config.oddsLimit
  });

  return {
    output: createWorkerOutputEnvelope(config, {
      result: {
        fixtureId: config.fixtureId,
        metaStatus: response.meta?.status ?? null,
        runId: response.data?.run_id ?? null
      }
    }),
    executed: true,
  };
}
