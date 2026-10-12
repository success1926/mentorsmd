-- MentorsMD Phase 5: make your existing admin account the team Owner (#119).
--
-- Run this ONCE, after prisma/phase5-2026-10.sql, in the Neon SQL Editor.
--  1. Replace OWNER_EMAIL_HERE below (both places) with the email you log in with.
--     Keep the single quotes around it. Don't save your real email in this
--     file in the repository - just edit it in the SQL Editor.
--  2. Run it. The check at the end should show one row with admin_role = OWNER.
--
-- Owners manage the admin team (Admin -> Team). Your next login asks you to
-- set up 2-step verification (an authenticator app or email codes).
-- Safe to run twice.

UPDATE "User"
SET "role" = 'ADMIN',
    "adminRole" = 'OWNER',
    "adminDisabledAt" = NULL
WHERE lower("email") = lower('OWNER_EMAIL_HERE');

-- Check: should show exactly one row, with role ADMIN and admin_role OWNER.
SELECT "email", "role", "adminRole" AS admin_role
FROM "User"
WHERE lower("email") = lower('OWNER_EMAIL_HERE');
