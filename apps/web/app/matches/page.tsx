import Link from "next/link";
import { getApi } from "../../lib/api";

type Match = { fixture_id: string; home_team: string; away_team: string; start_time_utc: string; status: string; competition: string };
type ApiResponse<T> = { data: T; meta: { status: string; source: string; mode: string } };

const fallback: Match[] = [
  { fixture_id: "18175918", home_team: "Argentina", away_team: "Cape Verde", start_time_utc: "2026-07-03T22:00:00Z", status: "mock", competition: "World Cup" }
];

export default async function MatchesPage() {
  const result = await getApi<ApiResponse<Match[]>>("/api/matches");
  const matches = result?.data ?? fallback;

  return (
    <main className="container">
      <div className="badge">Matches · {result?.meta.status ?? "mock fallback"}</div>
      <h1>World Cup match rooms</h1>
      <div className="grid">
        {matches.map((match) => (
          <Link className="card" href={`/matches/${match.fixture_id}`} key={match.fixture_id}>
            <span className="status">{match.status}</span>
            <h3>{match.home_team} vs {match.away_team}</h3>
            <p className="muted">{match.competition} · {match.start_time_utc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
