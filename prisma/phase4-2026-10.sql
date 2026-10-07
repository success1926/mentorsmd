-- MentorsMD Phase 4 (Oct 2026): safety and integrity. Email confirmation
-- links, rate limits, the Flags queue, blocks, the admin action log,
-- account safety holds and the mentor agreement.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.

-- Accounts: last time they used the site, safety hold (paused pending
-- review) and when a mentor accepted the mentor agreement.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "safetyHoldAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "safetyHoldReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorAgreementVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorAgreementAt" TIMESTAMP(3);

-- Packages: which version of the mentor agreement was accepted when it was saved.
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT;
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "agreementAt" TIMESTAMP(3);

-- "Confirm your email" links (only a hash of each link is stored).
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_createdAt_idx" ON "EmailVerificationToken"("userId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey') THEN
    ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Rate-limit counters (used only when Upstash isn't set up). Old rows are
-- cleaned up by the daily safety run.
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- Admin -> Flags: reports, disputes and automatic flags in one queue.
CREATE TABLE IF NOT EXISTS "Flag" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'AUTO',
  "severity" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "evidence" TEXT,
  "matches" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "dedupeKey" TEXT,
  "subjectUserId" TEXT,
  "reporterId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "orderId" TEXT,
  "gigId" TEXT,
  "action" TEXT,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "emailedAt" TIMESTAMP(3),
  CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Flag_status_severity_createdAt_idx" ON "Flag"("status", "severity", "createdAt");
CREATE INDEX IF NOT EXISTS "Flag_subjectUserId_createdAt_idx" ON "Flag"("subjectUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "Flag_dedupeKey_createdAt_idx" ON "Flag"("dedupeKey", "createdAt");
CREATE INDEX IF NOT EXISTS "Flag_orderId_idx" ON "Flag"("orderId");
CREATE INDEX IF NOT EXISTS "Flag_conversationId_createdAt_idx" ON "Flag"("conversationId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Flag_subjectUserId_fkey') THEN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_subjectUserId_fkey"
      FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Flag_reporterId_fkey') THEN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_reporterId_fkey"
      FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Flag_resolvedById_fkey') THEN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Blocks between two people (neither can message the other).
CREATE TABLE IF NOT EXISTS "Block" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Block_blockerId_fkey') THEN
    ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey"
      FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Block_blockedId_fkey') THEN
    ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey"
      FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Admin action log: who did what, and when.
CREATE TABLE IF NOT EXISTS "AdminAction" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "adminId" TEXT,
  "targetUserId" TEXT,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAction_targetUserId_createdAt_idx" ON "AdminAction"("targetUserId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAction_adminId_fkey') THEN
    ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAction_targetUserId_fkey') THEN
    ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Disputes that are already open show up in the new Flags queue too.
INSERT INTO "Flag" ("id", "kind", "source", "severity", "status", "reason", "details",
                    "subjectUserId", "reporterId", "orderId", "conversationId", "createdAt")
SELECT 'dsp_' || o."id", 'DISPUTE', 'USER', 2, 'OPEN',
       LEFT('Dispute: ' || g."title", 200), o."disputeReason",
       o."sellerId", o."buyerId", o."id", o."conversationId", CURRENT_TIMESTAMP
FROM "Order" o
JOIN "Gig" g ON g."id" = o."gigId"
WHERE o."disputed" = true
  AND o."status" IN ('IN_ESCROW', 'COMPLETED')
  AND NOT EXISTS (SELECT 1 FROM "Flag" f WHERE f."orderId" = o."id" AND f."kind" = 'DISPUTE');

-- Check: every line should say "true".
SELECT 'User.safetyHoldAt column' AS item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'safetyHoldAt') AS ok
UNION ALL
SELECT 'User.mentorAgreementVersion column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'mentorAgreementVersion')
UNION ALL
SELECT 'Gig.agreementVersion column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Gig' AND column_name = 'agreementVersion')
UNION ALL
SELECT 'EmailVerificationToken table', to_regclass('"EmailVerificationToken"') IS NOT NULL
UNION ALL
SELECT 'RateLimitBucket table', to_regclass('"RateLimitBucket"') IS NOT NULL
UNION ALL
SELECT 'Flag table', to_regclass('"Flag"') IS NOT NULL
UNION ALL
SELECT 'Block table', to_regclass('"Block"') IS NOT NULL
UNION ALL
SELECT 'AdminAction table', to_regclass('"AdminAction"') IS NOT NULL;
