"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPublicMatches,
  fetchPublicStatus,
  formatFixtureLabel,
  formatScoreboard,
  type ApiMeta,
  type PublicMatchSummary,
  type PublicStatus
} from "../../lib/public-api";

type MatchRange = "all" | "past" | "upcoming" | "live";
type Phase = "loading" | "loaded" | "error";

const FILTERS: MatchRange[] = ["all", "past", "upcoming", "live"];

export default function MatchesBrowser() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [range, setRange] = useState<MatchRange>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [matches, setMatches] = useState<PublicMatchSummary[]>([]);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [error, setError] = useState("Unable to load public matches.");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase("loading");
      setError("");

      const [statusResult, matchesResult] = await Promise.all([
        fetchPublicStatus(),
        fetchPublicMatches({ range, limit: 50 })
      ]);

      if (cancelled) return;

      if (statusResult.ok && statusResult.data) {
        setStatus(statusResult.data);
      }

      if (!matchesResult.ok || !matchesResult.data) {
        setMatches([]);
        setMeta(matchesResult.meta);
        setError(matchesResult.meta?.message ?? "Public match list is unavailable right now.");
        setPhase("error");
        return;
      }

      setMatches(matchesResult.data);
      setMeta(matchesResult.meta);
      setPhase("loaded");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [range, refreshKey]);

  return (
    <main className="container matches-page">
      <div className="matches-header">
        <div className="badge">
          Public API
          {status ? ` - ${status.public_api_version}` : ""}
        </div>
        <h1>Match browser</h1>
        <p className="subtitle">
          Browse public match data with safe visibility into score, odds availability,
          freshness, and quality.
        </p>
      </div>

      <section className="matches-toolbar card">
        <div className="filter-row">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              className={`button filter-button ${range === filter ? "active" : ""}`}
              onClick={() => setRange(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="mini-meta">
          <span>status: {meta?.status ?? (phase === "loading" ? "loading" : "unknown")}</span>
          <span>source: {meta?.source ?? "unknown"}</span>
          <span>mode: {meta?.mode ?? "unknown"}</span>
        </div>
      </section>

      {phase === "loading" ? (
        <section className="card">
          <p className="muted">Loading public matches...</p>
        </section>
      ) : null}

      {phase === "error" ? (
        <section className="card">
          <p className="matches-error">{error}</p>
          <button className="button" onClick={() => setRefreshKey((value) => value + 1)} type="button">
            Retry
          </button>
        </section>
      ) : null}

      {phase === "loaded" && matches.length === 0 ? (
        <section className="card">
          <h3>No matches for this range</h3>
          <p className="muted">
            Try a different filter or refresh when more public data is available.
          </p>
        </section>
      ) : null}

      {phase === "loaded" && matches.length > 0 ? (
        <section className="grid match-card-grid">
          {matches.map((match) => (
            <Link className="card match-card" href={`/matches/${match.fixture_id}`} key={match.fixture_id}>
              <div className="match-card-top">
                <span className="status">{match.status ?? "unknown"}</span>
                <span className="muted match-card-time">
                  {match.start_time_utc ?? "Start time unavailable"}
                </span>
              </div>
              <h3>{formatFixtureLabel(match)}</h3>
              <p className="muted">{match.competition ?? "Competition unavailable"}</p>
              <div className="match-stat-grid">
                <div>
                  <span className="mini-label">Score</span>
                  <strong>{formatScoreboard(match.scoreboard)}</strong>
                </div>
                <div>
                  <span className="mini-label">Odds</span>
                  <strong>{match.odds.available ? `Available (${match.odds.count})` : "Unavailable"}</strong>
                </div>
                <div>
                  <span className="mini-label">Quality</span>
                  <strong>{match.quality.status}</strong>
                </div>
                <div>
                  <span className="mini-label">Issues</span>
                  <strong>
                    {match.quality.issues.length > 0 ? match.quality.issues.join(", ") : "none"}
                  </strong>
                </div>
              </div>
              <p className="muted match-card-time">
                latest data: {match.latest_data_timestamp ?? "unavailable"}
              </p>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}
