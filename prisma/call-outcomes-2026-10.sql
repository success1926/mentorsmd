-- MentorsMD (Oct 2026): automatic call outcomes and no-shows.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). It only ADDS three empty
-- columns (with IF NOT EXISTS), so it's safe to run while the current site
-- is live, and safe to run twice. Run it BEFORE the new code goes live,
-- on both the production and preview branches.

-- What happened at each call (held, student no-show, mentor no-show,
-- nobody joined...), when that was decided, and which admin decided it
-- (empty = decided automatically from Daily's attendance).
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "outcomeAt" TIMESTAMP(3);
ALTER TABLE "CallBooking" ADD COLUMN IF NOT EXISTS "outcomeById" TEXT;

-- Check: every line should say "true".
SELECT 'CallBooking.outcome column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CallBooking' AND column_name = 'outcome') AS ok
UNION ALL
SELECT 'CallBooking.outcomeAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CallBooking' AND column_name = 'outcomeAt')
UNION ALL
SELECT 'CallBooking.outcomeById column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CallBooking' AND column_name = 'outcomeById');
