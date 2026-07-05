"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDemoMatches,
  fetchDemoBundle,
  type DemoFixtureCard,
  type DemoBundleResponse,
} from "../../lib/demo-api";
import MatchSelector from "../../components/demo/MatchSelector";
import IntelligenceCard from "../../components/demo/IntelligenceCard";
import AgentBriefCard from "../../components/demo/AgentBriefCard";
import SignalFeed from "../../components/demo/SignalFeed";
import DataQualityPanel from "../../components/demo/DataQualityPanel";
import RawJsonToggle from "../../components/demo/RawJsonToggle";

type Phase = "loading-matches" | "idle" | "loading-bundle" | "loaded" | "error";

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>("loading-matches");
  const [matches, setMatches] = useState<DemoFixtureCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<DemoBundleResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // load match list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchDemoMatches();
      if (cancelled) return;
      if (!res) {
        setPhase("error");
        setErrorMsg(
          "Demo API is not reachable. Start the API on port 4000."
        );
        return;
      }
      setMatches(res.data ?? []);
      setPhase("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // load bundle when a match is selected
  const loadBundle = useCallback(async (fixtureId: string) => {
    setPhase("loading-bundle");
    setSelectedId(fixtureId);
    setBundle(null);
    const res = await fetchDemoBundle(fixtureId);
    if (!res) {
      setPhase("error");
      setErrorMsg("Failed to load bundle data.");
      return;
    }
    setBundle(res);
    setPhase("loaded");
  }, []);

  const refresh = useCallback(() => {
    if (selectedId) loadBundle(selectedId);
  }, [selectedId, loadBundle]);

  return (
    <main className="container demo-page">
      {/* Header */}
      <div className="demo-header">
        <h1>MatchPulse Demo</h1>
        <p className="subtitle">Safe sports data intelligence demo</p>
        <p className="muted demo-note">
          This demo shows data availability, freshness, and quality only.
        </p>
      </div>

      {/* match selector */}
      {phase === "loading-matches" && (
        <div className="card">
          <p className="muted">Loading demo matches…</p>
        </div>
      )}

      {phase === "error" && !selectedId && (
        <div className="card demo-error-card">
          <p className="demo-error">{errorMsg}</p>
          <button className="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {(phase === "idle" ||
        phase === "loading-bundle" ||
        phase === "loaded" ||
        phase === "error") &&
        matches.length > 0 && (
          <MatchSelector
            matches={matches}
            selectedId={selectedId}
            onSelect={loadBundle}
          />
        )}

      {/* bundle detail */}
      {phase === "loading-bundle" && (
        <div className="card">
          <p className="muted">Loading bundle…</p>
        </div>
      )}

      {phase === "error" && selectedId && (
        <div className="card demo-error-card">
          <p className="demo-error">{errorMsg}</p>
          <button className="button" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {phase === "loaded" && bundle && bundle.data && (
        <>
          <div className="grid cols-2">
            <IntelligenceCard data={bundle.data} />
            <AgentBriefCard brief={bundle.data.brief} />
          </div>

          <SignalFeed signals={bundle.data.signals} />

          <DataQualityPanel
            readiness={bundle.data.readiness}
            signalSummary={bundle.data.signal_summary}
          />

          <RawJsonToggle data={bundle} />

          <button className="button demo-refresh" onClick={refresh}>
            Refresh
          </button>
        </>
      )}

      {/* no_data response */}
      {phase === "loaded" && bundle && !bundle.data && (
        <div className="card">
          <p className="muted">{bundle.meta.message ?? "No data available for this match."}</p>
        </div>
      )}
    </main>
  );
}
