-- MentorsMD Phase 1 (Oct 2026): database changes.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once. Everything here only ADDS things (with IF NOT EXISTS), so it's
-- safe to run while the current site is live, and safe to run twice.
-- Run it BEFORE the new code goes live.

-- "Other" service: the mentor's own short service name.
ALTER TABLE "Gig" ADD COLUMN IF NOT EXISTS "serviceOther" TEXT;

-- Unread message counts per conversation, one for each side.
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "buyerUnread" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "sellerUnread" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Conversation_buyerId_buyerUnread_idx" ON "Conversation"("buyerId", "buyerUnread");
CREATE INDEX IF NOT EXISTS "Conversation_sellerId_sellerUnread_idx" ON "Conversation"("sellerId", "sellerUnread");
