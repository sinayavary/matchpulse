CREATE TABLE "public_live_events" (
    "id" BIGSERIAL NOT NULL,
    "fixture_id" TEXT,
    "event_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "public_live_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "public_live_events_dedupe_key_key" ON "public_live_events"("dedupe_key");
CREATE INDEX "public_live_events_fixture_id_id_idx" ON "public_live_events"("fixture_id", "id");
CREATE INDEX "public_live_events_event_type_id_idx" ON "public_live_events"("event_type", "id");
CREATE INDEX "public_live_events_expires_at_idx" ON "public_live_events"("expires_at");
