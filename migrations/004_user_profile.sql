-- Add profile fields to users for the onboarding flow. All nullable so
-- existing accounts stay valid; a missing display_name is the signal the
-- frontend uses to fire the onboarding modal.
--
-- Run with:
--   psql -d backend_dev -f migrations/004_user_profile.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name  VARCHAR,
  ADD COLUMN IF NOT EXISTS course        VARCHAR,
  ADD COLUMN IF NOT EXISTS avatar_id     VARCHAR,
  ADD COLUMN IF NOT EXISTS avatar_color  VARCHAR;
