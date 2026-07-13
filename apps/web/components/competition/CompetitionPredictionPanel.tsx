import React, { type CSSProperties, type ReactNode } from "react";
import type {
  CompetitionMarketAnalysis,
  CompetitionPredictionResponse,
} from "../../lib/competition-api.js";

export type CompetitionPredictionPanelProps = {
  response: CompetitionPredictionResponse;
  mode_label: string;
  checkpoint_label?: string;
  fallback_reason?: string | null;
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const compactGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};

const stackStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function timestamp(value: string | null): string {
  if (value === null) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function tone(level: string): string {
  if (["high", "critical", "stale", "unavailable"].includes(level)) return "status risk";
  if (["medium", "limited", "aging", "mixed"].includes(level)) return "status warn";
  return "status";
}

function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="card">
      <span className="mini-label">{label}</span>
      <div className="kpi" style={{ fontSize: 28 }}>{value}</div>
      {note ? <p className="muted" style={{ marginBottom: 0 }}>{note}</p> : null}
    </div>
  );
}

function List({ values, empty = "None reported." }: { values: string[]; empty?: string }) {
  return values.length === 0
    ? <p className="muted">{empty}</p>
    : (
      <ul className="detail-list">
        {values.map((value) => <li key={value}>{value}</li>)}
      </ul>
    );
}

function MarketAnalysis({ market }: { market: CompetitionMarketAnalysis }) {
  return (
    <section className="card strong" aria-labelledby="market-analysis-heading" style={sectionStyle}>
      <div>
        <span className="badge">Separate public market context</span>
        <h2 id="market-analysis-heading">Market / odds analysis</h2>
        <p className="muted">
          This section describes the availability, quality, freshness, and movement of public-safe market data.
          It is separate from the MatchPulse prediction.
        </p>
      </div>

      <div style={compactGridStyle}>
        <Metric label="Availability" value={<span className={tone(market.availability)}>{market.availability}</span>} />
        <Metric label="Reliability" value={<span className={tone(market.reliability)}>{market.reliability}</span>} />
        <Metric label="Freshness" value={<span className={tone(market.freshness)}>{market.freshness}</span>} />
        <Metric label="Coverage" value={market.provider_coverage} />
        <Metric label="Agreement" value={<span className={tone(market.provider_agreement)}>{market.provider_agreement}</span>} />
        <Metric label="Volatility" value={<span className={tone(market.volatility)}>{market.volatility}</span>} />
      </div>

      <div style={compactGridStyle}>
        <Metric label="Markets observed" value={market.market_count} />
        <Metric label="Usable markets" value={market.usable_market_count} />
        <Metric label="Provider count" value={market.provider_count} />
        <Metric label="Last market update" value={timestamp(market.last_update)} />
      </div>

      <div className="card">
        <span className="mini-label">Market summary</span>
        <p style={{ marginBottom: 0 }}>{market.summary}</p>
      </div>

      <div>
        <h3>Notable movements</h3>
        {market.notable_movements.length === 0
          ? <p className="muted">No notable public movement is available.</p>
          : (
            <div style={stackStyle}>
              {market.notable_movements.slice(0, 3).map((movement) => (
                <article className="card" key={`${movement.market_label}:${movement.selection_label}:${movement.direction}`}>
                  <div className="mini-meta">
                    <span>{movement.market_label}</span>
                    <span>{movement.selection_label}</span>
                    <span className={tone(movement.strength)}>{movement.direction} · {movement.strength}</span>
                  </div>
                  <p style={{ marginBottom: 0 }}>{movement.summary}</p>
                </article>
              ))}
            </div>
          )}
      </div>

      <div>
        <h3>Market limitations</h3>
        <List values={market.limitations} empty="No additional public market limitations are reported." />
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>{market.safety_note}</p>
    </section>
  );
}

