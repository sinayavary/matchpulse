import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <div className="badge">Public API - safe match intelligence</div>
          <h1>Public match data, freshness, and quality in one view.</h1>
          <p className="subtitle">
            MatchPulse surfaces live-safe match information, signal summaries, and
            data quality status for the public frontend without exposing internal routes
            or operational details.
          </p>
          <div className="actions">
            <Link className="button primary" href="/matches">Open Matches</Link>
            <Link className="button" href="/demo">Open Demo Fallback</Link>
          </div>
        </div>
        <div className="grid">
          <div className="card strong">
            <span className="status">PUBLIC SAFE</span>
            <h3>Usable without internal access</h3>
            <p className="muted">
              The frontend consumes public-safe routes for fixtures, scoreboard
              status, odds availability, and freshness checks.
            </p>
          </div>
          <div className="card">
            <h3>Agent brief</h3>
            <p className="muted">
              Headline, overview, available data, missing data, freshness notes,
              and quality notes.
            </p>
          </div>
        </div>
      </section>
      <section className="grid cols-3">
        <div className="card"><h3>Scores</h3><p className="muted">Public scoreboard availability, score values, and match status.</p></div>
        <div className="card"><h3>Signals</h3><p className="muted">Safe signal feed entries about readiness, freshness, and missing data.</p></div>
        <div className="card"><h3>Replay</h3><p className="muted">Keep the deterministic demo fallback available when live-safe data is not the goal.</p></div>
      </section>
    </main>
  );
}
