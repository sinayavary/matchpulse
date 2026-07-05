"use client";

import { useEffect, useState } from "react";
import RawJsonToggle from "../public/RawJsonToggle";
import {
  fetchPublicMatch,
  fetchPublicMatchBundle,
  formatScoreboard,
  sanitizeSafeScopeNote,
  type ApiMeta,
  type PublicMatchBundle,
  type PublicMatchState
} from "../../lib/public-api";

type Phase = "loading" | "loaded" | "error";

export default function MatchDetailView({ fixtureId }: { fixtureId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [match, setMatch] = useState<PublicMatchState | null>(null);
  const [bundle, setBundle] = useState<PublicMatchBundle | null>(null);
  const [matchMeta, setMatchMeta] = useState<ApiMeta | null>(null);
  const [bundleMeta, setBundleMeta] = useState<ApiMeta | null>(null);
  const [error, setError] = useState("Unable to load public match detail.");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase("loading");
      setError("");

      const [matchResult, bundleResult] = await Promise.all([
        fetchPublicMatch(fixtureId, { includeOdds: true, oddsLimit: 20 }),
        fetchPublicMatchBundle(fixtureId, {
          includeState: true,
          includeSignals: true,
          includeBrief: true,
          oddsLimit: 20
        })
      ]);

      if (cancelled) return;

      if (!matchResult.ok || !bundleResult.ok || !matchResult.data || !bundleResult.data) {
        setMatch(matchResult.data);
        setBundle(bundleResult.data);
        setMatchMeta(matchResult.meta);
        setBundleMeta(bundleResult.meta);
        setError(
          bundleResult.meta?.message ??
            matchResult.meta?.message ??
            "Public match detail is unavailable right now."
        );
        setPhase("error");
        return;
      }

      setMatch(matchResult.data);
      setBundle(bundleResult.data);
      setMatchMeta(matchResult.meta);
      setBundleMeta(bundleResult.meta);
      setPhase("loaded");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fixtureId, refreshKey]);

  const state = bundle?.state ?? match;
  const identity = state?.identity;
  const scoreText = state ? formatScoreboard(state.scoreboard) : "Scoreboard missing";
  const signalSummary = bundle?.signal_summary;
  const brief = bundle?.brief;
  const readiness = bundle?.readiness;

  return (
    <main className="container match-detail-page">
      <div className="matches-header">
        <div className="badge">Public match room</div>
        <h1>{identity ? `${identity.home_team ?? "Home"} vs ${identity.away_team ?? "Away"}` : fixtureId}</h1>
        <p className="subtitle">
          {identity?.competition ?? "Competition unavailable"} - {identity?.start_time_utc ?? "Start time unavailable"} - {identity?.status ?? "Status unavailable"}
        </p>
        <div className="mini-meta">
          <span>status: {bundleMeta?.status ?? matchMeta?.status ?? "unknown"}</span>
          <span>source: {bundleMeta?.source ?? matchMeta?.source ?? "unknown"}</span>
          <span>mode: {bundleMeta?.mode ?? matchMeta?.mode ?? "unknown"}</span>
        </div>
      </div>

      <div className="detail-actions">
        <button className="button" onClick={() => setRefreshKey((value) => value + 1)} type="button">
          Refresh
        </button>
      </div>

      {phase === "loading" ? (
        <section className="card">
          <p className="muted">Loading public match detail...</p>
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

      {phase === "loaded" && state && bundle ? (
        <>
          <section className="grid cols-3">
            <div className="card strong">
              <h3>Scoreboard</h3>
              <div className="kpi detail-score">{scoreText}</div>
              <p className="muted">
                {state.scoreboard.available
                  ? state.scoreboard.last_data_received_at ?? "Score timestamp unavailable"
                  : "No scoreboard is stored for this match."}
              </p>
            </div>
            <div className="card">
              <h3>Odds availability</h3>
              <p className="detail-copy">{state.odds.available ? "Available" : "Unavailable"}</p>
              <p className="muted">odds count: {state.odds.count}</p>
              <p className="muted">market count: {state.odds.markets?.length ?? 0}</p>
            </div>
            <div className="card">
              <h3>Data quality</h3>
              <p className="detail-copy">{state.quality.status}</p>
              <p className="muted">
                issues: {state.quality.issues.length > 0 ? state.quality.issues.join(", ") : "none"}
              </p>
              <p className="muted">
                latest data: {state.freshness.latest_data_timestamp ?? "unavailable"}
              </p>
            </div>
          </section>

          <section className="grid cols-2 detail-sections">
            <div className="card">
              <h3>Agent brief</h3>
              {brief ? (
                <div className="detail-stack">
                  <p className="demo-brief-headline">{brief.headline}</p>
                  <p className="demo-brief-overview">{brief.overview}</p>
                  <div>
                    <span className="mini-label">Available data</span>
                    <ul className="detail-list">
                      {brief.available_data.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="mini-label">Missing data</span>
                    <ul className="detail-list">
                      {brief.missing_data.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="muted">{brief.freshness_note}</p>
                  <p className="muted">
                    {brief.quality_notes.length > 0
                      ? brief.quality_notes.join(" ")
                      : "No additional quality notes."}
                  </p>
                  <p className="muted">{sanitizeSafeScopeNote(brief.safe_scope_note)}</p>
                </div>
              ) : (
                <p className="muted">No brief available.</p>
              )}
            </div>

            <div className="card">
              <h3>Data quality panel</h3>
              {readiness ? (
                <div className="detail-stack">
                  <p className="detail-copy">readiness: {readiness.status}</p>
                  <p className="muted">display ready: {String(readiness.display_ready)}</p>
                  <p className="muted">has fixture: {String(readiness.has_fixture)}</p>
                  <p className="muted">has scoreboard: {String(readiness.has_scoreboard)}</p>
                  <p className="muted">has odds: {String(readiness.has_odds)}</p>
                  <p className="muted">issue count: {readiness.issue_count}</p>
                  <p className="muted">
                    issues: {readiness.issues.length > 0 ? readiness.issues.join(", ") : "none"}
                  </p>
                  <p className="muted">
                    latest data: {signalSummary?.latest_data_timestamp ?? state.freshness.latest_data_timestamp ?? "unavailable"}
                  </p>
                  <p className="muted">
                    signal counts: {signalSummary ? `${signalSummary.signal_count} total, ${signalSummary.info_count} info, ${signalSummary.warning_count} warning, ${signalSummary.critical_count} critical` : "No signal summary"}
                  </p>
                </div>
              ) : (
                <p className="muted">No readiness data available.</p>
              )}
            </div>
          </section>

          <section className="card">
            <h3>Signal feed</h3>
            {bundle.signals.length > 0 ? (
              <div className="demo-signals">
                {bundle.signals.map((signal, index) => (
                  <div key={`${signal.type}-${index}`} className="detail-signal">
                    <span
                      className={`status ${
                        signal.severity === "critical"
                          ? "risk"
                          : signal.severity === "warning"
                            ? "warn"
                            : ""
                      }`}
                    >
                      {signal.type}
                    </span>
                    <div className="detail-stack">
                      <strong>{signal.title}</strong>
                      <span className="muted">{signal.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No signals.</p>
            )}
          </section>

          <section className="card">
            <h3>Raw JSON</h3>
            <RawJsonToggle
              data={{
                match: { data: match, meta: matchMeta },
                bundle: { data: bundle, meta: bundleMeta }
              }}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}
