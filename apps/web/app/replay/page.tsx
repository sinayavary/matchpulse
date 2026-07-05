export default function ReplayPage() {
  return (
    <main className="container">
      <div className="badge">Replay</div>
      <h1>Use the demo fallback for replay-safe viewing.</h1>
      <p className="subtitle">
        This phase keeps non-demo frontend flows on the public API. For deterministic
        replay behavior, use the Demo page instead of a separate replay fetch route.
      </p>
      <section className="card">
        <h3>Replay path</h3>
        <p className="muted">
          Open the Demo page to inspect the fallback bundle, raw JSON, and safe data
          availability states without relying on live public match data.
        </p>
      </section>
    </main>
  );
}
