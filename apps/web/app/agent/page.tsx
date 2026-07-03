import { getApi } from "../../lib/api";

type ApiResponse<T> = { data: T; meta: { status: string } };

export default async function AgentPage() {
  const [health, evaluation, graph] = await Promise.all([
    getApi<ApiResponse<unknown>>("/api/agent/health"),
    getApi<ApiResponse<unknown>>("/api/agent/evaluation"),
    getApi<ApiResponse<unknown>>("/api/agent/learning-graph")
  ]);

  return (
    <main className="container">
      <div className="badge">Track 1 · Standalone Agent</div>
      <h1>SignalCore Agent</h1>
      <p className="subtitle">Autonomous sports market intelligence agent with signals, scenarios, replay, and learning graph outputs.</p>
      <section className="grid cols-3">
        <div className="card"><h3>Health</h3><pre className="muted">{JSON.stringify(health?.data ?? { mode: "mock fallback" }, null, 2)}</pre></div>
        <div className="card"><h3>Evaluation</h3><pre className="muted">{JSON.stringify(evaluation?.data ?? {}, null, 2)}</pre></div>
        <div className="card"><h3>Learning Graph</h3><pre className="muted">{JSON.stringify(graph?.data ?? {}, null, 2)}</pre></div>
      </section>
    </main>
  );
}
