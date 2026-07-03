import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <div className="badge">⚡ TxLINE data layer · Solana/Web3 sports intelligence</div>
          <h1>Live match data meets market insight.</h1>
          <p className="subtitle">
            MatchPulse turns TxLINE World Cup data into raw feeds, market movement signals,
            scenario probabilities, and risk-aware Agent insights. Built for analysis and fan engagement — not direct betting execution.
          </p>
          <div className="actions">
            <Link className="button primary" href="/matches">Open Match Room</Link>
            <Link className="button" href="/agent">View SignalCore Agent</Link>
          </div>
        </div>
        <div className="grid">
          <div className="card strong">
            <span className="status">DEVNET FIRST</span>
            <h3>Solana-native access path</h3>
            <p className="muted">TxLINE token activation and API access are handled by the backend. Users do not need wallets in the MVP.</p>
          </div>
          <div className="card">
            <h3>Agent output</h3>
            <p className="muted">Signals, scenarios, confidence, risk level, replay mode, and post-match evaluation.</p>
          </div>
        </div>
      </section>
      <section className="grid cols-3">
        <div className="card"><h3>Raw Data</h3><p className="muted">Scores, odds, timestamps, events, and source status.</p></div>
        <div className="card"><h3>Market Signals</h3><p className="muted">Odds movement, confirmation, overreaction, and uncertainty signals.</p></div>
        <div className="card"><h3>Replay Ready</h3><p className="muted">Demo the full Agent flow even when no match is live.</p></div>
      </section>
    </main>
  );
}
