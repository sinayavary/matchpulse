import { formatWorkerPlan, type WorkerConfig } from "./worker-config.js";

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
  planText: string;
  executed: boolean;
  result: null | {
    fixtureId: string;
    mode: "execute";
    metaStatus: string | null;
    runId: string | null;
  };
};

export async function runWorker(
  config: WorkerConfig,
  dependencies: WorkerRunnerDependencies
): Promise<WorkerRunResult> {
  const planText = formatWorkerPlan(config);
  if (!config.execute) {
    return {
      planText,
      executed: false,
      result: null
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
    planText,
    executed: true,
    result: {
      fixtureId: config.fixtureId,
      mode: "execute",
      metaStatus: response.meta?.status ?? null,
      runId: response.data?.run_id ?? null
    }
  };
}
