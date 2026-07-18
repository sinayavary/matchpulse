"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicMatches,
  fetchPublicStatus,
  formatFixtureLabel,
  formatScoreboard,
  type ApiMeta,
  type PublicMatchSummary,
  type PublicStatus
} from "../../lib/public-api";

type MatchRange = "all" | "live" | "starting_soon" | "upcoming" | "recently_finished" | "interrupted";
type Phase = "loading" | "loaded" | "error";

const FILTERS: Array<{ value: MatchRange; label: string }> = [
  { value: "live", label: "Live now" },
  { value: "starting_soon", label: "Starting soon" },
  { value: "upcoming", label: "Upcoming" },
  { value: "recently_finished", label: "Recently finished" },
  { value: "interrupted", label: "Postponed / interrupted" },
  { value: "all", label: "All matches" }
];

const REFRESH_MS: Record<MatchRange, number> = {
  live: 15_000,
  starting_soon: 30_000,
  upcoming: 60_000,
  recently_finished: 120_000,
  interrupted: 300_000,
  all: 60_000
};

function localDate(value: string | null): string {
  if (value === null) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(parsed)
    : "Date unavailable";
}

function localTime(value: string | null): string {
  if (value === null) return "Start time unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed)
    : "Start time unavailable";
}

function countdown(value: string | null, now: number): string {
  if (value === null) return "Start time unavailable";
  const delta = new Date(value).getTime() - now;
  if (!Number.isFinite(delta)) return "Start time unavailable";
  if (delta <= 0) return "Started";
  const minutes = Math.floor(delta / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  return days > 0 ? `Starts in ${days}d ${hours}h` : `Starts in ${hours}h ${remainder}m`;
}

function availabilityLabel(value: string): string {
  return {
    available: "Available",
    not_expected_yet: "No score expected yet",
    not_attempted: "Not attempted",
    upstream_no_data: "Upstream has not supplied data",
    stale: "Data delayed",
    upstream_error: "Upstream error",
    unsupported: "Not supported"
  }[value] ?? "Data status unknown";
}

export default function MatchesBrowser() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [range, setRange] = useState<MatchRange>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [matches, setMatches] = useState<PublicMatchSummary[]>([]);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [error, setError] = useState("Unable to load public matches.");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      if (matches.length === 0) setPhase("loading");
      setError("");
      setNextCursor(null);
      const [statusResult, matchesResult] = await Promise.all([
        fetchPublicStatus(),
        fetchPublicMatches({ range, limit: 50 }, controller.signal)
      ]);
      if (cancelled) return;
      if (statusResult.ok && statusResult.data) setStatus(statusResult.data);
      if (!matchesResult.ok || !matchesResult.data) {
        setMeta(matchesResult.meta);
        setError(matchesResult.meta?.message ?? "Public match list is temporarily unavailable; showing the last valid data.");
        setPhase(matches.length > 0 ? "loaded" : "error");
        return;
      }
      setMatches(matchesResult.data);
      setMeta(matchesResult.meta);
      setNextCursor(matchesResult.meta?.next_cursor ?? null);
      setHasMore(matchesResult.meta?.has_more === true);
      setPhase("loaded");
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [range, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), REFRESH_MS[range]);
    return () => window.clearInterval(timer);
  }, [range]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPublicMatches({ range, limit: 50, cursor: nextCursor });
    setLoadingMore(false);
    if (!result.ok || !result.data) {
      setError(result.meta?.message ?? "More matches are temporarily unavailable.");
      return;
    }
    setMatches((current) => {
      const byId = new Map(current.map((match) => [match.fixture_id, match]));
      for (const match of result.data ?? []) byId.set(match.fixture_id, match);
      return [...byId.values()];
    });
    setMeta(result.meta);
    setNextCursor(result.meta?.next_cursor ?? null);
    setHasMore(result.meta?.has_more === true);
  }

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, PublicMatchSummary[]>();
    for (const match of matches) {
      const key = localDate(match.start_time_utc);
      groups.set(key, [...(groups.get(key) ?? []), match]);
    }
    return [...groups.entries()];
  }, [matches]);

  return (
    <main className="container matches-page">
      <div className="matches-header">
        <div className="badge">Public API{status ? ` - ${status.public_api_version}` : ""}</div>
        <h1>Match catalog</h1>
        <p className="subtitle">Lifecycle-aware match data with local times, freshness, and precise availability reasons.</p>
      </div>

      <section className="matches-toolbar card" aria-label="Match catalog filters">
        <div className="filter-row">
          {FILTERS.map((filter) => (
            <button key={filter.value} className={`button filter-button ${range === filter.value ? "active" : ""}`} onClick={() => setRange(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mini-meta" aria-live="polite">
          <span>status: {meta?.status ?? (phase === "loading" ? "loading" : "unknown")}</span>
          <span>source: {meta?.source ?? "unknown"}</span>
          <span>results: {meta?.result_count ?? matches.length}</span>
          <span>deduplicated: {meta?.deduplicated_count ?? 0}</span>
        </div>
      </section>

      {phase === "loading" && matches.length === 0 ? <section className="card"><p className="muted">Loading match catalog...</p></section> : null}
      {error && matches.length > 0 ? <p className="matches-error" role="status">{error}</p> : null}
      {phase === "error" ? <section className="card"><p className="matches-error">{error}</p><button className="button" onClick={() => setRefreshKey((value) => value + 1)} type="button">Retry</button></section> : null}
      {phase === "loaded" && matches.length === 0 ? <section className="card"><h2>No matches for this range</h2><p className="muted">No verified catalog rows match this lifecycle range yet.</p></section> : null}

      {phase === "loaded" && matches.length > 0 ? (
        <div>
          {groupedMatches.map(([date, dateMatches]) => (
            <section key={date} aria-labelledby={`matches-${date}`}>
              <h2 id={`matches-${date}`}>{date}</h2>
              <div className="grid match-card-grid">
                {dateMatches.map((match) => (
                  <Link className="card match-card" href={`/matches/${match.fixture_id}`} key={match.fixture_id}>
                    <div className="match-card-top">
                      <span className="status">{match.lifecycle.lifecycle}{match.lifecycle.is_active ? " · LIVE" : ""}</span>
                      <span className="muted match-card-time">{localTime(match.start_time_utc)}</span>
                    </div>
                    <h3>{formatFixtureLabel(match)}</h3>
                    <p className="muted">{match.lifecycle.is_terminal ? "Finished" : match.lifecycle.is_active ? "Live" : countdown(match.start_time_utc, clock)}</p>
                    <p className="muted">{match.competition ?? "Competition unavailable"}</p>
                    <div className="match-stat-grid">
                      <div><span className="mini-label">Score</span><strong>{match.availability.score === "available" ? formatScoreboard(match.scoreboard) : availabilityLabel(match.availability.score)}</strong></div>
                      <div><span className="mini-label">Odds</span><strong>{match.odds.available ? `Available (${match.odds.count})` : availabilityLabel(match.availability.odds)}</strong></div>
                      <div><span className="mini-label">Quality</span><strong>{match.quality.status}</strong></div>
                      <div><span className="mini-label">Events</span><strong>{availabilityLabel(match.availability.events)}</strong></div>
                    </div>
                    <p className="muted match-card-time">{match.latest_data_timestamp ? `Latest data: ${localTime(match.latest_data_timestamp)}` : "Latest data unavailable"}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {hasMore ? <button className="button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button> : null}
        </div>
      ) : null}
    </main>
  );
}
