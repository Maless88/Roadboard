ALTER TABLE "phases" ADD COLUMN "decision_id" TEXT;

ALTER TABLE "phases" ADD CONSTRAINT "phases_decision_id_fkey"
  FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
