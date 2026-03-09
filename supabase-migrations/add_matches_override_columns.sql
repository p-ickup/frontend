-- Manual overrides for group subsidized and uber type in admin dashboard.
-- When set, these values are not overwritten when adding or moving riders.
-- Run this in the Supabase SQL editor (or your migration tool) if not already applied.

ALTER TABLE "Matches"
  ADD COLUMN IF NOT EXISTS subsidized_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS uber_type_override boolean DEFAULT false;

COMMENT ON COLUMN "Matches".subsidized_override IS 'When true, is_subsidized is manual and must not be overwritten by add/move logic';
COMMENT ON COLUMN "Matches".uber_type_override IS 'When true, uber_type is manual and must not be overwritten by add/move logic';
