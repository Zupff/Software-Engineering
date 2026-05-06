-- Adds the semesters table and links modules to it. Existing modules are
-- attached to a default "Spring 2025-26" semester so no data is orphaned.
-- Idempotent: safe to run on a fresh DB (no-ops the parts already done).
--
-- Run with:
--   psql -d backend_dev -f migrations/002_add_semesters.sql

CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL,
  academic_year VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id) ON DELETE CASCADE;

-- For every user that has existing modules without a semester, create a
-- default semester and assign their orphan modules to it.
DO $$
DECLARE
  u RECORD;
  new_semester_id INTEGER;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id
      FROM modules
     WHERE semester_id IS NULL AND user_id IS NOT NULL
  LOOP
    INSERT INTO semesters (user_id, name, academic_year)
    VALUES (u.user_id, 'Spring 2025-26', '2025-26')
    ON CONFLICT (user_id, name) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING id INTO new_semester_id;

    UPDATE modules
       SET semester_id = new_semester_id
     WHERE user_id = u.user_id
       AND semester_id IS NULL;
  END LOOP;
END $$;
