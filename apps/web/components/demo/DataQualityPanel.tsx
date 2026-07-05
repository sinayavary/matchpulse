"use client";

import type { DemoReadiness, SignalSummary } from "../../lib/demo-api";

interface DataQualityPanelProps {
  readiness: DemoReadiness;
  signalSummary: SignalSummary | null;
}

export default function DataQualityPanel({
  readiness,
  signalSummary,
}: DataQualityPanelProps) {
  return (
    <div className="card">
      <h2 className="demo-section-title">Data Quality</h2>

      <div className="demo-quality-grid">
        <div className="demo-info-row">
          <span className="demo-info-label">Fixture</span>
          <span className={`status ${readiness.has_fixture ? "" : "warn"}`}>
            {readiness.has_fixture ? "Available" : "Missing"}
          </span>
        </div>

        <div className="demo-info-row">
          <span className="demo-info-label">Scoreboard</span>
          <span className={`status ${readiness.has_scoreboard ? "" : "warn"}`}>
            {readiness.has_scoreboard ? "Available" : "Missing"}
          </span>
        </div>

        <div className="demo-info-row">
          <span className="demo-info-label">Odds</span>
          <span className={`status ${readiness.has_odds ? "" : "warn"}`}>
            {readiness.has_odds ? "Available" : "Missing"}
          </span>
        </div>

        <div className="demo-info-row">
          <span className="demo-info-label">Status</span>
          <span
            className={`status ${readiness.status === "ready" ? "" : readiness.status === "partial" ? "warn" : "risk"}`}
          >
            {readiness.status}
          </span>
        </div>

        <div className="demo-info-row">
          <span className="demo-info-label">Issues</span>
          <span className="demo-info-value">
            {readiness.issue_count}
            {readiness.issues.length > 0 && (
              <span className="demo-quality-issues">
                {" "}
                — {readiness.issues.join(", ")}
              </span>
            )}
          </span>
        </div>

        {signalSummary && (
          <div className="demo-info-row">
            <span className="demo-info-label">Signals</span>
            <span className="demo-info-value">
              {signalSummary.total} total
              {signalSummary.info > 0 && ` · ${signalSummary.info} info`}
              {signalSummary.warning > 0 &&
                ` · ${signalSummary.warning} warning`}
              {signalSummary.critical > 0 &&
                ` · ${signalSummary.critical} critical`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
