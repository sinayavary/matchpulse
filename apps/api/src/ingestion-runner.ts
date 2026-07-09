import { randomUUID } from "node:crypto";
import {
  ingestTxlineFixtures,
  summarizeFixtureIngestion,
  type FixtureIngestionResult
} from "./txline-fixture-ingestion.js";
import {
  ingestTxlineScoreSnapshot,
  summarizeScoreIngestion,
  type ScoreIngestionResult
} from "./txline-score-ingestion.js";
import { ingestTxlineOddsSnapshot } from "./txline-odds-ingestion.js";
import {
  getDbBackedMatchState,
  type CanonicalMatchState
} from "./match-state-builder.js";
import {
  FALLBACK_RUNTIME_INGESTION_TARGETS,
  getRuntimeIngestionTargetsFromEnv,
  type RuntimeIngestionTargets
} from "./runtime-target-registry.js";

export type IngestionRunnerInput = {
  fixtureId: string;
  competitionId?: number | null;
  startEpochDay?: number | null;
  asOf?: string | number | null;
  includeFixture?: boolean;
  includeScore?: boolean;
  includeOdds?: boolean;
  oddsLimit?: number;
  runtimeTargets?: RuntimeIngestionTargets;
};

export type NormalizedIngestionRunnerInput = {
  fixtureId: string;
  competitionId: number | null;
  startEpochDay: number | null;
  asOf: number;
  includeFixture: boolean;
  includeScore: boolean;
  includeOdds: boolean;
  oddsLimit: number;
};

export type IngestionStepStatus = "skipped" | "live" | "no_data" | "degraded" | "error";

export type IngestionStepResult<T> = {
  attempted: boolean;
  status: IngestionStepStatus;
  summary: T | null;
  message: string | null;
};

type OddsIngestionResult = Awaited<ReturnType<typeof ingestTxlineOddsSnapshot>>;

export type IngestionRunnerDependencies = {
  ingestFixtures: (input: {
    competitionId: string;
    startEpochDay: number;
    includeRaw?: boolean;
  }) => Promise<FixtureIngestionResult>;
  ingestScore: (input: {
    fixtureId: string;
    asOf: number;
    includeRaw?: boolean;
  }) => Promise<ScoreIngestionResult>;
  ingestOdds: (input: {
    fixtureId: string;
    asOf: number;
    includeRaw?: boolean;
  }) => Promise<OddsIngestionResult>;
  buildState: (
    fixtureId: string,
    options: { includeOdds: boolean; oddsLimit: number }
  ) => Promise<CanonicalMatchState>;
  createRunId: () => string;
  getRuntimeTargets: (env?: NodeJS.ProcessEnv) => RuntimeIngestionTargets;
};

export type TargetIngestionCycleInput = {
  fixtures?: boolean;
  scores?: boolean;
  odds?: boolean;
  pressureReady?: boolean;
  dryRun?: boolean;
  runtimeTargets?: RuntimeIngestionTargets;
};

export type TargetIngestionCycleStatus = "ok" | "partial" | "failed";

export type TargetIngestionCycleTargetStatus =
  | "skipped"
  | "dry_run"
  | "ok"
  | "no_data"
  | "partial"
  | "failed";

export type TargetIngestionCycleTargetSummary = {
  attempted: boolean;
  status: TargetIngestionCycleTargetStatus;
  count?: number;
  error?: string;
};

export type TargetIngestionCycleSummary = {
  status: TargetIngestionCycleStatus;
  started_at: string;
  finished_at: string;
  targets: {
    fixtures: TargetIngestionCycleTargetSummary;
    scores: TargetIngestionCycleTargetSummary;
    odds: TargetIngestionCycleTargetSummary;
  };
  safe_scope_note: string;
};

export class IngestionRunnerValidationError extends TypeError {}

export const TARGET_INGESTION_SAFE_SCOPE_NOTE =
  "This internal runner only refreshes persisted TxLINE-derived data for demo/backend stability. It does not make predictions or betting recommendations.";

export const TARGET_FIXTURE_INGESTION_SCOPE = {
  fixtureId: "17952170",
  competitionId: 430,
  startEpochDay: 20608
} as const;

export const TARGET_SCORE_INGESTION_SCOPE = {
  fixtureId: "17952170",
  asOf: 1_780_596_263_367
} as const;

