-- Migration 006: replace study_sessions.task_id (one-to-one) with a
-- session_tasks junction table (many-to-many).
--
-- Brief requirement: "An activity can be attached to multiple tasks and
-- thereby contribute to the completion of both."
--
-- Strategy:
--   1) Create the junction table if it does not yet exist.
--   2) Backfill rows from existing study_sessions.task_id values.
--   3) Drop study_sessions.task_id once data is migrated.
--
-- Safe to run multiple times.

BEGIN;

-- 1. junction table
CREATE TABLE IF NOT EXISTS session_tasks (
    session_id INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    task_id    INTEGER NOT NULL REFERENCES tasks(id)          ON DELETE CASCADE,
    PRIMARY KEY (session_id, task_id)
);

-- 2. backfill existing single-task links (no-op on subsequent runs because
--    of the PRIMARY KEY conflict; only fires the first time)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   information_schema.columns
        WHERE  table_name = 'study_sessions'
        AND    column_name = 'task_id'
    ) THEN
        INSERT INTO session_tasks (session_id, task_id)
        SELECT id, task_id
        FROM   study_sessions
        WHERE  task_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 3. drop the legacy column (idempotent — IF EXISTS)
ALTER TABLE study_sessions DROP COLUMN IF EXISTS task_id;

COMMIT;
