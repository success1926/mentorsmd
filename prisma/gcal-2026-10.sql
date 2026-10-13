-- MentorsMD (Oct 2026): one-click "Connect Google Calendar" for mentors.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). It only ADDS three empty
-- columns (with IF NOT EXISTS), so it's safe to run while the current site
-- is live, and safe to run twice. Run it BEFORE the new code goes live.

-- Which Google account is connected, its permission (an encrypted refresh
-- token, never the plain token) and when it was connected.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalEmail" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalConnectedAt" TIMESTAMP(3);

-- Check: every line should say "true".
SELECT 'User.googleCalEmail column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'googleCalEmail') AS ok
UNION ALL
SELECT 'User.googleCalRefreshToken column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'googleCalRefreshToken')
UNION ALL
SELECT 'User.googleCalConnectedAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'googleCalConnectedAt');
