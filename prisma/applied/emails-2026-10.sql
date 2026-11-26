-- MentorsMD editable emails and email log (Oct 2026).
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.

-- Admin -> Emails: wording an admin saved for an automatic email. An
-- email with no row here uses its default wording from the code.
CREATE TABLE IF NOT EXISTS "EmailTemplate" (
  "key" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("key")
);

-- Admin -> Email log: one row per send attempt (never the email body).
-- Rows older than 90 days are deleted by the daily safety cron.
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "templateKey" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerId" TEXT,
  "error" TEXT,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_templateKey_createdAt_idx" ON "EmailLog"("templateKey", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_toEmail_createdAt_idx" ON "EmailLog"("toEmail", "createdAt");
