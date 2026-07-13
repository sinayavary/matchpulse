import Link from "next/link";
import CompetitionPredictionPanel from "../../components/competition/CompetitionPredictionPanel";
import {
  DEFAULT_COMPETITION_REPLAY_CHECKPOINT,
  fetchCompetitionPrediction,
  fetchCompetitionReplayCheckpoint,
  fetchCompetitionReplayIndex,
  shouldUseReplayFallback,
  type CompetitionPredictionResponse,
  type CompetitionReplayCheckpointSummary,
} from "../../lib/competition-api";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function unavailableResponse(message: string): CompetitionPredictionResponse {
  return {
    data: null,
    market_analysis: {
      market_intelligence_version: "public-market-intelligence-v1",
      fixture_id: "competition-unavailable",
      generated_at: new Date(0).toISOString(),
      availability: "unavailable",
      reliability: "unavailable",
      freshness: "unknown",
      provider_coverage: "none",
      provider_agreement: "unknown",
      volatility: "none",
      market_count: 0,
      usable_market_count: 0,
      provider_count: 0,
      notable_movements: [],
      summary: "Public market intelligence is currently unavailable.",
      limitations: [message],
      last_update: null,
      safety_note: "Market intelligence is informational and separate from the MatchPulse prediction.",
    },
    meta: {
      status: "no_data",
      source: "competition-prediction",
      mode: "replay",
      message,
    },
  };
}

export default async function CompetitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedMode = first(params.mode) === "live" ? "live" : "replay";
  const fixtureId = first(params.fixtureId)?.trim() ?? "";

  const indexResult = await fetchCompetitionReplayIndex();
  const checkpoints: CompetitionReplayCheckpointSummary[] = indexResult.ok && indexResult.value
    ? indexResult.value.data
    : [];
  const requestedCheckpoint = first(params.checkpoint) ?? DEFAULT_COMPETITION_REPLAY_CHECKPOINT;
  const selectedCheckpoint = checkpoints.find((checkpoint) => checkpoint.checkpoint_id === requestedCheckpoint)
    ?? checkpoints.find((checkpoint) => checkpoint.checkpoint_id === DEFAULT_COMPETITION_REPLAY_CHECKPOINT)
    ?? null;
  const replayId = selectedCheckpoint?.checkpoint_id ?? DEFAULT_COMPETITION_REPLAY_CHECKPOINT;

  let response: CompetitionPredictionResponse;
  let modeLabel = "deterministic replay";
  let fallbackReason: string | null = null;

  if (requestedMode === "live" && fixtureId.length > 0) {
    const liveResult = await fetchCompetitionPrediction(fixtureId);
    if (!shouldUseReplayFallback(liveResult) && liveResult.value) {
      response = liveResult.value;
      modeLabel = "live / stored public API";
    } else {
      const replayResult = await fetchCompetitionReplayCheckpoint(replayId);
      response = replayResult.value ?? unavailableResponse("Live and replay competition data are unavailable.");
      fallbackReason = "The requested live / stored prediction was unavailable, so the approved deterministic replay checkpoint is shown.";
    }
  } else {
    const replayResult = await fetchCompetitionReplayCheckpoint(replayId);
    response = replayResult.value ?? unavailableResponse("The deterministic replay checkpoint is unavailable.");
  }

  return (
    <main className="container demo-page">
      <header className="demo-header">
        <span className="badge">Competition release evaluator</span>
        <h1>Complete live-scenario intelligence in one public-safe view.</h1>
        <p className="subtitle">
          Review every competition prediction family alongside a separate human-readable market analysis.
          Use stored / live public data when a fixture is available, or the deterministic replay fallback.
        </p>
        <div className="mini-meta">
          <span>No wallet</span>
          <span>No payment</span>
          <span>No private provider data</span>
          <span>Baseline model: competition_baseline_v1</span>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Choose data mode</h2>
        <form action="/competition" method="get" className="filter-row">
          <input type="hidden" name="mode" value="live" />
          <label style={{ display: "grid", gap: 6, flex: "1 1 320px" }}>
            <span className="mini-label">Fixture ID for live / stored public API</span>
            <input
              name="fixtureId"
              defaultValue={fixtureId}
              placeholder="Enter a public fixture ID"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 14,
                background: "var(--panel)",
                color: "var(--text)",
                padding: "12px 14px",
              }}
            />
          </label>
          <button className="button primary" type="submit">Load live / stored view</button>
          <Link className="button" href={`/competition?mode=replay&checkpoint=${replayId}`}>
            Use deterministic replay
          </Link>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Replay checkpoints</h2>
        <p className="muted">
          The replay is synthetic and deterministic. Checkpoints visibly change match state, market freshness,
          reliability, agreement, volatility, confidence, and risk before reaching a terminal result.
        </p>
        {checkpoints.length === 0 ? (
          <p className="matches-error">Replay checkpoint metadata is unavailable.</p>
        ) : (
          <div className="demo-match-cards">
            {checkpoints.map((checkpoint) => (
              <Link
                className={`demo-match-btn ${checkpoint.checkpoint_id === replayId && modeLabel === "deterministic replay" ? "active" : ""}`}
                href={`/competition?mode=replay&checkpoint=${checkpoint.checkpoint_id}`}
                key={checkpoint.checkpoint_id}
              >
                <span>{checkpoint.label}</span>
                <span className="demo-match-meta">
                  {checkpoint.phase} · {checkpoint.minute}&apos; · {checkpoint.home_score}-{checkpoint.away_score}
                </span>
                <span className="demo-match-meta">
                  {checkpoint.market_reliability} reliability · {checkpoint.market_freshness} · {checkpoint.market_volatility} volatility
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CompetitionPredictionPanel
        response={response}
        mode_label={modeLabel}
        checkpoint_label={modeLabel === "deterministic replay" ? selectedCheckpoint?.label : undefined}
        fallback_reason={fallbackReason}
      />

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Evaluator notes</h2>
        <p className="muted">
          Prediction output and market analysis are intentionally separate. The page displays only the versioned
          public-safe DTO and never receives internal model weights, formulas, thresholds, provider identities,
          raw observations, credentials, or proof blobs.
        </p>
      </section>
    </main>
  );
}
