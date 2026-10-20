-- MentorsMD: the optional student profile (Oct 2026).
--
-- A short "about you" a student can fill in so their mentors know who
-- they are before a call: when they apply, their stage, MD / DO, school or
-- state, what they want help with, and a few lines about their goals
-- (lib/studentProfile.ts). Only mentors the student has messaged, booked or
-- bought from can see it.
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- It only ADDS columns (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentApplyYear" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentStage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentDegree" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentSchool" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentHelpWith" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentAbout" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentProfileAt" TIMESTAMP(3);
