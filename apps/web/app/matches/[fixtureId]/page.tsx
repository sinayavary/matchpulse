import { getApi } from "../../../lib/api";

type ApiResponse<T> = { data: T; meta: { status: string; last_updated: string; source: string; mode: string } };

type MatchState = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  score: { home: number; away: number };
  phase: string;
  minute: number;
  market_mood: string;
  momentum: { home: number; away: number; label: string };
};

type Signal = { signal_id: string; minute: number; type: string; title: string; explanation: string; confidence: string; risk: string };
type Scenario = { scenario_id: string; label: string; probability: number; confidence: string; explanation: string };

const fallbackState: MatchState = {
  fixture_id: "18175918",
  home_team: "Argentina",
  away_team: "Cape Verde",
  score: { home: 1, away: 0 },
  phase: "H2",
  minute: 63,
  market_mood: "Home team market confirmation",
  momentum: { home: 72, away: 28, label: "Argentina pressure" }
};

export default async function MatchRoomPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const [stateResult, signalsResult, scenariosResult, oddsResult] = await Promise.all([
    getApi<ApiResponse<MatchState>>(`/api/matches/${fixtureId}`),
    getApi<ApiResponse<Signal[]>>(`/api/matches/${fixtureId}/signals`),
    getApi<ApiResponse<Scenario[]>>(`/api/matches/${fixtureId}/scenarios`),
    getApi<ApiResponse<unknown>>(`/api/matches/${fixtureId}/odds`)
  ]);

  const state = stateResult?.data ?? fallbackState;
  const signals = signalsResult?.data ?? [];
  const scenarios = scenariosResult?.data ?? [];

  return (
    <main className="container">
      <div className="badge">Live Match Room · {stateResult?.meta.status ?? "mock fallback"}</div>
      <h1>{state.home_team} {state.score.home} - {state.score.away} {state.away_team}</h1>
      <p className="subtitle">Minute {state.minute} · Phase {state.phase} · {state.market_mood}</p>

      <section className="grid cols-3">
        <div className="card strong"><h3>Momentum</h3><div className="kpi">{state.momentum.home}%</div><p className="muted">{state.momentum.label}</p></div>
        <div className="card"><h3>Risk-aware mode</h3><span className="status warn">No bet execution</span><p className="muted">Insights are informational, not betting instructions.</p></div>
        <div className="card"><h3>Source</h3><span className="status">TxLINE / {stateResult?.meta.source ?? "mock"}</span><p className="muted">Backend API only. Frontend never calls TxLINE directly.</p></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Scenario probabilities</h3>
          <div className="grid">
            {scenarios.map((scenario) => (
              <div key={scenario.scenario_id}>
                <strong>{scenario.label}</strong>
                <div className="progress"><span style={{ width: `${Math.round(scenario.probability * 100)}%` }} /></div>
                <p className="muted">{Math.round(scenario.probability * 100)}% · {scenario.confidence}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>SignalCore timeline</h3>
          <div className="grid">
            {signals.map((signal) => (
              <div key={signal.signal_id} className="card">
                <span className={signal.risk === "high" ? "status risk" : "status"}>{signal.type}</span>
                <h3>{signal.minute}' · {signal.title}</h3>
                <p className="muted">{signal.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Raw odds/data panel placeholder</h3>
        <pre className="muted" style={{ overflowX: "auto" }}>{JSON.stringify(oddsResult?.data ?? { status: "mock fallback" }, null, 2)}</pre>
      </section>
    </main>
  );
}
