-- MentorsMD admin custom roles (Oct 2026): Admin -> Team -> Roles, where
-- the Owner makes roles with tick boxes for each admin area, and picks a
-- role when inviting or editing a team member.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). Everything here only ADDS things
-- (with IF NOT EXISTS), so it's safe to run while the current site is
-- live, and safe to run twice. Run it BEFORE the new code goes live.
--
-- Nothing changes for current admins: an admin with no custom role keeps
-- full access, exactly as today.

-- The roles: a name and the admin areas it can open (keys from
-- lib/adminPermissions.ts, e.g. 'people', 'disputes', 'orders').
CREATE TABLE IF NOT EXISTS "AdminCustomRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminCustomRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminCustomRole_name_key" ON "AdminCustomRole"("name");

-- Team members and team invites can point at a role (empty = full access).
-- A role in use can't be deleted (ON DELETE RESTRICT).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRoleId" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "adminRoleId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_adminRoleId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_adminRoleId_fkey"
      FOREIGN KEY ("adminRoleId") REFERENCES "AdminCustomRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminInvite_adminRoleId_fkey') THEN
    ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_adminRoleId_fkey"
      FOREIGN KEY ("adminRoleId") REFERENCES "AdminCustomRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Check: every row should say true.
SELECT 'AdminCustomRole table' AS item, to_regclass('"AdminCustomRole"') IS NOT NULL AS ok
UNION ALL
SELECT 'User.adminRoleId column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'adminRoleId')
UNION ALL
SELECT 'AdminInvite.adminRoleId column',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AdminInvite' AND column_name = 'adminRoleId')
UNION ALL
SELECT 'User_adminRoleId_fkey', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_adminRoleId_fkey')
UNION ALL
SELECT 'AdminInvite_adminRoleId_fkey', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminInvite_adminRoleId_fkey');
