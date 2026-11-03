-- MentorsMD: "Where are you now?" on the mentor application (Nov 2026):
-- gap year and something else, alongside medical student/resident and BS/MD.
-- Stored in MentorApplication."trainingStage": UNDERGRAD, GAP_YEAR or OTHER; empty
-- for a medical student or resident. Existing applications stay empty (the
-- code reads an empty one with a college as UNDERGRAD).
--
-- Run it on BOTH the live schema and the preview schema, BEFORE merging the
-- pull request. It only ADDS a column (IF NOT EXISTS), so it's safe while the
-- current site is live, and safe to run twice.

ALTER TABLE "MentorApplication" ADD COLUMN IF NOT EXISTS "trainingStage" TEXT;
