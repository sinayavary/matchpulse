"use client";

import type { AgentBrief } from "../../lib/demo-api";

interface AgentBriefCardProps {
  brief: AgentBrief | null;
}

export default function AgentBriefCard({ brief }: AgentBriefCardProps) {
  if (!brief) {
    return (
      <div className="card">
        <h2 className="demo-section-title">Agent Brief</h2>
        <p className="muted">No brief available.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="demo-section-title">Agent Brief</h2>

      {brief.headline && (
        <p className="demo-brief-headline">{brief.headline}</p>
      )}

      {brief.overview && <p className="demo-brief-overview">{brief.overview}</p>}

      {brief.available_data.length > 0 && (
        <div className="demo-brief-list">
          <span className="demo-info-label">Available data</span>
          <ul>
            {brief.available_data.map((item, i) => (
              <li key={i} className="demo-list-item available">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.missing_data.length > 0 && (
        <div className="demo-brief-list">
          <span className="demo-info-label">Missing data</span>
          <ul>
            {brief.missing_data.map((item, i) => (
              <li key={i} className="demo-list-item missing">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.freshness_note && (
        <p className="demo-brief-note muted">{brief.freshness_note}</p>
      )}

      {brief.safe_scope_note && (
        <p className="demo-brief-note muted">{brief.safe_scope_note}</p>
      )}
    </div>
  );
}
