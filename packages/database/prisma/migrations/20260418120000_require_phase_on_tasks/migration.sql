-- Create a "Backlog" phase for each project that has tasks without a phase.
-- Then assign those orphan tasks to the backlog, and finally enforce NOT NULL.

INSERT INTO phases (id, project_id, title, status, order_index, created_at, updated_at)
SELECT
  'backlog_' || p.id,
  p.id,
  'Backlog',
  'planned',
  0,
  NOW(),
  NOW()
FROM projects p
WHERE EXISTS (
  SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.phase_id IS NULL
)
ON CONFLICT DO NOTHING;

-- Assign orphan tasks to their project's Backlog phase
UPDATE tasks
SET phase_id = 'backlog_' || project_id
WHERE phase_id IS NULL;

-- Enforce NOT NULL on phase_id
ALTER TABLE tasks ALTER COLUMN phase_id SET NOT NULL;

-- Drop the old SET NULL foreign key and recreate as RESTRICT
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_phase_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_phase_id_fkey
  FOREIGN KEY (phase_id) REFERENCES phases(id) ON UPDATE CASCADE ON DELETE RESTRICT;
