-- CreateTable
CREATE TABLE "prediction_feature_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "as_of" TIMESTAMPTZ(3) NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "sequence" INTEGER,
    "trigger" TEXT NOT NULL,
    "feature_version" TEXT NOT NULL,
    "feature_hash" TEXT NOT NULL,
    "feature_count" INTEGER NOT NULL,
    "normalized_phase" TEXT NOT NULL,
    "minute" INTEGER,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "score_diff" INTEGER,
    "coverage_score" DOUBLE PRECISION NOT NULL,
    "feature_payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_feature_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "odds_intelligence_assessments" (
    "assessment_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "odds_intelligence_version" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "usable_for_model" BOOLEAN NOT NULL,
    "overall_reliability_score" DOUBLE PRECISION NOT NULL,
    "recommended_market_model_weight" DOUBLE PRECISION NOT NULL,
    "market_count" INTEGER NOT NULL,
    "usable_market_count" INTEGER NOT NULL,
    "provider_count" INTEGER NOT NULL,
    "snapshot_count" INTEGER NOT NULL,
    "consensus_score" DOUBLE PRECISION NOT NULL,
    "freshness_score" DOUBLE PRECISION NOT NULL,
    "volatility_score" DOUBLE PRECISION NOT NULL,
    "anomaly_score" DOUBLE PRECISION NOT NULL,
    "primary_market_key" TEXT,
    "assessment_payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_intelligence_assessments_pkey" PRIMARY KEY ("assessment_id")
);

