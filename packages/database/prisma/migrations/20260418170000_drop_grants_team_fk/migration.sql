-- Drop the FK that incorrectly enforces subject_id → teams.id.
-- project_grants.subject_id is polymorphic (can reference a user or a team).
ALTER TABLE "project_grants" DROP CONSTRAINT IF EXISTS "project_grants_team_fk";
