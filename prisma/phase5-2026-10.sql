-- MentorsMD Phase 5 (Oct 2026): legal documents and acceptance records,
-- date of birth and parental consent for students aged 13-17, and the
-- admin team (Owner/Admin roles, invites, required 2-step verification).
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.
--
-- Then run prisma/phase5-make-owner-2026-10.sql (after putting your own
-- email in it) so your account becomes the team Owner.

-- Accounts: date of birth and minor status, mentors' "work with students
-- under 18" setting, admin team role, disabling, session revocation and
-- 2-step verification.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "minorStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "becameAdultAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "acceptsMinors" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRole" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminDisabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorMethod" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLastStep" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabledAt" TIMESTAMP(3);

-- Admin -> Legal: every version of each legal document.
CREATE TABLE IF NOT EXISTS "LegalDocument" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "version" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "changeType" TEXT NOT NULL DEFAULT 'MAJOR',
  "changeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "publishedById" TEXT,
  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocument_kind_version_key" ON "LegalDocument"("kind", "version");
CREATE INDEX IF NOT EXISTS "LegalDocument_kind_status_publishedAt_idx" ON "LegalDocument"("kind", "status", "publishedAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalDocument_createdById_fkey') THEN
    ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Acceptance records: who accepted which version, when, IP and browser.
CREATE TABLE IF NOT EXISTS "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "context" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "signerName" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "userId" TEXT,
  "documentId" TEXT,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LegalAcceptance_userId_kind_version_idx" ON "LegalAcceptance"("userId", "kind", "version");
CREATE INDEX IF NOT EXISTS "LegalAcceptance_kind_version_createdAt_idx" ON "LegalAcceptance"("kind", "version", "createdAt");
CREATE INDEX IF NOT EXISTS "LegalAcceptance_createdAt_idx" ON "LegalAcceptance"("createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalAcceptance_userId_fkey') THEN
    ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalAcceptance_documentId_fkey') THEN
    ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Parent or guardian consent for students aged 13-17.
CREATE TABLE IF NOT EXISTS "ParentConsent" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "parentName" TEXT NOT NULL,
  "parentEmail" TEXT NOT NULL,
  "parentPhone" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3),
  "remindersSent" INTEGER NOT NULL DEFAULT 0,
  "consentedAt" TIMESTAMP(3),
  "signatureName" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "termsVersion" INTEGER,
  "consentFormVersion" INTEGER,
  "viewToken" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  CONSTRAINT "ParentConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParentConsent_tokenHash_key" ON "ParentConsent"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ParentConsent_viewToken_key" ON "ParentConsent"("viewToken");
CREATE INDEX IF NOT EXISTS "ParentConsent_userId_createdAt_idx" ON "ParentConsent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentConsent_status_expiresAt_idx" ON "ParentConsent"("status", "expiresAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParentConsent_userId_fkey') THEN
    ALTER TABLE "ParentConsent" ADD CONSTRAINT "ParentConsent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Admin -> Team invites (only a hash of each link is stored).
CREATE TABLE IF NOT EXISTS "AdminInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "adminRole" TEXT NOT NULL DEFAULT 'ADMIN',
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "acceptedUserId" TEXT,
  "invitedById" TEXT,
  CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminInvite_createdAt_idx" ON "AdminInvite"("createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminInvite_invitedById_fkey') THEN
    ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Admin 2-step verification: emailed codes and one-time login tickets.
CREATE TABLE IF NOT EXISTS "AdminMfaToken" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT NOT NULL,
  CONSTRAINT "AdminMfaToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminMfaToken_userId_kind_createdAt_idx" ON "AdminMfaToken"("userId", "kind", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminMfaToken_userId_fkey') THEN
    ALTER TABLE "AdminMfaToken" ADD CONSTRAINT "AdminMfaToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Check: every line should say "true".
SELECT 'User.dateOfBirth column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'dateOfBirth') AS ok
UNION ALL
SELECT 'User.minorStatus column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'minorStatus')
UNION ALL
SELECT 'User.acceptsMinors column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'acceptsMinors')
UNION ALL
SELECT 'User.adminRole column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'adminRole')
UNION ALL
SELECT 'User.twoFactorMethod column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'twoFactorMethod')
UNION ALL
SELECT 'User.sessionsRevokedAt column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'sessionsRevokedAt')
UNION ALL
SELECT 'LegalDocument table', to_regclass('"LegalDocument"') IS NOT NULL
UNION ALL
SELECT 'LegalAcceptance table', to_regclass('"LegalAcceptance"') IS NOT NULL
UNION ALL
SELECT 'ParentConsent table', to_regclass('"ParentConsent"') IS NOT NULL
UNION ALL
SELECT 'AdminInvite table', to_regclass('"AdminInvite"') IS NOT NULL
UNION ALL
SELECT 'AdminMfaToken table', to_regclass('"AdminMfaToken"') IS NOT NULL;
