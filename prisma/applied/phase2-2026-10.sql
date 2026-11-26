-- MentorsMD Phase 2 (Oct 2026): deliveries and mentor applications.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.

-- Deliveries: one row each time a mentor marks work complete.
CREATE TABLE IF NOT EXISTS "Delivery" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "files" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId" TEXT NOT NULL,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_orderId_number_key" ON "Delivery"("orderId", "number");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Delivery_orderId_fkey') THEN
    ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Mentor applications from the public application form.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApplicationStatus') THEN
    CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'INVITED', 'DECLINED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MentorApplication" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "medicalSchool" TEXT NOT NULL,
  "residency" TEXT,
  "blurb" TEXT NOT NULL,
  "resumeUrl" TEXT NOT NULL,
  "resumeName" TEXT NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "inviteId" TEXT,
  CONSTRAINT "MentorApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MentorApplication_status_createdAt_idx" ON "MentorApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MentorApplication_email_createdAt_idx" ON "MentorApplication"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "MentorApplication_ipHash_createdAt_idx" ON "MentorApplication"("ipHash", "createdAt");

-- Check: both lines should say "true".
SELECT 'Delivery table' AS item, to_regclass('"Delivery"') IS NOT NULL AS ok
UNION ALL
SELECT 'MentorApplication table', to_regclass('"MentorApplication"') IS NOT NULL;
