-- Migration 007: allow a task to depend on multiple other tasks.
--
-- The legacy tasks.dependency_task_id column only supports one dependency.
-- This junction table supports many dependencies per task while preserving
-- existing dependencies by backfilling from that legacy column.
--
-- Safe to run multiple times.

BEGIN;

-- 1. junction table
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id             INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, dependency_task_id),
    CONSTRAINT task_dependencies_not_self CHECK (task_id <> dependency_task_id)
);

-- 2. backfill existing single-task dependency links from tasks.dependency_task_id
INSERT INTO task_dependencies (task_id, dependency_task_id)
SELECT id, dependency_task_id
FROM tasks
WHERE dependency_task_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
