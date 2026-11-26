-- MentorsMD: undergrads (BS/MD) can apply to mentor (Nov 2026).
--
-- MentorApplication."undergradSchool": the college of an applicant who picked
-- "Undergrad (BS/MD)". Their "medicalSchool" is optional, and empty if not given.
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- It only ADDS a column (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

ALTER TABLE "MentorApplication" ADD COLUMN IF NOT EXISTS "undergradSchool" TEXT;
