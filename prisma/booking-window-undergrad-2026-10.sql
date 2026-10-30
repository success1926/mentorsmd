-- MentorsMD: how far ahead students can book, and undergrad (BS/MD) mentors
-- (Oct 2026).
--
-- User."bookingWindowDays": how many days into the future students can
-- book a mentor's calls (7, 14, 30, 60 or 90). Everyone starts at 60, the
-- old fixed window, so nothing changes until a mentor picks another.
-- User."undergradSchool": the college of a mentor whose stage is
-- "Undergrad student" (a BS/MD program).
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- It only ADDS columns (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bookingWindowDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "undergradSchool" TEXT;
