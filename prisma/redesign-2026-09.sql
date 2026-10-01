-- MentorsMD redesign (Sept 2026): database changes.
--
-- Two ways to apply them (pick ONE):
--   A) From your computer:  npx prisma db push
--      (uses DIRECT_URL from your .env; this file is then not needed)
--   B) No terminal: open your Neon project -> SQL Editor, paste this whole
--      file, and run it once.
--
-- Everything here only ADDS things, so it's safe to run while the old
-- version of the site is still live. Run it BEFORE deploying the new code.

CREATE TYPE "ProfileStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');
CREATE TYPE "CallStatus" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED');

ALTER TABLE "User"
  ADD COLUMN "profileStatus" "ProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "pausedUntil" TIMESTAMP(3),
  ADD COLUMN "awayNote" TEXT,
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removedReason" TEXT,
  ADD COLUMN "removedByAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mentorStage" TEXT,
  ADD COLUMN "schoolType" TEXT,
  ADD COLUMN "backgrounds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "calLink" TEXT,
  ADD COLUMN "calWebhookSecret" TEXT,
  ADD COLUMN "calendarToken" TEXT;
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");

ALTER TABLE "Gig"
  ADD COLUMN "service" TEXT,
  ADD COLUMN "format" TEXT,
  ADD COLUMN "turnaround" TEXT,
  ADD COLUMN "callsIncluded" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "callLength" INTEGER,
  ADD COLUMN "calEventUrl" TEXT;
CREATE INDEX "Gig_active_service_idx" ON "Gig"("active", "service");

ALTER TABLE "Order"
  ADD COLUMN "callReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "callHoldAt" TIMESTAMP(3),
  ADD COLUMN "callWaivedAt" TIMESTAMP(3),
  ADD COLUMN "callForfeitedAt" TIMESTAMP(3),
  ADD COLUMN "disputeResolvedAt" TIMESTAMP(3),
  ADD COLUMN "disputeResolution" TEXT;

CREATE TABLE "CallBooking" (
  "id" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'BOOKED',
  "source" TEXT NOT NULL DEFAULT 'CAL',
  "calUid" TEXT,
  "meetingUrl" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "orderId" TEXT NOT NULL,
  CONSTRAINT "CallBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallBooking_calUid_key" ON "CallBooking"("calUid");
CREATE INDEX "CallBooking_orderId_startTime_idx" ON "CallBooking"("orderId", "startTime");
CREATE INDEX "CallBooking_status_startTime_idx" ON "CallBooking"("status", "startTime");
ALTER TABLE "CallBooking"
  ADD CONSTRAINT "CallBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
