-- Additive expand migration. Existing rows remain valid until evidence-backed reconciliation fills the ID.
ALTER TABLE "fixtures" ADD COLUMN "competition_id" TEXT;

CREATE INDEX "fixtures_competition_id_idx" ON "fixtures"("competition_id");

