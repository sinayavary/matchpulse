"use client";

import type {
  DemoBundleData,
  DemoReadiness,
  DemoMatchState,
} from "../../lib/demo-api";

interface IntelligenceCardProps {
  data: DemoBundleData;
}

export default function IntelligenceCard({ data }: IntelligenceCardProps) {
  const { readiness, state } = data;

  return (
    <div className="card demo-intelligence-card">
      <h2 className="demo-section-title">Match Intelligence</h2>

      {/* fixture info */}
      <div className="demo-info-row">
        <span className="demo-info-label">Fixture</span>
        <span className="demo-info-value">
          {state?.label ?? data.fixture_id}
        </span>
      </div>

      {state?.competition && (
        <div className="demo-info-row">
          <span className="demo-info-label">Competition</span>
          <span className="demo-info-value">{state.competition}</span>
        </div>
      )}

      {state?.status && (
        <div className="demo-info-row">
          <span className="demo-info-label">Status</span>
          <span className="demo-info-value">{state.status}</span>
        </div>
      )}

      {/* scoreboard */}
      <div className="demo-info-row">
        <span className="demo-info-label">Score</span>
        <span className="demo-info-value">
          {readiness.has_scoreboard
            ? state?.scoreboard?.available
              ? state?.scoreboard.home_score != null &&
                state?.scoreboard.away_score != null
                ? `${state.scoreboard.home_score} – ${state.scoreboard.away_score}`
                : "Scoreboard available, score unavailable"
              : "Scoreboard missing"
            : "Scoreboard missing"}
        </span>
      </div>

      {/* odds */}
      <div className="demo-info-row">
        <span className="demo-info-label">Odds</span>
        <span className="demo-info-value">
          {readiness.has_odds ? "Available" : "Odds missing"}
        </span>
      </div>

      {/* timestamp */}
      {state?.latest_data_timestamp && (
        <div className="demo-info-row">
          <span className="demo-info-label">Latest data</span>
          <span className="demo-info-value demo-ts">
            {state.latest_data_timestamp}
          </span>
        </div>
      )}

      {/* display ready */}
      <div className="demo-info-row">
        <span className="demo-info-label">Display ready</span>
        <span className={`status ${readiness.display_ready ? "" : "warn"}`}>
          {readiness.display_ready ? "Yes" : "No"}
        </span>
      </div>
    </div>
  );
}