-- CreateTable
CREATE TABLE "odds_intelligence_markets" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "market_key" TEXT NOT NULL,
    "market_type" TEXT NOT NULL,
    "line" DOUBLE PRECISION,
    "complete" BOOLEAN NOT NULL,
    "usable" BOOLEAN NOT NULL,
    "selection_count" INTEGER NOT NULL,
    "provider_count" INTEGER NOT NULL,
    "snapshot_count" INTEGER NOT NULL,
    "overround" DOUBLE PRECISION,
    "provider_dispersion" DOUBLE PRECISION,
    "volatility_score" DOUBLE PRECISION NOT NULL,
    "reliability_level" TEXT NOT NULL,
    "reliability_score" DOUBLE PRECISION NOT NULL,
    "recommended_model_weight" DOUBLE PRECISION NOT NULL,
    "component_scores" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "latest_timestamp" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_intelligence_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_intelligence_selections" (
    "id" TEXT NOT NULL,
    "market_record_id" TEXT NOT NULL,
    "selection_key" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "line" DOUBLE PRECISION,
    "fair_probability" DOUBLE PRECISION NOT NULL,
    "consensus_probability" DOUBLE PRECISION NOT NULL,
    "probability_change_1m" DOUBLE PRECISION,
    "probability_change_5m" DOUBLE PRECISION,
    "movement_velocity" DOUBLE PRECISION,
    "movement_acceleration" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_intelligence_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "feature_snapshot_id" TEXT NOT NULL,
    "odds_assessment_id" TEXT,
    "as_of" TIMESTAMPTZ(3) NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "sequence" INTEGER,
    "trigger" TEXT NOT NULL,
    "prediction_contract_version" TEXT NOT NULL,
    "feature_version" TEXT NOT NULL,
    "feature_hash" TEXT NOT NULL,
    "feature_count" INTEGER NOT NULL,
    "inference_engine_version" TEXT NOT NULL,
    "ensemble_version" TEXT NOT NULL,
    "calibration_version" TEXT,
    "inference_latency_ms" INTEGER,
    "fallback_used" BOOLEAN NOT NULL,
    "normalized_phase" TEXT NOT NULL,
    "minute" INTEGER,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "score_diff" INTEGER,
    "final_outcome_home" DOUBLE PRECISION NOT NULL,
    "final_outcome_draw" DOUBLE PRECISION NOT NULL,
    "final_outcome_away" DOUBLE PRECISION NOT NULL,
    "next_goal_home" DOUBLE PRECISION NOT NULL,
    "next_goal_none" DOUBLE PRECISION NOT NULL,
    "next_goal_away" DOUBLE PRECISION NOT NULL,
    "goal_next_5m" DOUBLE PRECISION NOT NULL,
    "goal_next_10m" DOUBLE PRECISION NOT NULL,
    "goal_next_15m" DOUBLE PRECISION NOT NULL,
    "current_result_holds" DOUBLE PRECISION NOT NULL,
    "current_result_changes" DOUBLE PRECISION NOT NULL,
    "momentum_home_strengthens" DOUBLE PRECISION NOT NULL,
    "momentum_neutral" DOUBLE PRECISION NOT NULL,
    "momentum_away_strengthens" DOUBLE PRECISION NOT NULL,
    "confidence_level" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "risk_level" TEXT NOT NULL,
    "odds_usable_for_model" BOOLEAN NOT NULL,
    "odds_reliability_score" DOUBLE PRECISION NOT NULL,
    "assigned_market_weight" DOUBLE PRECISION NOT NULL,
    "final_score_payload" JSONB NOT NULL,
    "data_coverage_payload" JSONB NOT NULL,
    "model_output_payload" JSONB NOT NULL,
    "confidence_payload" JSONB NOT NULL,
    "risk_payload" JSONB NOT NULL,
    "explanation_payload" JSONB NOT NULL,
    "snapshot_payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "prediction_specialist_contributions" (
    "id" TEXT NOT NULL,
    "prediction_snapshot_id" TEXT NOT NULL,
    "model_role" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "assigned_weight" DOUBLE PRECISION NOT NULL,
    "output_quality" DOUBLE PRECISION NOT NULL,
    "limitations" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_specialist_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_label_revisions" (
    "id" TEXT NOT NULL,
    "prediction_snapshot_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "label_version" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "as_of" TIMESTAMPTZ(3) NOT NULL,
    "labeled_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "final_outcome" TEXT,
    "next_goal_side" TEXT,
    "goal_in_next_5m" BOOLEAN,
    "goal_in_next_10m" BOOLEAN,
    "goal_in_next_15m" BOOLEAN,
    "final_home_score" INTEGER,
    "final_away_score" INTEGER,
    "current_result_survival" TEXT,
    "momentum_shift" TEXT,
    "source_finalized_at" TIMESTAMPTZ(3),
    "limitations" JSONB NOT NULL,
    "label_payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_label_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_evaluations" (
    "evaluation_id" TEXT NOT NULL,
    "prediction_snapshot_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "feature_version" TEXT NOT NULL,
    "label_version" TEXT NOT NULL,
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL,
    "multiclass_log_loss" DOUBLE PRECISION,
    "multiclass_brier_score" DOUBLE PRECISION,
    "expected_calibration_error" DOUBLE PRECISION,
    "binary_log_loss" DOUBLE PRECISION,
    "binary_brier_score" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "roc_auc" DOUBLE PRECISION,
    "pr_auc" DOUBLE PRECISION,
    "negative_log_likelihood" DOUBLE PRECISION,
    "segment_keys" JSONB NOT NULL,
    "passed_quality_gate" BOOLEAN NOT NULL,
    "limitations" JSONB NOT NULL,
    "evaluation_payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_evaluations_pkey" PRIMARY KEY ("evaluation_id")
);

-- CreateTable
CREATE TABLE "feature_schema_registry" (
    "feature_version" TEXT NOT NULL,
    "schema_hash" TEXT NOT NULL,
    "feature_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "schema_payload" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),

    CONSTRAINT "feature_schema_registry_pkey" PRIMARY KEY ("feature_version")
);

