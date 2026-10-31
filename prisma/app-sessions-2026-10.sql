-- MentorsMD: sign-in for the phone app (Oct 2026).
--
-- "AppSession": one row per phone signed in to the MentorsMD app
-- (lib/appAuth.ts). Only a hash of the app's refresh token is stored.
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- Preview: the same Supabase project, schema "preview". Put
--   SET search_path TO preview;
-- on the first line, and
--   GRANT SELECT, INSERT, UPDATE, DELETE ON "AppSession" TO mentorsmd_preview;
-- on the last.
-- It only ADDS a table (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

CREATE TABLE IF NOT EXISTS "AppSession" (
  "id"          TEXT         NOT NULL,
  "refreshHash" TEXT         NOT NULL,
  "platform"    TEXT         NOT NULL,
  "deviceName"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"   TIMESTAMP(3),
  "userId"      TEXT         NOT NULL,
  CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppSession_refreshHash_key" ON "AppSession"("refreshHash");
CREATE INDEX IF NOT EXISTS "AppSession_userId_revokedAt_idx" ON "AppSession"("userId", "revokedAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppSession_userId_fkey' AND conrelid = '"AppSession"'::regclass) THEN
    ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "AppSession" ENABLE ROW LEVEL SECURITY;
