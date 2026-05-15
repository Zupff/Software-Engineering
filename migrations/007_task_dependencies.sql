BEGIN;
--creating a database to hold multiple dependencies 

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id             INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, dependency_task_id),
    CONSTRAINT task_dependencies_not_self CHECK (task_id <> dependency_task_id)
);


INSERT INTO task_dependencies (task_id, dependency_task_id)
SELECT id, dependency_task_id
FROM tasks
WHERE dependency_task_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