export default function CompetitionPredictionPanel({
  response,
  mode_label,
  checkpoint_label,
  fallback_reason,
}: CompetitionPredictionPanelProps) {
  const prediction = response.data;
  const score = prediction?.match_state.home_score !== null && prediction?.match_state.home_score !== undefined &&
      prediction.match_state.away_score !== null
    ? `${prediction.match_state.home_score} - ${prediction.match_state.away_score}`
    : "Unavailable";

  return (
    <div style={sectionStyle}>
      <section className="card strong" aria-labelledby="prediction-heading" style={sectionStyle}>
        <div className="matches-toolbar">
          <div>
            <span className="badge">Protected public-safe output</span>
            <h2 id="prediction-heading">MatchPulse prediction</h2>
            <p className="muted">
              Scenario probabilities and explanations from the bounded competition baseline.
            </p>
          </div>
          <div className="mini-meta">
            <span className="status">Mode: {mode_label}</span>
            <span className={tone(response.meta.status)}>Status: {response.meta.status}</span>
            {checkpoint_label ? <span className="status warn">Checkpoint: {checkpoint_label}</span> : null}
          </div>
        </div>

        {fallback_reason ? (
          <div className="card">
            <strong>Replay fallback active.</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{fallback_reason}</p>
          </div>
        ) : null}

        {prediction === null ? (
          <div className="card">
            <h3>Prediction unavailable</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              {response.meta.message ?? "No bounded competition prediction is available for this fixture."}
            </p>
          </div>
        ) : (
          <>
            <div style={compactGridStyle}>
              <Metric label="Fixture" value={prediction.fixture_id} />
              <Metric label="Score" value={score} />
              <Metric
                label="Match state"
                value={prediction.match_state.normalized_phase.replaceAll("_", " ")}
                note={prediction.match_state.minute === null ? "Minute unavailable" : `Minute ${prediction.match_state.minute}`}
              />
              <Metric label="Model profile" value={prediction.model_profile} />
            </div>

            <section>
              <h3>Final outcome probabilities</h3>
              <div style={compactGridStyle}>
                <Metric label="Home" value={percent(prediction.final_outcome.home)} />
                <Metric label="Draw" value={percent(prediction.final_outcome.draw)} />
                <Metric label="Away" value={percent(prediction.final_outcome.away)} />
              </div>
            </section>

            <section>
              <h3>Next goal probabilities</h3>
              <div style={compactGridStyle}>
                <Metric label="Home" value={percent(prediction.next_goal.home)} />
                <Metric label="No further goal" value={percent(prediction.next_goal.none)} />
                <Metric label="Away" value={percent(prediction.next_goal.away)} />
              </div>
            </section>

            <section>
              <h3>Goal horizon</h3>
              <div style={compactGridStyle}>
                <Metric label="Next 5 minutes" value={percent(prediction.goal_horizon.next_5m)} />
                <Metric label="Next 10 minutes" value={percent(prediction.goal_horizon.next_10m)} />
                <Metric label="Next 15 minutes" value={percent(prediction.goal_horizon.next_15m)} />
              </div>
            </section>

            <section>
              <h3>Final-score scenarios</h3>
              <div style={compactGridStyle}>
                {prediction.final_score.outcomes.slice(0, 6).map((outcome) => (
                  <Metric
                    key={`${outcome.home_score}:${outcome.away_score}`}
                    label={`${outcome.home_score} - ${outcome.away_score}`}
                    value={percent(outcome.probability)}
                  />
                ))}
                <Metric label="Other scorelines" value={percent(prediction.final_score.other_probability)} />
              </div>
            </section>

            <section>
              <h3>Current-result survival</h3>
              <div style={compactGridStyle}>
                <Metric label="Current result holds" value={percent(prediction.current_result_survival.current_result_holds)} />
                <Metric label="Current result changes" value={percent(prediction.current_result_survival.current_result_changes)} />
              </div>
            </section>

            <section>
              <h3>Momentum shift</h3>
              <div style={compactGridStyle}>
                <Metric label="Home strengthens" value={percent(prediction.momentum_shift.home_strengthens)} />
                <Metric label="Neutral" value={percent(prediction.momentum_shift.neutral)} />
                <Metric label="Away strengthens" value={percent(prediction.momentum_shift.away_strengthens)} />
              </div>
            </section>

            <div style={compactGridStyle}>
              <Metric
                label="Confidence"
                value={<span className={tone(prediction.confidence.level)}>{prediction.confidence.level}</span>}
                note={percent(prediction.confidence.score)}
              />
              <Metric
                label="Risk"
                value={<span className={tone(prediction.risk.level)}>{prediction.risk.level}</span>}
              />
              <Metric
                label="Data quality"
                value={<span className={tone(prediction.data_quality.level)}>{prediction.data_quality.level}</span>}
                note={`${percent(prediction.data_quality.coverage_score)} coverage · ${prediction.data_quality.freshness}`}
              />
              <Metric label="Generated" value={timestamp(prediction.generated_at)} />
            </div>

            <div className="grid cols-2">
              <section className="card">
                <h3>Explanation</h3>
                <p>{prediction.explanation.summary}</p>
                <List values={prediction.explanation.main_factors} />
              </section>
              <section className="card">
                <h3>Limitations and risk notes</h3>
                <List values={[...prediction.explanation.limitations, ...prediction.risk.reasons]} />
              </section>
            </div>

            <p className="muted" style={{ marginBottom: 0 }}>{prediction.safety_note}</p>
          </>
        )}
      </section>

      <MarketAnalysis market={response.market_analysis} />
    </div>
  );
}
