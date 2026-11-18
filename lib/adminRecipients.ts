import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, can, type AdminPermission } from "@/lib/adminPermissions";

// Emails of active admins whose role can open this part of Admin: Owners,
// Admins, and custom roles with it ticked (Team & roles). Used for alert
// emails, so a "Leads only" member doesn't get dispute or safety emails.
export async function adminEmailsWith(perm: AdminPermission): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", removedByAdmin: false, adminDisabledAt: null },
    select: { email: true, adminRole: true, adminCustomRole: { select: { permissions: true } } },
  });
  return admins
    .filter((a) => {
      const custom = a.adminRole === "OWNER" ? null : a.adminCustomRole;
      return can({ perms: custom ? custom.permissions : [ALL_PERMISSIONS] }, perm);
    })
    .map((a) => a.email);
}
