export default function AgentPage() {
  return (
    <main className="container">
      <div className="badge">Agent overview</div>
      <h1>Agent brief lives in the public match room.</h1>
      <p className="subtitle">
        This phase keeps the frontend on public-safe match routes only. Open a match
        room to review headline, overview, signal feed, freshness, and quality data.
      </p>
      <section className="card">
        <h3>Where to look next</h3>
        <p className="muted">
          Visit the Matches page for the DB-backed public browser, or use the Demo page
          for the deterministic fallback flow.
        </p>
      </section>
    </main>
  );
}
