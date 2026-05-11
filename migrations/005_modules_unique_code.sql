-- Migration 005: deduplicate modules and add UNIQUE (semester_id, module_code)
-- so re-importing a CSV updates rows instead of creating duplicates.
--
-- Strategy:
--   1) Find duplicate (semester_id, module_code) pairs and keep only the
--      oldest row (lowest id). Tasks cascade-delete with their module via
--      the existing FK ON DELETE CASCADE.
--   2) Add the unique constraint (idempotent: skip if already present).
--
-- Safe to run multiple times.

BEGIN;

-- 1. drop dupes keeping lowest id
DELETE FROM modules m
USING modules d
WHERE m.semester_id = d.semester_id
  AND m.module_code = d.module_code
  AND m.id > d.id;

-- 2. add the unique constraint if it does not yet exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'modules_semester_code_key'
    ) THEN
        ALTER TABLE modules
            ADD CONSTRAINT modules_semester_code_key
            UNIQUE (semester_id, module_code);
    END IF;
END $$;

COMMIT;
