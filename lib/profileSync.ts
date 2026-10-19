// Keeps User.profileCompleteAt in step with the "Finish your profile"
// checklist (lib/profileCompleteness.ts). Call it after anything that can
// change one of the 10 sections: the profile editor, the photo, the hourly
// rate, an admin edit. Server only.
import { prisma } from "@/lib/prisma";
import { isProfileComplete, profileFieldsSelect } from "@/lib/profileCompleteness";

export async function syncProfileComplete(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ...profileFieldsSelect, role: true, profileCompleteAt: true } });
  if (!u || u.role !== "SELLER") return false;
  const complete = isProfileComplete(u);
  if (complete && !u.profileCompleteAt) {
    await prisma.user.update({ where: { id: userId }, data: { profileCompleteAt: new Date() } });
  } else if (!complete && u.profileCompleteAt) {
    await prisma.user.update({ where: { id: userId }, data: { profileCompleteAt: null } });
  }
  return complete;
}
