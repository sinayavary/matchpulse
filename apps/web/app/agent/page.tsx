"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPublicMatchBundle,
  fetchPublicMatches,
  formatFixtureLabel,
  type ApiMeta,
  type PublicMatchBundle,
  type PublicMatchSummary
} from "../../lib/public-api";

type AgentRow = {
  match: PublicMatchSummary;
  bundle: PublicMatchBundle | null;
  meta: ApiMeta | null;
};

type Phase = "loading" | "loaded" | "error";

export default function AgentPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setPhase("loading");
      setError("");
      const matchesResult = await fetchPublicMatches(
        { range: "upcoming", limit: 12 },
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!matchesResult.ok || !matchesResult.data) {
        setRows([]);
        setError(matchesResult.meta?.message ?? "Upcoming matches are temporarily unavailable.");
        setPhase("error");
        return;
      }

      // Each request is isolated so one unavailable brief does not prevent the
      // remaining match rooms from rendering.
      const nextRows = await Promise.all(matchesResult.data.map(async (match) => {
        const result = await fetchPublicMatchBundle(
          match.fixture_id,
          { includeState: true, includeSignals: true, includeBrief: true },
          controller.signal
        );
        return { match, bundle: result.data, meta: result.meta };
      }));
      if (controller.signal.aborted) return;
      setRows(nextRows);
      setPhase("loaded");
    }

    void load();
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <main className="container">
      <div className="matches-header">
        <div className="badge">Agent overview</div>
        <h1>Upcoming match intelligence</h1>
        <p className="subtitle">
          Public-safe Agent briefs for the next scheduled matches. Briefs describe
          data availability, freshness, and quality.
        </p>
        <button className="button" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
          Refresh
        </button>
      </div>

      {phase === "loading" ? <section className="card"><p className="muted">Loading Agent briefs...</p></section> : null}
      {phase === "error" ? (
        <section className="card">
          <p className="matches-error">{error}</p>
          <button className="button" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button>
        </section>
      ) : null}
      {phase === "loaded" && rows.length === 0 ? (
        <section className="card"><h2>No upcoming matches</h2><p className="muted">The catalog has not received any verified future fixtures yet.</p></section>
      ) : null}

      {phase === "loaded" && rows.length > 0 ? (
        <div className="grid match-card-grid">
          {rows.map(({ match, bundle, meta }) => {
            const brief = bundle?.brief;
            return (
              <section className="card" key={match.fixture_id}>
                <div className="match-card-top">
                  <span className="status">{match.lifecycle.lifecycle}</span>
                  <span className="muted match-card-time">{match.start_time_utc ?? "Start time unavailable"}</span>
                </div>
                <h2>{formatFixtureLabel(match)}</h2>
                <p className="muted">{match.competition ?? "Competition unavailable"}</p>
                {brief ? (
                  <>
                    <p className="demo-brief-headline">{brief.headline}</p>
                    <p className="demo-brief-overview">{brief.overview}</p>
                    <p className="muted">{brief.freshness_note}</p>
                    <p className="muted">{brief.quality_notes.length > 0 ? brief.quality_notes.join(" ") : "No additional quality notes."}</p>
                  </>
                ) : (
                  <p className="muted">Agent brief unavailable{meta?.message ? `: ${meta.message}` : "."}</p>
                )}
                <Link className="button" href={`/matches/${encodeURIComponent(match.fixture_id)}`}>Open match room</Link>
              </section>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
