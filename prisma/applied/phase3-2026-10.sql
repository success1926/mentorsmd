-- MentorsMD Phase 3 (Oct 2026): built-in calendar, private video calls,
-- attendance, recordings, busy dates and call reminders.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.
-- The old Cal.com columns stay where they are; the new code just stops
-- using them.

-- Time zone on every account, and the mentor's call availability.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timeZone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weeklyHours" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "minNoticeHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "daysOff" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalCalUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalBusy" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalBusyFetchedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalCalError" TEXT;

-- Each order remembers the package's turnaround at the time it was placed.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "turnaround" TEXT;

-- Calls: Daily room, who booked/cancelled, invite updates, reminder flags.
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "roomName" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "roomUrl" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "bookedById" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "icsSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "morningReminderStudentAt" TIMESTAMP(3);
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "morningReminderMentorAt" TIMESTAMP(3);
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "hourReminderAt" TIMESTAMP(3);
-- New calls are booked on the site, not Cal.com (the code always sets this anyway).
ALTER TABLE "CallBooking" ALTER COLUMN "source" SET DEFAULT 'SITE';
CREATE INDEX IF NOT EXISTS "CallBooking_roomName_idx" ON "CallBooking"("roomName");

-- Attendance: who joined each call and when (from Daily's webhooks).
CREATE TABLE IF NOT EXISTS "CallAttendance" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL,
  "leftAt" TIMESTAMP(3),
  "durationSec" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT,
  CONSTRAINT "CallAttendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CallAttendance_sessionId_key" ON "CallAttendance"("sessionId");
CREATE INDEX IF NOT EXISTS "CallAttendance_bookingId_joinedAt_idx" ON "CallAttendance"("bookingId", "joinedAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallAttendance_bookingId_fkey') THEN
    ALTER TABLE "CallAttendance" ADD CONSTRAINT "CallAttendance_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "CallBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallAttendance_userId_fkey') THEN
    ALTER TABLE "CallAttendance" ADD CONSTRAINT "CallAttendance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Recordings (admin-only; deleted 60 days after the order closes).
CREATE TABLE IF NOT EXISTS "CallRecording" (
  "id" TEXT NOT NULL,
  "dailyRecordingId" TEXT NOT NULL,
  "status" TEXT,
  "startedAt" TIMESTAMP(3),
  "durationSec" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "bookingId" TEXT NOT NULL,
  CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CallRecording_dailyRecordingId_key" ON "CallRecording"("dailyRecordingId");
CREATE INDEX IF NOT EXISTS "CallRecording_deletedAt_createdAt_idx" ON "CallRecording"("deletedAt", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallRecording_bookingId_fkey') THEN
    ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "CallBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Mentor busy dates (private note; blocks due dates, and optionally calls).
CREATE TABLE IF NOT EXISTS "BusyDate" (
  "id" TEXT NOT NULL,
  "startDay" TEXT NOT NULL,
  "endDay" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'NO_DEADLINES',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  CONSTRAINT "BusyDate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BusyDate_userId_startDay_idx" ON "BusyDate"("userId", "startDay");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusyDate_userId_fkey') THEN
    ALTER TABLE "BusyDate" ADD CONSTRAINT "BusyDate_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Check: every line should say "true".
SELECT 'User.timeZone column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'timeZone') AS ok
UNION ALL
SELECT 'CallBooking.hourReminderAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CallBooking' AND column_name = 'hourReminderAt')
UNION ALL
SELECT 'Order.turnaround column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'turnaround')
UNION ALL
SELECT 'CallAttendance table', to_regclass('"CallAttendance"') IS NOT NULL
UNION ALL
SELECT 'CallRecording table', to_regclass('"CallRecording"') IS NOT NULL
UNION ALL
SELECT 'BusyDate table', to_regclass('"BusyDate"') IS NOT NULL;
