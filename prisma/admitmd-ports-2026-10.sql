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

-- Part 3 (school logo strips, Press page): no database changes.

-- ======================================================================
-- Part 4: gifts from a parent (/gift, lib/gifts.ts) and cycle results
-- (/dashboard/results, lib/cycleResults.ts; switched off until
-- NEXT_PUBLIC_CYCLE_RESULTS=1)
-- ======================================================================
-- No changes to existing tables: gifted credit is a "CreditEntry" with
-- reason GIFT, and a gifted package is a normal "Order".

-- One row per gift a parent or guardian paid for (credit or a package).
CREATE TABLE IF NOT EXISTS "Gift" (
  "id"                    TEXT         NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind"                  TEXT         NOT NULL,
  "status"                TEXT         NOT NULL DEFAULT 'PENDING',
  "amountCents"           INTEGER      NOT NULL,
  "parentName"            TEXT         NOT NULL,
  "parentEmail"           TEXT         NOT NULL,
  "studentName"           TEXT         NOT NULL,
  "studentEmail"          TEXT         NOT NULL,
  "note"                  TEXT,
  "studentUnder18"        BOOLEAN      NOT NULL DEFAULT false,
  "gigId"                 TEXT,
  "mentorId"              TEXT,
  "minutes"               INTEGER,
  "rateCents"             INTEGER,
  "packageTitle"          TEXT,
  "studentId"             TEXT,
  "orderId"               TEXT,
  "creditEntryId"         TEXT,
  "stripeSessionId"       TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt"                TIMESTAMP(3),
  "reviewNote"            TEXT,
  "viewTokenHash"         TEXT         NOT NULL,
  "claimTokenHash"        TEXT,
  "claimExpiresAt"        TIMESTAMP(3),
  "claimedAt"             TIMESTAMP(3),
  "ip"                    TEXT,
  CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_orderId_key" ON "Gift"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_creditEntryId_key" ON "Gift"("creditEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_stripeSessionId_key" ON "Gift"("stripeSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_viewTokenHash_key" ON "Gift"("viewTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_claimTokenHash_key" ON "Gift"("claimTokenHash");
CREATE INDEX IF NOT EXISTS "Gift_status_createdAt_idx" ON "Gift"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Gift_studentId_idx" ON "Gift"("studentId");
CREATE INDEX IF NOT EXISTS "Gift_parentEmail_createdAt_idx" ON "Gift"("parentEmail", "createdAt");
ALTER TABLE "Gift" ENABLE ROW LEVEL SECURITY;

-- A student's application results, one row per school per cycle.
CREATE TABLE IF NOT EXISTS "CycleResult" (
  "id"          TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "userId"      TEXT         NOT NULL,
  "cycle"       INTEGER      NOT NULL,
  "school"      TEXT         NOT NULL,
  "status"      TEXT         NOT NULL,
  "appliedOn"   DATE,
  "interviewOn" DATE,
  "decisionOn"  DATE,
  "mentorIds"   TEXT[]       DEFAULT ARRAY[]::TEXT[],
  "note"        TEXT,
  CONSTRAINT "CycleResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CycleResult_userId_cycle_school_key" ON "CycleResult"("userId", "cycle", "school");
CREATE INDEX IF NOT EXISTS "CycleResult_cycle_status_idx" ON "CycleResult"("cycle", "status");
ALTER TABLE "CycleResult" ENABLE ROW LEVEL SECURITY;
