-- MentorsMD: features ported from AdmitMD (Oct 2026).
--
-- Open the database's SQL Editor, paste this whole file, and run it once
-- (make a backup first). Everything here only ADDS things (with IF NOT
-- EXISTS), so it's safe to run while the current site is live, and safe
-- to run twice. Run it BEFORE the new code goes live.
--
-- Later parts of the AdmitMD ports add their own sections below.

-- ======================================================================
-- Part 1: 2-step verification for mentors and students, "Trust this
-- device for 30 days" (lib/mfa.ts)
-- ======================================================================
-- No new tables: email codes reuse "AdminMfaToken", per-address email
-- limits and code limits reuse "RateLimitBucket".

-- Devices trusted before this time need a code again ("Forget my trusted
-- devices" in Settings, or an Owner resetting an admin's 2-step).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorTrustAfter" TIMESTAMP(3);
