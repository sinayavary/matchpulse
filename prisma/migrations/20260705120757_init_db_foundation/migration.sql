-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "stage" TEXT,
    "sport" TEXT NOT NULL DEFAULT 'soccer',
    "start_time_utc" TIMESTAMPTZ(3),
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_states" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "minute" INTEGER,
    "phase" TEXT NOT NULL DEFAULT 'unknown',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "in_running" BOOLEAN,
    "market_mood" TEXT NOT NULL DEFAULT 'unknown',
    "momentum_side" TEXT NOT NULL DEFAULT 'unknown',
    "momentum_score" DECIMAL(5,2),
    "raw_score" JSONB,
    "raw_odds" JSONB,
    "last_data_received_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "match_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "external_seq" TEXT,
    "event_type" TEXT NOT NULL,
    "event_minute" INTEGER,
    "team_side" TEXT NOT NULL DEFAULT 'unknown',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_timestamp" TIMESTAMPTZ(3),
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "external_seq" TEXT,
    "market_id" TEXT NOT NULL,
    "market_name" TEXT,
    "selection_name" TEXT NOT NULL,
    "odds" DECIMAL(12,4) NOT NULL,
    "previous_odds" DECIMAL(12,4),
    "change_percent" DECIMAL(12,4),
    "direction" TEXT NOT NULL,
    "source_timestamp" TIMESTAMPTZ(3),
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "related_event_id" UUID,
    "signal_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "risk_level" TEXT NOT NULL,
    "event_minute" INTEGER,
    "explanation" TEXT NOT NULL,
    "technical_reasoning" JSONB,
    "raw_inputs" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "signal_id" UUID,
    "scenario_name" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "previous_probability" DECIMAL(5,4),
    "direction" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "explanation" TEXT NOT NULL,
    "inputs" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_sessions" (
    "id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "speed" INTEGER NOT NULL DEFAULT 1,
    "current_minute" INTEGER,
    "started_at" TIMESTAMPTZ(3),
    "stopped_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_status" (
    "id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_heartbeat" TIMESTAMPTZ(3),
    "last_data_received_at" TIMESTAMPTZ(3),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "raw" JSONB,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "health_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_fixture_id_key" ON "fixtures"("fixture_id");

-- CreateIndex
CREATE INDEX "fixtures_start_time_utc_idx" ON "fixtures"("start_time_utc");

-- CreateIndex
CREATE INDEX "fixtures_status_idx" ON "fixtures"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_states_fixture_id_key" ON "match_states"("fixture_id");

-- CreateIndex
CREATE INDEX "match_states_phase_idx" ON "match_states"("phase");

-- CreateIndex
CREATE INDEX "match_states_last_data_received_at_idx" ON "match_states"("last_data_received_at");

-- CreateIndex
CREATE INDEX "match_events_fixture_id_source_timestamp_idx" ON "match_events"("fixture_id", "source_timestamp");

-- CreateIndex
CREATE INDEX "match_events_event_type_idx" ON "match_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_fixture_id_external_seq_key" ON "match_events"("fixture_id", "external_seq");

-- CreateIndex
CREATE INDEX "odds_snapshots_fixture_id_source_timestamp_idx" ON "odds_snapshots"("fixture_id", "source_timestamp");

-- CreateIndex
CREATE INDEX "odds_snapshots_market_id_idx" ON "odds_snapshots"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "odds_snapshots_fixture_id_external_seq_market_id_selection__key" ON "odds_snapshots"("fixture_id", "external_seq", "market_id", "selection_name");

-- CreateIndex
CREATE INDEX "signals_fixture_id_created_at_idx" ON "signals"("fixture_id", "created_at");

-- CreateIndex
CREATE INDEX "signals_signal_type_idx" ON "signals"("signal_type");

-- CreateIndex
CREATE INDEX "signals_severity_idx" ON "signals"("severity");

-- CreateIndex
CREATE INDEX "signals_risk_level_idx" ON "signals"("risk_level");

-- CreateIndex
CREATE INDEX "scenarios_fixture_id_created_at_idx" ON "scenarios"("fixture_id", "created_at");

-- CreateIndex
CREATE INDEX "scenarios_scenario_name_idx" ON "scenarios"("scenario_name");

-- CreateIndex
CREATE UNIQUE INDEX "replay_sessions_session_id_key" ON "replay_sessions"("session_id");

-- CreateIndex
CREATE INDEX "replay_sessions_fixture_id_idx" ON "replay_sessions"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_status_service_name_key" ON "health_status"("service_name");

-- CreateIndex
CREATE INDEX "health_status_status_idx" ON "health_status"("status");

-- AddForeignKey
ALTER TABLE "match_states" ADD CONSTRAINT "match_states_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("fixture_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("fixture_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_sessions" ADD CONSTRAINT "replay_sessions_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("fixture_id") ON DELETE CASCADE ON UPDATE CASCADE;
