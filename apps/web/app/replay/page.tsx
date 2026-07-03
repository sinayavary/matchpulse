import { getApi } from "../../lib/api";

type ApiResponse<T> = { data: T; meta: { status: string } };

export default async function ReplayPage() {
  const replay = await getApi<ApiResponse<unknown>>("/api/replay/demo-session");
  return (
    <main className="container">
      <div className="badge">Replay Mode · Demo without live matches</div>
      <h1>Replay-ready intelligence</h1>
      <p className="subtitle">Replay mode lets judges see the Agent generate signals and scenario updates even when no live match is active.</p>
      <section className="card">
        <h3>Replay state</h3>
        <pre className="muted" style={{ overflowX: "auto" }}>{JSON.stringify(replay?.data ?? { mode: "mock fallback" }, null, 2)}</pre>
      </section>
    </main>
  );
}
