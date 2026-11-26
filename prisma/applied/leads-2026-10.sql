-- MentorsMD leads inbox, waitlist and contact form (Oct 2026).
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.

-- Waitlist signups ("Tell me when mentors join") and contact-form
-- messages, with their status and who on the team is looking after them.
CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "topic" TEXT,
  "message" TEXT,
  "service" TEXT,
  "applyYear" TEXT,
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "assignedToId" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_dedupeKey_key" ON "Lead"("dedupeKey");
CREATE INDEX IF NOT EXISTS "Lead_kind_status_createdAt_idx" ON "Lead"("kind", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_kind_notifiedAt_idx" ON "Lead"("kind", "notifiedAt");
CREATE INDEX IF NOT EXISTS "Lead_email_createdAt_idx" ON "Lead"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_ipHash_createdAt_idx" ON "Lead"("ipHash", "createdAt");
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mentor applications: who on the team is looking after each one.
ALTER TABLE "MentorApplication" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
DO $$ BEGIN
  ALTER TABLE "MentorApplication" ADD CONSTRAINT "MentorApplication_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Internal team notes on a lead or a mentor application.
CREATE TABLE IF NOT EXISTS "LeadNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "applicationId" TEXT,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadNote_applicationId_createdAt_idx" ON "LeadNote"("applicationId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "MentorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
