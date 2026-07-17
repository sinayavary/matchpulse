"use client";

import { useEffect, useState } from "react";
import { fetchPublicReplay, type PublicReplay } from "../../lib/public-api";

export default function ReplayViewer({ fixtureId }: { fixtureId: string }) {
  const [replay, setReplay] = useState<PublicReplay | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => { void fetchPublicReplay(fixtureId).then((result) => { if (result.data) setReplay(result.data); }); }, [fixtureId]);
  useEffect(() => { if (!playing || !replay?.timeline.length) return; const timer = window.setInterval(() => setIndex((value) => value >= replay.timeline.length - 1 ? 0 : value + 1), 1000 / speed); return () => window.clearInterval(timer); }, [playing, speed, replay]);
  if (!replay) return <section className="card"><p className="muted">Loading persisted replay...</p></section>;
  if (replay.status === "no_data") return <section className="card"><h3>No replay data</h3><p className="muted">This match has no persisted timeline yet.</p></section>;
  const point = replay.timeline[index];
  return <section className="card">
    <h2>Historical replay</h2>
    <div className="detail-actions"><button className="button" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button><button className="button" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous event</button><button className="button" type="button" onClick={() => setIndex((value) => Math.min(replay.timeline.length - 1, value + 1))}>Next event</button><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1}>x1</option><option value={2}>x2</option><option value={5}>x5</option></select></div>
    <input aria-label="Replay timeline" type="range" min={0} max={Math.max(0, replay.timeline.length - 1)} value={index} onChange={(event) => setIndex(Number(event.target.value))} />
    <p className="muted">{point?.as_of} · minute {point?.minute ?? "unknown"} · {point?.phase ?? "unknown"}</p>
    <div className="grid cols-3"><div><span className="mini-label">Score</span><strong>{point?.score.home ?? "-"} - {point?.score.away ?? "-"}</strong></div><div><span className="mini-label">Probabilities</span><strong>{point?.probabilities ? `${Math.round(point.probabilities.home * 100)} / ${Math.round(point.probabilities.draw * 100)} / ${Math.round(point.probabilities.away * 100)}` : "unavailable"}</strong></div><div><span className="mini-label">Coverage</span><strong>{replay.coverage.start ?? "-"} → {replay.coverage.end ?? "-"}</strong></div></div>
    <p className="muted">Events at snapshot: {point?.events.length ?? 0}. {replay.gaps.length ? `Gaps: ${replay.gaps.join(", ")}` : "No reported data gaps."}</p>
  </section>;
}
