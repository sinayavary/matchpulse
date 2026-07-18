"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPublicMatches,
  fetchPublicCompetitions,
  fetchPublicStatus,
  formatFixtureLabel,
  formatScoreboard,
  type ApiMeta,
  type PublicMatchSummary,
  type PublicCompetition,
  type PublicStatus
} from "../../lib/public-api";
import { customLocalDateUtcRange, localCalendarDayKey, localCalendarDayLabel, localDayUtcRange } from "../../lib/local-calendar";

type MatchRange = "all" | "live" | "starting_soon" | "upcoming" | "recently_finished" | "interrupted";
type Phase = "loading" | "loaded" | "error";
type DateFilter = "lifecycle" | "today" | "tomorrow" | "custom";

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
  // Upcoming fixtures are the primary catalog view. Live matches remain
  // available through the explicit filter, but should not hide the schedule
  // when the page is opened.
  const [range, setRange] = useState<MatchRange>("upcoming");
  const [refreshKey, setRefreshKey] = useState(0);
  const [matches, setMatches] = useState<PublicMatchSummary[]>([]);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [competitions, setCompetitions] = useState<PublicCompetition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("lifecycle");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [error, setError] = useState("Unable to load public matches.");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [lastSuccessfulRefresh, setLastSuccessfulRefresh] = useState<Date | null>(null);
  const manualRangeSelection = useRef(false);
  const requestGeneration = useRef(0);
  const loadMoreController = useRef<AbortController | null>(null);

  const dateBounds = useMemo(() => {
    if (dateFilter === "today") return localDayUtcRange(new Date());
    if (dateFilter === "tomorrow") return localDayUtcRange(new Date(), 1);
    if (dateFilter === "custom") {
      const fromDay = customLocalDateUtcRange(customFromDate);
      const toDay = customLocalDateUtcRange(customToDate);
      return fromDay && toDay && Date.parse(fromDay.from) < Date.parse(toDay.to) ? { from: fromDay.from, to: toDay.to } : null;
    }
    return null;
  }, [dateFilter, customFromDate, customToDate]);

  useEffect(() => {
    const controller = new AbortController();
    loadMoreController.current?.abort();
    setLoadingMore(false);
    const generation = ++requestGeneration.current;

    async function loadRange(selectedRange: MatchRange) {
      return fetchPublicMatches({ range: dateBounds ? "all" : selectedRange, limit: 100, competitionId: competitionId || undefined, from: dateBounds?.from, to: dateBounds?.to }, controller.signal);
    }

    async function load() {
      if (matches.length === 0) setPhase("loading");
      setError("");
      setNextCursor(null);
      if (dateFilter === "custom" && !dateBounds) {
        const statusResult = await fetchPublicStatus(controller.signal);
        if (generation !== requestGeneration.current) return;
        if (statusResult.ok && statusResult.data) setStatus(statusResult.data);
        setMatches([]);
        setMeta(null);
        setHasMore(false);
        setPhase("loaded");
        return;
      }
      const [statusResult, initialResult] = await Promise.all([
        fetchPublicStatus(controller.signal),
        loadRange(range)
      ]);
      if (generation !== requestGeneration.current) return;
      if (statusResult.ok && statusResult.data) setStatus(statusResult.data);
      const matchesResult = initialResult;
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
      setLastSuccessfulRefresh(new Date());
      setPhase("loaded");
    }

    void load();
    return () => { controller.abort(); };
  }, [range, refreshKey, competitionId, dateBounds, dateFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPublicCompetitions(controller.signal).then((result) => { if (result.ok && result.data) setCompetitions(result.data); });
    return () => controller.abort();
  }, []);

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
    const generation = requestGeneration.current;
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = controller;
    setLoadingMore(true);
    const result = await fetchPublicMatches({ range: dateBounds ? "all" : range, limit: 100, cursor: nextCursor, competitionId: competitionId || undefined, from: dateBounds?.from, to: dateBounds?.to }, controller.signal);
    if (generation !== requestGeneration.current || controller.signal.aborted) return;
    setLoadingMore(false);
    if (!result.ok || !result.data) {
      setError(result.meta?.message ?? "More matches are temporarily unavailable.");
      return;
    }
    setMatches((current) => {
      const byIdentity = new Map(current.map((match) => [match.catalog_identity || match.fixture_id, match]));
      for (const match of result.data ?? []) byIdentity.set(match.catalog_identity || match.fixture_id, match);
      return [...byIdentity.values()];
    });
    setMeta(result.meta);
    setNextCursor(result.meta?.next_cursor ?? null);
    setHasMore(result.meta?.has_more === true);
  }

  const readiness = status?.readiness;
  const degraded = (readiness?.overall !== undefined && readiness.overall !== "ready") || meta?.status === "stale" || meta?.status === "degraded";
  const noDataReason = meta?.message ?? meta?.missing_day_warnings?.[0] ?? (dateFilter === "custom" && !dateBounds ? "Choose a valid custom date." : "No verified catalog rows match the selected filters.");

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, PublicMatchSummary[]>();
    for (const match of matches) {
      const key = localCalendarDayKey(match.start_time_utc);
      groups.set(key, [...(groups.get(key) ?? []), match]);
    }
    return [...groups.entries()].map(([key, grouped]) => [key, [...grouped].sort((left, right) => {
      const leftStart = left.start_time_utc === null ? Number.POSITIVE_INFINITY : Date.parse(left.start_time_utc);
      const rightStart = right.start_time_utc === null ? Number.POSITIVE_INFINITY : Date.parse(right.start_time_utc);
      return leftStart - rightStart || left.catalog_identity.localeCompare(right.catalog_identity);
    })] as [string, PublicMatchSummary[]]);
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
            <button key={filter.value} className={`button filter-button ${range === filter.value ? "active" : ""}`} onClick={() => { manualRangeSelection.current = true; setRange(filter.value); }} type="button">
              {filter.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {(["lifecycle", "today", "tomorrow", "custom"] as DateFilter[]).map((value) => <button key={value} className={`button filter-button ${dateFilter === value ? "active" : ""}`} onClick={() => setDateFilter(value)} type="button">{value === "lifecycle" ? "Any date" : value[0]!.toUpperCase() + value.slice(1)}</button>)}
          {dateFilter === "custom" ? <><input aria-label="Custom range start" type="date" value={customFromDate} onChange={(event) => setCustomFromDate(event.target.value)} /><input aria-label="Custom range end" type="date" value={customToDate} onChange={(event) => setCustomToDate(event.target.value)} /></> : null}
          <select aria-label="Competition" value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>
            <option value="">All competitions</option>
            {competitions.map((competition) => <option key={competition.competition_id} value={competition.competition_id}>{competition.name}</option>)}
          </select>
          <button className="button" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Refresh</button>
        </div>
        <div className="mini-meta" aria-live="polite">
          <span>status: {meta?.status ?? (phase === "loading" ? "loading" : "unknown")}</span>
          <span>source: {meta?.source ?? "unknown"}</span>
          <span>results: {meta?.result_count ?? matches.length}</span>
          <span>deduplicated: {meta?.deduplicated_count ?? 0}</span>
          <span>readiness: {readiness?.overall ?? "unknown"}</span>
          <span>last refresh: {lastSuccessfulRefresh ? localTime(lastSuccessfulRefresh.toISOString()) : "not yet"}</span>
          {degraded ? <span>stale/degraded: {Object.values(readiness?.components ?? {}).find((component) => component.status !== "ready")?.reason_code ?? meta?.message ?? meta?.status ?? "degraded"}</span> : null}
        </div>
      </section>

      {phase === "loading" && matches.length === 0 ? <section className="card"><p className="muted">Loading match catalog...</p></section> : null}
      {error && matches.length > 0 ? <p className="matches-error" role="status">{error}</p> : null}
      {phase === "error" ? <section className="card"><p className="matches-error">{error}</p><button className="button" onClick={() => setRefreshKey((value) => value + 1)} type="button">Retry</button></section> : null}
      {phase === "loaded" && matches.length === 0 ? <section className="card"><h2>No matches for these filters</h2><p className="muted">{noDataReason}</p></section> : null}

      {phase === "loaded" && matches.length > 0 ? (
        <div>
          {groupedMatches.map(([date, dateMatches]) => (
            <section key={date} aria-labelledby={`matches-${date}`}>
              <h2 id={`matches-${date}`}>{localCalendarDayLabel(dateMatches[0]?.start_time_utc ?? null, new Date(clock))}</h2>
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
