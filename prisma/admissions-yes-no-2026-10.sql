-- MentorsMD: the Yes / No question at the start of "Admissions experience"
-- (mentor area v2, Oct 2026).
--
-- "Have you served on a medical school admissions committee, or as an
-- interviewer or application screener?" The answer is stored in
-- User."hasAdmissionsRoles": true = Yes, false = No, empty = not answered yet.
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- It only ADDS a column (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasAdmissionsRoles" BOOLEAN;

-- Mentors who already listed at least one admissions role answered "Yes".
-- Everyone else stays unanswered and is asked the question on My profile.
UPDATE "User"
SET "hasAdmissionsRoles" = true
WHERE "hasAdmissionsRoles" IS NULL
  AND CASE
        WHEN jsonb_typeof("admissionsRoles") = 'array' THEN jsonb_array_length("admissionsRoles") > 0
        ELSE false
      END;