-- CreateTable
CREATE TABLE "label_schema_registry" (
    "label_version" TEXT NOT NULL,
    "schema_hash" TEXT NOT NULL,
    "prediction_contract_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "target_ids" JSONB NOT NULL,
    "schema_payload" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),

    CONSTRAINT "label_schema_registry_pkey" PRIMARY KEY ("label_version")
);

-- CreateTable
CREATE TABLE "training_dataset_registry" (
    "dataset_version" TEXT NOT NULL,
    "feature_version" TEXT NOT NULL,
    "label_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "manifest_uri" TEXT NOT NULL,
    "manifest_hash" TEXT NOT NULL,
    "split_strategy" TEXT NOT NULL,
    "training_start" TIMESTAMPTZ(3),
    "training_end" TIMESTAMPTZ(3),
    "validation_start" TIMESTAMPTZ(3),
    "validation_end" TIMESTAMPTZ(3),
    "test_start" TIMESTAMPTZ(3),
    "test_end" TIMESTAMPTZ(3),
    "row_count" INTEGER NOT NULL,
    "fixture_count" INTEGER NOT NULL,
    "train_row_count" INTEGER NOT NULL,
    "validation_row_count" INTEGER NOT NULL,
    "test_row_count" INTEGER NOT NULL,
    "metadata_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sealed_at" TIMESTAMPTZ(3),

    CONSTRAINT "training_dataset_registry_pkey" PRIMARY KEY ("dataset_version")
);

-- CreateTable
CREATE TABLE "model_registry_entries" (
    "model_version" TEXT NOT NULL,
    "model_role" TEXT NOT NULL,
    "target" TEXT,
    "status" TEXT NOT NULL,
    "feature_version" TEXT NOT NULL,
    "label_version" TEXT NOT NULL,
    "dataset_version" TEXT NOT NULL,
    "calibration_version" TEXT,
    "artifact_uri" TEXT,
    "artifact_hash" TEXT,
    "configuration_hash" TEXT NOT NULL,
    "metrics_payload" JSONB NOT NULL,
    "metadata_payload" JSONB NOT NULL,
    "trained_at" TIMESTAMPTZ(3),
    "validated_at" TIMESTAMPTZ(3),
    "promoted_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_registry_entries_pkey" PRIMARY KEY ("model_version")
);

-- CreateIndex
CREATE INDEX "prediction_feature_snapshots_fixture_id_as_of_idx" ON "prediction_feature_snapshots"("fixture_id", "as_of");

-- CreateIndex
CREATE INDEX "prediction_feature_snapshots_feature_version_as_of_idx" ON "prediction_feature_snapshots"("feature_version", "as_of");

-- CreateIndex
CREATE INDEX "prediction_feature_snapshots_feature_hash_idx" ON "prediction_feature_snapshots"("feature_hash");

-- CreateIndex
CREATE INDEX "prediction_feature_snapshots_content_hash_idx" ON "prediction_feature_snapshots"("content_hash");

-- CreateIndex
CREATE INDEX "odds_intelligence_assessments_fixture_id_generated_at_idx" ON "odds_intelligence_assessments"("fixture_id", "generated_at");

-- CreateIndex
CREATE INDEX "odds_intelligence_assessments_status_generated_at_idx" ON "odds_intelligence_assessments"("status", "generated_at");

-- CreateIndex
CREATE INDEX "odds_intelligence_assessments_usable_for_model_generated_at_idx" ON "odds_intelligence_assessments"("usable_for_model", "generated_at");

-- CreateIndex
CREATE INDEX "odds_intelligence_assessments_content_hash_idx" ON "odds_intelligence_assessments"("content_hash");

-- CreateIndex
CREATE INDEX "odds_intelligence_markets_assessment_id_idx" ON "odds_intelligence_markets"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "odds_intelligence_markets_assessment_id_market_key_key" ON "odds_intelligence_markets"("assessment_id", "market_key");

