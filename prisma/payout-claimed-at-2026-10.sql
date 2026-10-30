-- MentorsMD: payout Retry can't send twice (Oct 2026).
-- Run on Supabase in BOTH the public and preview schemas before merging.
-- Only adds a column; safe to run twice.
ALTER TABLE public."MentorPayout" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE preview."MentorPayout" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
