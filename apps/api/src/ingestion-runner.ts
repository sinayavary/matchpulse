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

export type IngestionRunnerInput = {
  fixtureId: string;
  competitionId?: number | null;
  startEpochDay?: number | null;
  asOf?: string | number | null;
  includeFixture?: boolean;
  includeScore?: boolean;
  includeOdds?: boolean;
  oddsLimit?: number;
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
};

export class IngestionRunnerValidationError extends TypeError {}

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
  createRunId: randomUUID
};

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
