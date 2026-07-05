import { getDbClient } from "./db.js";

const DEMO_FIXTURE_ID = "17952170";

type DemoFixture = {
  fixture_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  start_time_utc: string | null;
  status: string;
};

type DemoMatchState = {
  fixture_id: string;
  home_score: number | null;
  away_score: number | null;
  phase: string;
  market_mood: string;
};

export type DemoSeedVerification = {
  data: {
    fixture_found: boolean;
    match_state_found: boolean;
    fixture: DemoFixture | null;
    match_state: DemoMatchState | null;
  };
  meta: {
    status: "live" | "no_data" | "degraded";
    source: "database";
  };
};

type DemoSeedRows = {
  fixtureId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTimeUtc: Date | null;
  status: string;
  matchState: {
    fixtureId: string;
    homeScore: number | null;
    awayScore: number | null;
    phase: string;
    marketMood: string;
  } | null;
} | null;

type DemoSeedVerificationOptions = {
  databaseUrl?: string | null;
  findFixture?: () => Promise<DemoSeedRows>;
};

async function findDemoFixture(): Promise<DemoSeedRows> {
  return getDbClient().fixture.findUnique({
    where: { fixtureId: DEMO_FIXTURE_ID },
    select: {
      fixtureId: true,
      competition: true,
      homeTeam: true,
      awayTeam: true,
      startTimeUtc: true,
      status: true,
      matchState: {
        select: {
          fixtureId: true,
          homeScore: true,
          awayScore: true,
          phase: true,
          marketMood: true
        }
      }
    }
  });
}

function emptyResult(status: "no_data" | "degraded"): DemoSeedVerification {
  return {
    data: {
      fixture_found: false,
      match_state_found: false,
      fixture: null,
      match_state: null
    },
    meta: { status, source: "database" }
  };
}

export async function verifyDemoSeed({
  databaseUrl = process.env.DATABASE_URL,
  findFixture = findDemoFixture
}: DemoSeedVerificationOptions = {}): Promise<DemoSeedVerification> {
  if (!databaseUrl) return emptyResult("no_data");

  try {
    const row = await findFixture();
    if (row === null) return emptyResult("no_data");

    return {
      data: {
        fixture_found: true,
        match_state_found: row.matchState !== null,
        fixture: {
          fixture_id: row.fixtureId,
          competition: row.competition,
          home_team: row.homeTeam,
          away_team: row.awayTeam,
          start_time_utc: row.startTimeUtc?.toISOString() ?? null,
          status: row.status
        },
        match_state: row.matchState === null ? null : {
          fixture_id: row.matchState.fixtureId,
          home_score: row.matchState.homeScore,
          away_score: row.matchState.awayScore,
          phase: row.matchState.phase,
          market_mood: row.matchState.marketMood
        }
      },
      meta: {
        status: row.matchState === null ? "no_data" : "live",
        source: "database"
      }
    };
  } catch {
    return emptyResult("degraded");
  }
}
