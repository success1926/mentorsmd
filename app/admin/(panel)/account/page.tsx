import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { AccountSecurity } from "./AccountSecurity";

export const metadata = { title: "Account & Security" };
export const dynamic = "force-dynamic";

// Admin -> Account & Security: the logged-in admin's own account (any
// admin can open it; no area permission). Password, 2-step verification,
// and signing out of other devices (/api/admin/account).
export default async function AdminAccountPage() {
  const admin = await currentAdmin();
  if (!admin) return null; // the layout already shows "Admin access required"
  const u = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true, twoFactorMethod: true, twoFactorEnabledAt: true, createdAt: true },
  });
  return (
    <AccountSecurity
      name={admin.name}
      email={admin.email}
      roleName={admin.roleName}
      hasPassword={!!u?.passwordHash}
      twoStep={u?.twoFactorMethod === "TOTP" ? "TOTP" : u?.twoFactorMethod === "EMAIL" ? "EMAIL" : null}
      joined={u?.createdAt.toISOString() ?? null}
    />
  );
}
