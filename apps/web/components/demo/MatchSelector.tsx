"use client";

import type { DemoFixtureCard } from "../../lib/demo-api";

interface MatchSelectorProps {
  matches: DemoFixtureCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MatchSelector({
  matches,
  selectedId,
  onSelect,
}: MatchSelectorProps) {
  return (
    <div className="demo-match-selector">
      <h2 className="demo-section-title">Select a Demo Match</h2>
      <div className="demo-match-cards">
        {matches.map((m) => {
          const active = selectedId === m.fixture_id;
          return (
            <button
              key={m.fixture_id}
              className={`demo-match-btn ${active ? "active" : ""}`}
              onClick={() => onSelect(m.fixture_id)}
            >
              <span className="demo-match-label">{m.label}</span>
              <span className="demo-match-meta">
                {m.competition} · {m.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
