-- MentorsMD: Apple App Attest for the phone app's sign-in (Nov 2026).
--
-- "AppAttestKey": one row per installed copy of the MentorsMD iPhone app
-- (lib/appAttest.ts). Only the public half of each key is stored.
--
-- Open the database's SQL Editor, paste this whole file and run it once, on
-- BOTH the live database and the preview database (make a backup first).
-- Preview: the same Supabase project, schema "preview". Put
--   SET search_path TO preview;
-- on the first line, and
--   GRANT SELECT, INSERT, UPDATE, DELETE ON "AppAttestKey" TO mentorsmd_preview;
--   CREATE POLICY "preview app full access" ON "AppAttestKey" FOR ALL TO mentorsmd_preview USING (true) WITH CHECK (true);
-- at the end (the preview site connects as mentorsmd_preview, which row
-- level security would otherwise shut out).
-- It only ADDS a table (IF NOT EXISTS), so it's safe to run while the
-- current site is live, and safe to run twice. Run it BEFORE the new code
-- goes live (before merging the pull request).

CREATE TABLE IF NOT EXISTS "AppAttestKey" (
  "id"          TEXT         NOT NULL,
  "keyId"       TEXT         NOT NULL,
  "publicKey"   TEXT         NOT NULL,
  "signCount"   INTEGER      NOT NULL DEFAULT 0,
  "environment" TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"  TIMESTAMP(3),
  "revokedAt"   TIMESTAMP(3),
  CONSTRAINT "AppAttestKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppAttestKey_keyId_key" ON "AppAttestKey"("keyId");
ALTER TABLE "AppAttestKey" ENABLE ROW LEVEL SECURITY;
