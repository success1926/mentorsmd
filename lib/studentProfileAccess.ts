// Who can see a student's profile (lib/studentProfile.ts): admins, and a
// mentor the student has a conversation, a call booking or an order with,
// unless the student blocked them. Never public. Server only.
import { prisma } from "@/lib/prisma";

export async function canSeeStudentProfile(viewer: { id: string; role: string }, studentId: string): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;
  if (viewer.role !== "SELLER" || viewer.id === studentId) return false;
  const [conversation, order, call, blocked] = await Promise.all([
    prisma.conversation.count({ where: { buyerId: studentId, sellerId: viewer.id } }),
    prisma.order.count({ where: { buyerId: studentId, sellerId: viewer.id } }),
    prisma.callBooking.count({ where: { studentId, mentorId: viewer.id } }),
    prisma.block.count({ where: { blockerId: studentId, blockedId: viewer.id } }),
  ]);
  return !blocked && conversation + order + call > 0;
}
