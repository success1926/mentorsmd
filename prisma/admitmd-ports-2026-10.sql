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

-- ======================================================================
-- Part 2: reminder emails sent by the daily cron (lib/scheduledEmails.ts,
-- /api/cron/emails) and Admin -> Emails -> Outbox
-- ======================================================================

-- "Stop these reminders" link in every reminder email.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "remindersOffAt" TIMESTAMP(3);

-- On/off and timing of each reminder email (no row = off).
CREATE TABLE IF NOT EXISTS "EmailSchedule" (
  "key"         TEXT         NOT NULL,
  "enabled"     BOOLEAN      NOT NULL DEFAULT false,
  "timing"      TEXT         NOT NULL,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "EmailSchedule_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "EmailSchedule" ENABLE ROW LEVEL SECURITY;

-- Which reminder went to whom, so no step is ever sent twice.
CREATE TABLE IF NOT EXISTS "ScheduledEmailSent" (
  "id"      TEXT         NOT NULL,
  "key"     TEXT         NOT NULL,
  "refId"   TEXT         NOT NULL,
  "step"    INTEGER      NOT NULL,
  "userId"  TEXT         NOT NULL,
  "aboutId" TEXT,
  "toEmail" TEXT         NOT NULL,
  "sentAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledEmailSent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledEmailSent_key_refId_step_key" ON "ScheduledEmailSent"("key", "refId", "step");
CREATE INDEX IF NOT EXISTS "ScheduledEmailSent_key_sentAt_idx" ON "ScheduledEmailSent"("key", "sentAt");
CREATE INDEX IF NOT EXISTS "ScheduledEmailSent_userId_key_idx" ON "ScheduledEmailSent"("userId", "key");
ALTER TABLE "ScheduledEmailSent" ENABLE ROW LEVEL SECURITY;