export const TARGET_ODDS_INGESTION_SCOPE = {
  fixtureId: "17588223",
  competitionId: 72,
  asOf: 1_781_226_000_000
} as const;

function optionalNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new IngestionRunnerValidationError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function normalizeAsOf(value: unknown): number {
  if (value === undefined || value === null) return Date.now();

  let epochMs: number;
  if (typeof value === "number") {
    epochMs = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    epochMs = /^[-+]?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed);
  } else {
    epochMs = Number.NaN;
  }

  if (!Number.isFinite(epochMs) || !Number.isFinite(new Date(epochMs).getTime())) {
    throw new IngestionRunnerValidationError(
      "asOf must be epoch milliseconds or a valid ISO date string."
    );
  }
  return epochMs;
}

export function normalizeIngestionRunnerInput(
  input: IngestionRunnerInput
): NormalizedIngestionRunnerInput {
  const fixtureId = typeof input?.fixtureId === "string" ? input.fixtureId.trim() : "";
  if (!fixtureId) {
    throw new IngestionRunnerValidationError("fixtureId is required.");
  }

  const competitionId = optionalNonNegativeInteger(input.competitionId, "competitionId");
  const startEpochDay = optionalNonNegativeInteger(input.startEpochDay, "startEpochDay");
  const hasFixtureWindow = competitionId !== null && startEpochDay !== null;
  if (input.includeFixture === true && !hasFixtureWindow) {
    throw new IngestionRunnerValidationError(
      "competitionId and startEpochDay are required when includeFixture is true."
    );
  }

  const requestedOddsLimit = typeof input.oddsLimit === "number" && Number.isFinite(input.oddsLimit)
    ? Math.trunc(input.oddsLimit)
    : 20;

  return {
    fixtureId,
    competitionId,
    startEpochDay,
    asOf: normalizeAsOf(input.asOf),
    includeFixture: input.includeFixture ?? hasFixtureWindow,
    includeScore: input.includeScore !== false,
    includeOdds: input.includeOdds !== false,
    oddsLimit: Math.min(50, Math.max(1, requestedOddsLimit))
  };
}

export function buildStepResult<T>(
  attempted: boolean,
  status: IngestionStepStatus,
  summary: T | null = null,
  message: string | null = null
): IngestionStepResult<T> {
  return { attempted, status, summary, message };
}

export function summarizeCanonicalState(state: CanonicalMatchState) {
  return {
    quality_status: state.quality.status,
    has_fixture: state.quality.has_fixture,
    has_scoreboard: state.quality.has_scoreboard,
    has_odds: state.quality.has_odds,
    latest_data_timestamp: state.freshness.latest_data_timestamp
  };
}

const defaultDependencies: IngestionRunnerDependencies = {
  ingestFixtures: ingestTxlineFixtures,
  ingestScore: ingestTxlineScoreSnapshot,
  ingestOdds: ingestTxlineOddsSnapshot,
  buildState: getDbBackedMatchState,
  createRunId: randomUUID,
  getRuntimeTargets: getRuntimeIngestionTargetsFromEnv
};

function buildTargetCycleSummary(
  attempted: boolean,
  status: TargetIngestionCycleTargetStatus,
  count?: number,
  error?: string
): TargetIngestionCycleTargetSummary {
  return {
    attempted,
    status,
    ...(count === undefined ? {} : { count }),
    ...(error === undefined ? {} : { error })
  };
}

function getSelectedTargetFlags(input: TargetIngestionCycleInput) {
  const defaultTargetSelection = true;
  const enableAllTargets = input.pressureReady === true;
  return {
    fixtures: input.fixtures ?? (enableAllTargets ? true : defaultTargetSelection),
    scores: input.scores ?? (enableAllTargets ? true : defaultTargetSelection),
    odds: input.odds ?? (enableAllTargets ? true : defaultTargetSelection)
  };
}

