-- MentorsMD: "Delete my account" (Oct 2026).
--
-- User."deletedAt": when the person deleted their own account
-- (lib/accountDeletion.ts). Their details and login are wiped; orders,
-- payments and messages stay, shown as "Deleted user".
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- Preview: the same Supabase project, schema "preview"; put
--   SET search_path TO preview;
-- on the first line. It only ADDS a column (IF NOT EXISTS), so it's safe to
-- run while the current site is live, and safe to run twice. Run it BEFORE
-- the new code goes live (before merging the pull request).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
