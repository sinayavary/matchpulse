import ReplayViewer from "../../components/replay/ReplayViewer";

export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ fixtureId?: string }> }) {
  const { fixtureId } = await searchParams;
  if (fixtureId) return <main className="container"><ReplayViewer fixtureId={fixtureId} /></main>;
  return (
    <main className="container">
      <div className="badge">Replay</div>
      <h1>Historical replay</h1>
      <p className="subtitle">
        Choose Replay from a persisted match room to inspect the stored timeline.
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
