-- Many-to-many join between milestones and the tasks that complete them.
-- Idempotent: re-running on a DB that already has it is a no-op.
--
-- Run with:
--   psql -d backend_dev -f migrations/003_milestone_tasks.sql

CREATE TABLE IF NOT EXISTS milestone_tasks (
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, task_id)
);
