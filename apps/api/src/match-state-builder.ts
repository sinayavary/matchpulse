import { getDbClient } from "./db.js";
import { resolveMatchLifecycle, type MatchLifecycleResult } from "./match-lifecycle.js";

export type CanonicalLifecycleState = Pick<MatchLifecycleResult, "lifecycle" | "source" | "reason_code" | "normalized_phase" | "is_active" | "is_terminal" | "updated_at">;

export type MatchStateBuilderOptions = {
  includeOdds?: boolean;
  oddsLimit?: number;
};

type FixtureInput = {
  fixtureId: string;
  competition: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeUtc: Date | null;
  status: string | null;
};

type ScoreboardInput = {
  homeScore: number | null;
  awayScore: number | null;
  phase: string | null;
  lastDataReceivedAt: Date | null;
};

type OddsInput = {
  marketId: string;
  marketName: string | null;
  selectionName: string;
  odds: number | { toNumber(): number };
  direction: string;
  sourceTimestamp: Date | null;
};

export type MatchStateBuilderInput = {
  fixtureId: string;
  fixture: FixtureInput | null;
  scoreboard: ScoreboardInput | null;
  odds: OddsInput[];
  includeOdds?: boolean;
  builtAt?: Date;
};

export type CanonicalMatchState = {
  fixture_id: string;
  lifecycle?: CanonicalLifecycleState;
  identity: {
    fixture_id: string;
    competition: string | null;
    home_team: string | null;
    away_team: string | null;
    start_time_utc: string | null;
    status: string | null;
  };
  scoreboard: {
    available: boolean;
    home_score: number | null;
    away_score: number | null;
    phase: string | null;
    last_data_received_at: string | null;
  };
  odds: {
    available: boolean;
    count: number;
    markets: Array<{
      market_id: string;
      market_name: string | null;
      selection_name: string;
      odds: number;
      direction: string;
      source_timestamp: string | null;
    }>;
  };
  freshness: {
    built_at: string;
    latest_score_timestamp: string | null;
    latest_odds_timestamp: string | null;
    latest_data_timestamp: string | null;
  };
  quality: {
    status: "complete" | "partial" | "empty";
    has_fixture: boolean;
    has_scoreboard: boolean;
    has_odds: boolean;
    issues: string[];
  };
};

export function normalizeMatchStateOptions(
  options: MatchStateBuilderOptions = {}
): Required<MatchStateBuilderOptions> {
  const requestedLimit = typeof options.oddsLimit === "number" && Number.isFinite(options.oddsLimit)
    ? Math.trunc(options.oddsLimit)
    : 20;

  return {
    includeOdds: options.includeOdds !== false,
    oddsLimit: Math.min(50, Math.max(1, requestedLimit))
  };
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function latestTimestamp(values: Array<Date | null>): string | null {
  const timestamps = values
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime())
    .filter(Number.isFinite);
  return timestamps.length === 0 ? null : new Date(Math.max(...timestamps)).toISOString();
}

