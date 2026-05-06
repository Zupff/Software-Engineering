-- Add start_date and end_date to tasks. Both nullable so existing tasks
-- without dates remain valid. The check constraint allows nulls but
-- enforces start <= end when both are present.
--
-- Run once against your existing database with:
--   psql -d <db_name> -f migrations/001_add_task_dates.sql

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_dates_order;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_dates_order
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
