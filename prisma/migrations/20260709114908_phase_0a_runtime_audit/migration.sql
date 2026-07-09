-- CreateTable
CREATE TABLE "txline_audit_runs" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "fixture_ids" JSONB NOT NULL,
    "competition_ids" JSONB NOT NULL,
    "notes" TEXT,
    "summary_json" JSONB,
    "error_json" JSONB,

    CONSTRAINT "txline_audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "txline_raw_payloads" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "endpoint_type" TEXT NOT NULL,
    "endpoint_path" TEXT NOT NULL,
    "fixture_id" TEXT,
    "competition_id" TEXT,
    "start_epoch_day" INTEGER,
    "as_of" TIMESTAMPTZ(3),
    "provider_ts" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "stored_at" TIMESTAMPTZ(3) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "meta_json" JSONB,

    CONSTRAINT "txline_raw_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "txline_audit_findings" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "fixture_id" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "txline_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "txline_audit_runs_status_idx" ON "txline_audit_runs"("status");

-- CreateIndex
CREATE INDEX "txline_raw_payloads_audit_run_id_endpoint_type_idx" ON "txline_raw_payloads"("audit_run_id", "endpoint_type");

-- CreateIndex
CREATE INDEX "txline_raw_payloads_fixture_id_idx" ON "txline_raw_payloads"("fixture_id");

-- CreateIndex
CREATE INDEX "txline_raw_payloads_competition_id_idx" ON "txline_raw_payloads"("competition_id");

-- CreateIndex
CREATE INDEX "txline_audit_findings_audit_run_id_category_idx" ON "txline_audit_findings"("audit_run_id", "category");

-- CreateIndex
CREATE INDEX "txline_audit_findings_fixture_id_idx" ON "txline_audit_findings"("fixture_id");

-- AddForeignKey
ALTER TABLE "txline_raw_payloads" ADD CONSTRAINT "txline_raw_payloads_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "txline_audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txline_audit_findings" ADD CONSTRAINT "txline_audit_findings_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "txline_audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
