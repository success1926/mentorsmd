-- "Successful clients at" logos on mentor cards and profiles (Nov 2026).
-- Run on Supabase BOTH schemas before merging:
--   1. public  (production)
--   2. preview (SET LOCAL search_path TO preview; the preview role already
--      has access to the User table, so no new grant or policy is needed)
-- Safe to run twice.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientSchools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