function toTargetCycleStatus(
  result: FixtureIngestionResult | ScoreIngestionResult | OddsIngestionResult
): TargetIngestionCycleTargetSummary {
  if ("upsertedCount" in result) {
    const count = result.upsertedCount;
    if (result.failedCount > 0) {
      return buildTargetCycleSummary(true, "partial", count, "Fixture refresh failed.");
    }
    if (result.fetchedCount === 0 || count === 0) {
      return buildTargetCycleSummary(true, "no_data", count);
    }
    return buildTargetCycleSummary(true, "ok", count);
  }

  if ("scoreAvailable" in result) {
    const count = result.upserted ? 1 : 0;
    if (!result.scoreAvailable || !result.upserted) {
      return buildTargetCycleSummary(true, "no_data", count);
    }
    return buildTargetCycleSummary(true, "ok", count);
  }

  const count = result.result.upserted_count;
  if (result.result.failed_count > 0) {
    return buildTargetCycleSummary(true, "partial", count, "Odds refresh failed.");
  }
  if (result.result.fetched_count === 0 || count === 0) {
    return buildTargetCycleSummary(true, "no_data", count);
  }
  return buildTargetCycleSummary(true, "ok", count);
}

export async function runTargetIngestionCycle(
  input: TargetIngestionCycleInput = {},
  dependencies: Partial<IngestionRunnerDependencies> = {}
): Promise<TargetIngestionCycleSummary> {
  const deps = { ...defaultDependencies, ...dependencies };
  const selected = getSelectedTargetFlags(input);
  const runtimeTargets = input.runtimeTargets ?? deps.getRuntimeTargets(process.env);
  const fixtureTarget = runtimeTargets.fixtures[0] ?? FALLBACK_RUNTIME_INGESTION_TARGETS.fixtures[0];
  const scoreTarget = runtimeTargets.scores[0] ?? FALLBACK_RUNTIME_INGESTION_TARGETS.scores[0];
  const oddsTarget = runtimeTargets.odds[0] ?? FALLBACK_RUNTIME_INGESTION_TARGETS.odds[0];
  const startedAt = new Date().toISOString();

  if (input.dryRun === true) {
    const dryRunTarget = (enabled: boolean) =>
      enabled
        ? buildTargetCycleSummary(false, "dry_run", 0)
        : buildTargetCycleSummary(false, "skipped", 0);

    return {
      status: "ok",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      targets: {
        fixtures: dryRunTarget(selected.fixtures),
        scores: dryRunTarget(selected.scores),
        odds: dryRunTarget(selected.odds)
      },
      safe_scope_note: TARGET_INGESTION_SAFE_SCOPE_NOTE
    };
  }

  let fixtures = selected.fixtures
    ? buildTargetCycleSummary(true, "failed", 0, "Fixture refresh failed.")
    : buildTargetCycleSummary(false, "skipped", 0);
  let scores = selected.scores
    ? buildTargetCycleSummary(true, "failed", 0, "Score refresh failed.")
    : buildTargetCycleSummary(false, "skipped", 0);
  let odds = selected.odds
    ? buildTargetCycleSummary(true, "failed", 0, "Odds refresh failed.")
    : buildTargetCycleSummary(false, "skipped", 0);

  if (selected.fixtures) {
    try {
      fixtures = toTargetCycleStatus(await deps.ingestFixtures({
        competitionId: String(fixtureTarget.competitionId),
        startEpochDay: fixtureTarget.startEpochDay,
        includeRaw: false
      }));
    } catch {
      fixtures = buildTargetCycleSummary(true, "failed", 0, "Fixture refresh failed.");
    }
  }

  if (selected.scores) {
    try {
      scores = toTargetCycleStatus(await deps.ingestScore({
        fixtureId: scoreTarget.fixtureId,
        asOf: scoreTarget.asOf,
        includeRaw: false
      }));
    } catch {
      scores = buildTargetCycleSummary(true, "failed", 0, "Score refresh failed.");
    }
  }

  if (selected.odds) {
    try {
      odds = toTargetCycleStatus(await deps.ingestOdds({
        fixtureId: oddsTarget.fixtureId,
        asOf: oddsTarget.asOf,
        includeRaw: false
      }));
    } catch {
      odds = buildTargetCycleSummary(true, "failed", 0, "Odds refresh failed.");
    }
  }

  const attemptedTargets = [fixtures, scores, odds].filter((target) => target.attempted);
  const hasFailedTarget = attemptedTargets.some((target) => target.status === "failed");
  const hasPartialTarget = attemptedTargets.some((target) => target.status === "partial");
  const hasSuccessTarget = attemptedTargets.some((target) => target.status === "ok");

  const status: TargetIngestionCycleStatus = hasFailedTarget
    ? hasSuccessTarget || hasPartialTarget ? "partial" : "failed"
    : hasPartialTarget ? "partial" : "ok";

  return {
    status,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    targets: {
      fixtures,
      scores,
      odds
    },
    safe_scope_note: TARGET_INGESTION_SAFE_SCOPE_NOTE
  };
}

