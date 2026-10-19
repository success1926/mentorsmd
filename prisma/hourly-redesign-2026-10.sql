-- MentorsMD redesign (Oct 2026): hourly pricing, hours, intro calls, credit,
-- monthly payouts (docs/redesign-2026-10.md). The database change for ALL
-- three parts of the redesign.
--
-- RUN THIS TWICE in the Supabase SQL Editor (make a backup first):
--   1. as it is, for the live tables;
--   2. again with this line added at the very top, for the preview copy:
--        SET search_path TO preview;
-- Everything here only ADDS things (new tables, new columns that are
-- empty or have a default, new indexes) with IF NOT EXISTS, so it's safe to
-- run while the current site is live, and safe to run more than once. The
-- one loosened rule: a call no longer has to belong to an order (free intro
-- calls have none). Nothing is dropped or renamed. Run it BEFORE the new
-- code goes live.
--
-- Matches `prisma migrate diff` from the schema before the redesign to
-- prisma/schema.prisma. No enum changes are needed: the new "kind" and
-- "status" values are text columns, like the existing ones (including
-- MentorPayout.status PROCESSING / PAID / FAILED and the dispute outcome
-- "CREDIT" added in part 3, which need no database change).

-- ---------- Mentor profile sections and hourly rate ----------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "admissionsRoles" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "yearsAdvising" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "applicantsSupported" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "strongestStages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "specialtyInterest" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "researchSummary" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bestFor" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bestForOther" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "knownFor" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "languages" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "funFact" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hourlyRateCents" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileCompleteAt" TIMESTAMP(3);

-- ---------- Offers: hourly, hour bundles, specialized packages ----------
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "minutes" INTEGER;
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "rateCents" INTEGER;
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Gig_sellerId_kind_active_idx" ON "Gig"("sellerId", "kind", "active");

-- ---------- Orders: hours, rate, snapshot, finishing ----------
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "minutesPurchased" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rateCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packageTitle" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packageDescription" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "creditAppliedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "markedCompleteAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "responseDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastCallUsedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastRevisionUsedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastRequestNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autoApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lowHoursEmailAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "requestedCallStart" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unusedMinutesPaid" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "payoutId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_status_responseDeadline_idx" ON "Order"("status", "responseDeadline");
CREATE INDEX IF NOT EXISTS "Order_payoutId_idx" ON "Order"("payoutId");

-- ---------- Calls: free intro calls (no order) ----------
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'ORDER';
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "mentorId" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "introKey" TEXT;
ALTER TABLE "CallBooking" ALTER COLUMN "orderId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "CallBooking_introKey_key" ON "CallBooking"("introKey");
CREATE INDEX IF NOT EXISTS "CallBooking_mentorId_status_startTime_idx" ON "CallBooking"("mentorId", "status", "startTime");
CREATE INDEX IF NOT EXISTS "CallBooking_studentId_status_startTime_idx" ON "CallBooking"("studentId", "status", "startTime");

-- ---------- Messages and files tagged with their order ----------
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
CREATE INDEX IF NOT EXISTS "Message_orderId_createdAt_idx" ON "Message"("orderId", "createdAt");

-- ---------- Monthly payouts to mentors ----------
CREATE TABLE IF NOT EXISTS "MentorPayout" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "mentorId" TEXT NOT NULL,

    CONSTRAINT "MentorPayout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MentorPayout_mentorId_period_key" ON "MentorPayout"("mentorId", "period");
CREATE INDEX IF NOT EXISTS "MentorPayout_period_status_idx" ON "MentorPayout"("period", "status");
CREATE INDEX IF NOT EXISTS "MentorPayout_status_createdAt_idx" ON "MentorPayout"("status", "createdAt");

-- ---------- Hours log ----------
CREATE TABLE IF NOT EXISTS "HourEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "orderId" TEXT NOT NULL,
    "loggedById" TEXT,
    "callBookingId" TEXT,
    "payoutId" TEXT,

    CONSTRAINT "HourEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HourEntry_callBookingId_key" ON "HourEntry"("callBookingId");
CREATE INDEX IF NOT EXISTS "HourEntry_orderId_workDate_idx" ON "HourEntry"("orderId", "workDate");
CREATE INDEX IF NOT EXISTS "HourEntry_payoutId_idx" ON "HourEntry"("payoutId");
CREATE INDEX IF NOT EXISTS "HourEntry_createdAt_idx" ON "HourEntry"("createdAt");

-- ---------- Add-hours (top-up) purchases ----------
CREATE TABLE IF NOT EXISTS "HourTopUp" (
    "id" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "creditAppliedCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,

    CONSTRAINT "HourTopUp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HourTopUp_stripeSessionId_key" ON "HourTopUp"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "HourTopUp_orderId_createdAt_idx" ON "HourTopUp"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "HourTopUp_buyerId_createdAt_idx" ON "HourTopUp"("buyerId", "createdAt");

-- ---------- MentorsMD credit ledger ----------
CREATE TABLE IF NOT EXISTS "CreditEntry" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "topUpId" TEXT,
    "adminId" TEXT,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditEntry_orderId_idx" ON "CreditEntry"("orderId");

-- ---------- Foreign keys (each skipped if it already exists) ----------
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "MentorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CallBooking" ADD CONSTRAINT "CallBooking_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CallBooking" ADD CONSTRAINT "CallBooking_mentorId_fkey"
    FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorPayout" ADD CONSTRAINT "MentorPayout_mentorId_fkey"
    FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_loggedById_fkey"
    FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_callBookingId_fkey"
    FOREIGN KEY ("callBookingId") REFERENCES "CallBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "MentorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourTopUp" ADD CONSTRAINT "HourTopUp_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HourTopUp" ADD CONSTRAINT "HourTopUp_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
