"use client";

import type { DemoSignal } from "../../lib/demo-api";

interface SignalFeedProps {
  signals: DemoSignal[];
}

function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "risk";
    case "warning":
      return "warn";
    default:
      return "";
  }
}

export default function SignalFeed({ signals }: SignalFeedProps) {
  if (!signals.length) {
    return (
      <div className="card">
        <h2 className="demo-section-title">Signal Feed</h2>
        <p className="muted">No signals.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="demo-section-title">Signal Feed</h2>
      <div className="demo-signals">
        {signals.map((s, i) => (
          <div key={i} className="demo-signal-row">
            <span className={`status ${severityClass(s.severity)}`}>
              {s.type}
            </span>
            <span className="demo-signal-msg">{s.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