export async function runFixtureIngestionPipeline(
  rawInput: IngestionRunnerInput,
  dependencies: Partial<IngestionRunnerDependencies> = {}
) {
  const input = normalizeIngestionRunnerInput(rawInput);
  const deps = { ...defaultDependencies, ...dependencies };

  let fixtureIngest = buildStepResult<Record<string, unknown>>(false, "skipped");
  let scoreIngest = buildStepResult<Record<string, unknown>>(false, "skipped");
  let oddsIngest = buildStepResult<Record<string, unknown>>(false, "skipped");

  if (input.includeFixture && input.competitionId !== null && input.startEpochDay !== null) {
    try {
      const result = await deps.ingestFixtures({
        competitionId: String(input.competitionId),
        startEpochDay: input.startEpochDay,
        includeRaw: false
      });
      const targetIncluded = result.fixtures.some((fixture) => fixture.fixture_id === input.fixtureId);
      const status = result.failedCount > 0
        ? "degraded" as const
        : result.fetchedCount === 0 ? "no_data" as const : "live" as const;
      fixtureIngest = buildStepResult(true, status, {
        ...summarizeFixtureIngestion(result),
        target_fixture_included: targetIncluded
      });
    } catch {
      fixtureIngest = buildStepResult<Record<string, unknown>>(
        true, "error", null, "Fixture ingestion failed."
      );
    }
  }

  if (input.includeScore) {
    try {
      const result = await deps.ingestScore({
        fixtureId: input.fixtureId,
        asOf: input.asOf,
        includeRaw: false
      });
      scoreIngest = buildStepResult(
        true,
        result.scoreAvailable ? "live" : "no_data",
        summarizeScoreIngestion(result)
      );
    } catch {
      scoreIngest = buildStepResult<Record<string, unknown>>(
        true, "error", null, "Score ingestion failed."
      );
    }
  }

  if (input.includeOdds) {
    try {
      const result = await deps.ingestOdds({
        fixtureId: input.fixtureId,
        asOf: input.asOf,
        includeRaw: false
      });
      const status = result.result.failed_count > 0
        ? "degraded" as const
        : result.result.fetched_count === 0 ? "no_data" as const : "live" as const;
      oddsIngest = buildStepResult(true, status, result.result);
    } catch {
      oddsIngest = buildStepResult<Record<string, unknown>>(
        true, "error", null, "Odds ingestion failed."
      );
    }
  }

  let state: CanonicalMatchState | null = null;
  let stateBuild: IngestionStepResult<ReturnType<typeof summarizeCanonicalState>>;
  try {
    state = await deps.buildState(input.fixtureId, {
      includeOdds: input.includeOdds,
      oddsLimit: input.oddsLimit
    });
    const status = state.quality.status === "complete"
      ? "live" as const
      : state.quality.status === "partial" ? "degraded" as const : "no_data" as const;
    stateBuild = buildStepResult(true, status, summarizeCanonicalState(state));
  } catch {
    stateBuild = buildStepResult<ReturnType<typeof summarizeCanonicalState>>(
      true, "error", null, "Canonical state build failed."
    );
  }

  const hasStepFailure = [fixtureIngest, scoreIngest, oddsIngest]
    .some((step) => step.attempted && (step.status === "error" || step.status === "degraded"));
  const metaStatus = stateBuild.status === "no_data"
    ? "no_data" as const
    : stateBuild.status !== "live" || hasStepFailure
      ? "degraded" as const
      : "live" as const;

  return {
    data: {
      run_id: deps.createRunId(),
      fixture_id: input.fixtureId,
      requested: {
        fixture_id: input.fixtureId,
        competition_id: input.competitionId,
        start_epoch_day: input.startEpochDay,
        as_of: new Date(input.asOf).toISOString(),
        include_fixture: input.includeFixture,
        include_score: input.includeScore,
        include_odds: input.includeOdds
      },
      steps: {
        fixture_ingest: fixtureIngest,
        score_ingest: scoreIngest,
        odds_ingest: oddsIngest,
        state_build: stateBuild
      },
      state
    },
    meta: {
      status: metaStatus,
      source: "database" as const,
      mode: "internal" as const
    }
  };
}