export function buildCanonicalMatchState(input: MatchStateBuilderInput): CanonicalMatchState {
  const includeOdds = input.includeOdds !== false;
  const odds = includeOdds ? input.odds : [];
  const hasFixture = input.fixture !== null;
  const hasScoreboard = input.scoreboard !== null;
  const hasOdds = odds.length > 0;
  const hasIdentity = input.fixture !== null &&
    input.fixture.competition !== null &&
    input.fixture.homeTeam !== null &&
    input.fixture.awayTeam !== null;
  const issues: string[] = [];

  if (!hasFixture) issues.push("fixture_missing");
  if (!hasScoreboard) issues.push("scoreboard_missing");
  if (!hasOdds) issues.push("odds_missing");
  if (hasFixture && !hasIdentity) issues.push("identity_incomplete");
  if (!hasFixture && !hasScoreboard && !hasOdds) issues.push("no_persisted_data");

  const qualityStatus = !hasFixture && !hasScoreboard && !hasOdds
    ? "empty" as const
    : hasFixture && (hasScoreboard || hasOdds)
      ? "complete" as const
      : "partial" as const;
  const latestScoreTimestamp = iso(input.scoreboard?.lastDataReceivedAt ?? null);
  const latestOddsTimestamp = latestTimestamp(odds.map((row) => row.sourceTimestamp));
  const latestDataTimestamp = latestTimestamp([
    input.scoreboard?.lastDataReceivedAt ?? null,
    ...odds.map((row) => row.sourceTimestamp)
  ]);
  const resolvedLifecycle = resolveMatchLifecycle({
    providerStatus: input.fixture?.status,
    persistedPhase: input.scoreboard?.phase,
    startTimeUtc: input.fixture?.startTimeUtc,
    now: input.builtAt ?? new Date(),
    captureLeadMinutes: 60,
    hasScoreOrEventEvidence: hasScoreboard
  });

  const lifecycle: CanonicalLifecycleState = {
    lifecycle: resolvedLifecycle.lifecycle,
    source: resolvedLifecycle.source,
    reason_code: resolvedLifecycle.reason_code,
    normalized_phase: resolvedLifecycle.normalized_phase,
    is_active: resolvedLifecycle.is_active,
    is_terminal: resolvedLifecycle.is_terminal,
    updated_at: resolvedLifecycle.updated_at
  };

  return {
    fixture_id: input.fixtureId,
    lifecycle,
    identity: {
      fixture_id: input.fixtureId,
      competition: input.fixture?.competition ?? null,
      home_team: input.fixture?.homeTeam ?? null,
      away_team: input.fixture?.awayTeam ?? null,
      start_time_utc: iso(input.fixture?.startTimeUtc ?? null),
      status: input.fixture?.status ?? null
    },
    scoreboard: {
      available: hasScoreboard,
      home_score: input.scoreboard?.homeScore ?? null,
      away_score: input.scoreboard?.awayScore ?? null,
      phase: input.scoreboard?.phase ?? null,
      last_data_received_at: latestScoreTimestamp
    },
    odds: {
      available: hasOdds,
      count: odds.length,
      markets: odds.map((row) => ({
        market_id: row.marketId,
        market_name: row.marketName,
        selection_name: row.selectionName,
        odds: typeof row.odds === "number" ? row.odds : row.odds.toNumber(),
        direction: row.direction,
        source_timestamp: iso(row.sourceTimestamp)
      }))
    },
    freshness: {
      built_at: (input.builtAt ?? new Date()).toISOString(),
      latest_score_timestamp: latestScoreTimestamp,
      latest_odds_timestamp: latestOddsTimestamp,
      latest_data_timestamp: latestDataTimestamp
    },
    quality: {
      status: qualityStatus,
      has_fixture: hasFixture,
      has_scoreboard: hasScoreboard,
      has_odds: hasOdds,
      issues
    }
  };
}

export async function getDbBackedMatchState(
  fixtureId: string,
  options: MatchStateBuilderOptions = {}
): Promise<CanonicalMatchState> {
  const normalized = normalizeMatchStateOptions(options);
  const db = getDbClient();
  const [fixture, scoreboard, odds] = await Promise.all([
    db.fixture.findUnique({
      where: { fixtureId },
      select: {
        fixtureId: true,
        competition: true,
        homeTeam: true,
        awayTeam: true,
        startTimeUtc: true,
        status: true
      }
    }),
    db.matchState.findUnique({
      where: { fixtureId },
      select: {
        homeScore: true,
        awayScore: true,
        phase: true,
        lastDataReceivedAt: true
      }
    }),
    normalized.includeOdds
      ? db.oddsSnapshot.findMany({
        where: { fixtureId },
        orderBy: [{ sourceTimestamp: "desc" }, { createdAt: "desc" }],
        take: normalized.oddsLimit,
        select: {
          marketId: true,
          marketName: true,
          selectionName: true,
          odds: true,
          direction: true,
          sourceTimestamp: true
        }
      })
      : Promise.resolve([])
  ]);

  return buildCanonicalMatchState({
    fixtureId,
    fixture,
    scoreboard,
    odds,
    includeOdds: normalized.includeOdds
  });
}
