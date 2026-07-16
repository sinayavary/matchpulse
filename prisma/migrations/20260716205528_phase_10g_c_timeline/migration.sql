-- CreateTable
CREATE TABLE "txline_stream_checkpoints" (
    "id" UUID NOT NULL,
    "stream_kind" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "last_event_id" TEXT,
    "provider_timestamp" TIMESTAMPTZ(3),
    "sequence" INTEGER,
    "heartbeat_at" TIMESTAMPTZ(3),
    "connection_status" TEXT NOT NULL,
    "reconnect_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_category" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "txline_stream_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_timeline_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "stream_kind" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "sequence" INTEGER,
    "provider_timestamp" TIMESTAMPTZ(3),
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "txline_stream_checkpoints_fixture_id_updated_at_idx" ON "txline_stream_checkpoints"("fixture_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "txline_stream_checkpoints_stream_kind_fixture_id_key" ON "txline_stream_checkpoints"("stream_kind", "fixture_id");

-- CreateIndex
CREATE INDEX "canonical_timeline_events_fixture_id_provider_timestamp_seq_idx" ON "canonical_timeline_events"("fixture_id", "provider_timestamp", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_timeline_events_stream_kind_fixture_id_event_id_key" ON "canonical_timeline_events"("stream_kind", "fixture_id", "event_id");

-- RenameIndex
ALTER INDEX "internal_service_credentials_service_identity_id_revoked_at_exp" RENAME TO "internal_service_credentials_service_identity_id_revoked_at_idx";