-- CreateIndex
CREATE INDEX "odds_intelligence_selections_market_record_id_idx" ON "odds_intelligence_selections"("market_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "odds_intelligence_selections_market_record_id_selection_key_key" ON "odds_intelligence_selections"("market_record_id", "selection_key");

-- CreateIndex
CREATE INDEX "prediction_snapshots_fixture_id_as_of_idx" ON "prediction_snapshots"("fixture_id", "as_of");

-- CreateIndex
CREATE INDEX "prediction_snapshots_feature_snapshot_id_idx" ON "prediction_snapshots"("feature_snapshot_id");

-- CreateIndex
CREATE INDEX "prediction_snapshots_odds_assessment_id_idx" ON "prediction_snapshots"("odds_assessment_id");

-- CreateIndex
CREATE INDEX "prediction_snapshots_feature_version_as_of_idx" ON "prediction_snapshots"("feature_version", "as_of");

-- CreateIndex
CREATE INDEX "prediction_snapshots_ensemble_version_as_of_idx" ON "prediction_snapshots"("ensemble_version", "as_of");

-- CreateIndex
CREATE INDEX "prediction_snapshots_created_at_idx" ON "prediction_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "prediction_snapshots_content_hash_idx" ON "prediction_snapshots"("content_hash");

-- CreateIndex
CREATE INDEX "prediction_specialist_contributions_prediction_snapshot_id_idx" ON "prediction_specialist_contributions"("prediction_snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_specialist_contributions_prediction_snapshot_id__key" ON "prediction_specialist_contributions"("prediction_snapshot_id", "model_role", "model_version");

-- CreateIndex
CREATE INDEX "prediction_label_revisions_prediction_snapshot_id_label_ver_idx" ON "prediction_label_revisions"("prediction_snapshot_id", "label_version", "revision");

-- CreateIndex
CREATE INDEX "prediction_label_revisions_fixture_id_labeled_at_idx" ON "prediction_label_revisions"("fixture_id", "labeled_at");

-- CreateIndex
CREATE INDEX "prediction_label_revisions_status_labeled_at_idx" ON "prediction_label_revisions"("status", "labeled_at");

-- CreateIndex
CREATE INDEX "prediction_label_revisions_content_hash_idx" ON "prediction_label_revisions"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_label_revisions_prediction_snapshot_id_label_ver_key" ON "prediction_label_revisions"("prediction_snapshot_id", "label_version", "revision");

-- CreateIndex
CREATE INDEX "prediction_evaluations_target_model_version_evaluated_at_idx" ON "prediction_evaluations"("target", "model_version", "evaluated_at");

-- CreateIndex
CREATE INDEX "prediction_evaluations_fixture_id_evaluated_at_idx" ON "prediction_evaluations"("fixture_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "prediction_evaluations_prediction_snapshot_id_idx" ON "prediction_evaluations"("prediction_snapshot_id");

-- CreateIndex
CREATE INDEX "prediction_evaluations_passed_quality_gate_evaluated_at_idx" ON "prediction_evaluations"("passed_quality_gate", "evaluated_at");

-- CreateIndex
CREATE INDEX "prediction_evaluations_content_hash_idx" ON "prediction_evaluations"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "feature_schema_registry_schema_hash_key" ON "feature_schema_registry"("schema_hash");

-- CreateIndex
CREATE UNIQUE INDEX "label_schema_registry_schema_hash_key" ON "label_schema_registry"("schema_hash");

-- CreateIndex
CREATE INDEX "training_dataset_registry_feature_version_idx" ON "training_dataset_registry"("feature_version");

-- CreateIndex
CREATE INDEX "training_dataset_registry_label_version_idx" ON "training_dataset_registry"("label_version");

-- CreateIndex
CREATE INDEX "training_dataset_registry_status_idx" ON "training_dataset_registry"("status");

-- CreateIndex
CREATE INDEX "model_registry_entries_model_role_idx" ON "model_registry_entries"("model_role");

-- CreateIndex
CREATE INDEX "model_registry_entries_status_idx" ON "model_registry_entries"("status");

-- CreateIndex
CREATE INDEX "model_registry_entries_feature_version_idx" ON "model_registry_entries"("feature_version");

-- CreateIndex
CREATE INDEX "model_registry_entries_label_version_idx" ON "model_registry_entries"("label_version");

-- CreateIndex
CREATE INDEX "model_registry_entries_dataset_version_idx" ON "model_registry_entries"("dataset_version");

-- AddForeignKey
ALTER TABLE "odds_intelligence_markets" ADD CONSTRAINT "odds_intelligence_markets_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "odds_intelligence_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_intelligence_selections" ADD CONSTRAINT "odds_intelligence_selections_market_record_id_fkey" FOREIGN KEY ("market_record_id") REFERENCES "odds_intelligence_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_snapshots" ADD CONSTRAINT "prediction_snapshots_feature_snapshot_id_fkey" FOREIGN KEY ("feature_snapshot_id") REFERENCES "prediction_feature_snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_snapshots" ADD CONSTRAINT "prediction_snapshots_odds_assessment_id_fkey" FOREIGN KEY ("odds_assessment_id") REFERENCES "odds_intelligence_assessments"("assessment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_specialist_contributions" ADD CONSTRAINT "prediction_specialist_contributions_prediction_snapshot_id_fkey" FOREIGN KEY ("prediction_snapshot_id") REFERENCES "prediction_snapshots"("snapshot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_label_revisions" ADD CONSTRAINT "prediction_label_revisions_prediction_snapshot_id_fkey" FOREIGN KEY ("prediction_snapshot_id") REFERENCES "prediction_snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_evaluations" ADD CONSTRAINT "prediction_evaluations_prediction_snapshot_id_fkey" FOREIGN KEY ("prediction_snapshot_id") REFERENCES "prediction_snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Scalar safety checks for the permanent prediction storage boundary.
ALTER TABLE "prediction_feature_snapshots"
  ADD CONSTRAINT "prediction_feature_snapshots_scalar_checks" CHECK (
    "coverage_score" BETWEEN 0 AND 1 AND
    "feature_count" >= 0 AND
    ("minute" IS NULL OR "minute" BETWEEN 0 AND 120) AND
    ("home_score" IS NULL OR "home_score" >= 0) AND
    ("away_score" IS NULL OR "away_score" >= 0) AND
    "generated_at" >= "as_of"
  );

ALTER TABLE "odds_intelligence_assessments"
  ADD CONSTRAINT "odds_intelligence_assessments_scalar_checks" CHECK (
    "overall_reliability_score" BETWEEN 0 AND 1 AND
    "recommended_market_model_weight" BETWEEN 0 AND 1 AND
    "consensus_score" BETWEEN 0 AND 1 AND
    "freshness_score" BETWEEN 0 AND 1 AND
    "volatility_score" BETWEEN 0 AND 1 AND
    "anomaly_score" BETWEEN 0 AND 1 AND
    "market_count" >= 0 AND "usable_market_count" >= 0 AND
    "provider_count" >= 0 AND "snapshot_count" >= 0 AND
    "usable_market_count" <= "market_count"
  );

ALTER TABLE "odds_intelligence_markets"
  ADD CONSTRAINT "odds_intelligence_markets_scalar_checks" CHECK (
    "selection_count" >= 0 AND "provider_count" >= 0 AND "snapshot_count" >= 0 AND
    "volatility_score" BETWEEN 0 AND 1 AND "reliability_score" BETWEEN 0 AND 1 AND
    "recommended_model_weight" BETWEEN 0 AND 1
  );

ALTER TABLE "odds_intelligence_selections"
  ADD CONSTRAINT "odds_intelligence_selections_scalar_checks" CHECK (
    "fair_probability" BETWEEN 0 AND 1 AND "consensus_probability" BETWEEN 0 AND 1
  );

ALTER TABLE "prediction_snapshots"
  ADD CONSTRAINT "prediction_snapshots_scalar_checks" CHECK (
    "feature_count" >= 0 AND
    ("minute" IS NULL OR "minute" BETWEEN 0 AND 120) AND
    ("home_score" IS NULL OR "home_score" >= 0) AND
    ("away_score" IS NULL OR "away_score" >= 0) AND
    "generated_at" >= "as_of" AND
    "final_outcome_home" BETWEEN 0 AND 1 AND "final_outcome_draw" BETWEEN 0 AND 1 AND "final_outcome_away" BETWEEN 0 AND 1 AND
    "next_goal_home" BETWEEN 0 AND 1 AND "next_goal_none" BETWEEN 0 AND 1 AND "next_goal_away" BETWEEN 0 AND 1 AND
    "goal_next_5m" BETWEEN 0 AND 1 AND "goal_next_10m" BETWEEN 0 AND 1 AND "goal_next_15m" BETWEEN 0 AND 1 AND
    "goal_next_5m" <= "goal_next_10m" AND "goal_next_10m" <= "goal_next_15m" AND
    "current_result_holds" BETWEEN 0 AND 1 AND "current_result_changes" BETWEEN 0 AND 1 AND
    "momentum_home_strengthens" BETWEEN 0 AND 1 AND "momentum_neutral" BETWEEN 0 AND 1 AND "momentum_away_strengthens" BETWEEN 0 AND 1 AND
    "confidence_score" BETWEEN 0 AND 1 AND "odds_reliability_score" BETWEEN 0 AND 1 AND "assigned_market_weight" BETWEEN 0 AND 1
  );

ALTER TABLE "prediction_specialist_contributions"
  ADD CONSTRAINT "prediction_specialist_contributions_scalar_checks" CHECK (
    "assigned_weight" BETWEEN 0 AND 1 AND "output_quality" BETWEEN 0 AND 1
  );

ALTER TABLE "prediction_label_revisions"
  ADD CONSTRAINT "prediction_label_revisions_scalar_checks" CHECK (
    "revision" > 0 AND
    ("final_home_score" IS NULL OR "final_home_score" >= 0) AND
    ("final_away_score" IS NULL OR "final_away_score" >= 0) AND
    "labeled_at" >= "as_of"
  );

ALTER TABLE "prediction_evaluations"
  ADD CONSTRAINT "prediction_evaluations_scalar_checks" CHECK (
    ("multiclass_log_loss" IS NULL OR "multiclass_log_loss" >= 0) AND
    ("multiclass_brier_score" IS NULL OR "multiclass_brier_score" >= 0) AND
    ("binary_log_loss" IS NULL OR "binary_log_loss" >= 0) AND
    ("binary_brier_score" IS NULL OR "binary_brier_score" >= 0) AND
    ("negative_log_likelihood" IS NULL OR "negative_log_likelihood" >= 0) AND
    ("expected_calibration_error" IS NULL OR "expected_calibration_error" BETWEEN 0 AND 1) AND
    ("accuracy" IS NULL OR "accuracy" BETWEEN 0 AND 1) AND
    ("precision" IS NULL OR "precision" BETWEEN 0 AND 1) AND
    ("recall" IS NULL OR "recall" BETWEEN 0 AND 1) AND
    ("roc_auc" IS NULL OR "roc_auc" BETWEEN 0 AND 1) AND
    ("pr_auc" IS NULL OR "pr_auc" BETWEEN 0 AND 1)
  );

ALTER TABLE "feature_schema_registry"
  ADD CONSTRAINT "feature_schema_registry_scalar_checks" CHECK ("feature_count" >= 0);

ALTER TABLE "training_dataset_registry"
  ADD CONSTRAINT "training_dataset_registry_scalar_checks" CHECK (
    "row_count" >= 0 AND "fixture_count" >= 0 AND "train_row_count" >= 0 AND
    "validation_row_count" >= 0 AND "test_row_count" >= 0
  );

