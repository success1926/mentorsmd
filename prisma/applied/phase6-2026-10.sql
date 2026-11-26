-- MentorsMD Phase 6 (Oct 2026): Admin -> Insights. Mentors' medical
-- school, where each account came from (signup source), payment and
-- refund dates on orders, and the private activity log (site visits,
-- mentor profile views, browse searches).
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.

-- Accounts: medical school (mentors) and signup source.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "medicalSchool" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupDetail" TEXT;

-- Orders: when the payment cleared and when it was refunded.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- The private activity log.
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "visitorId" TEXT,
  "mentorId" TEXT,
  "query" TEXT,
  "filters" JSONB,
  "resultCount" INTEGER,
  "source" TEXT,
  "path" TEXT,
  "userId" TEXT,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ActivityEvent_kind_createdAt_idx" ON "ActivityEvent"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_mentorId_kind_createdAt_idx" ON "ActivityEvent"("mentorId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_visitorId_createdAt_idx" ON "ActivityEvent"("visitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityEvent_userId_fkey') THEN
    ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing mentors who joined through an application: copy the medical
-- school they wrote on it. Only fills empty values; nothing is overwritten.
-- Mentors without one are asked on their dashboard.
UPDATE "User" u
SET "medicalSchool" = LEFT(TRIM(a."medicalSchool"), 120)
FROM "MentorApplication" a
JOIN "Invite" i ON i."id" = a."inviteId"
WHERE u."role" = 'SELLER'
  AND u."medicalSchool" IS NULL
  AND i."redeemedByUserId" = u."id"
  AND TRIM(a."medicalSchool") <> '';

-- Check: every row should say true.
SELECT 'User.medicalSchool column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'medicalSchool') AS ok
UNION ALL
SELECT 'User.signupSource column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'signupSource')
UNION ALL
SELECT 'User.signupDetail column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'signupDetail')
UNION ALL
SELECT 'Order.paidAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'paidAt')
UNION ALL
SELECT 'Order.refundedAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'refundedAt')
UNION ALL
SELECT 'ActivityEvent table', to_regclass('"ActivityEvent"') IS NOT NULL;
