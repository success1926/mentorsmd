import { prisma } from "@/lib/prisma";

// Admin action log (Admin -> Action log): every admin decision is written
// here with who, when and what. adminId null = done automatically (e.g.
// the 3-flags auto-pause). Logging must never break the action itself.
export type AdminActionInput = {
  adminId: string | null;
  action: string; // e.g. FLAG_DISMISS, USER_PAUSE, ORDER_REFUND, INVITE_SENT
  summary: string; // one readable line: "Paused Jane Doe (3 upheld flags)"
  targetType?: "USER" | "ORDER" | "FLAG" | "INVITE" | "APPLICATION";
  targetId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
};

export async function logAdminAction(a: AdminActionInput) {
  try {
    await prisma.adminAction.create({
      data: {
        adminId: a.adminId,
        action: a.action,
        summary: a.summary.slice(0, 500),
        targetType: a.targetType ?? null,
        targetId: a.targetId ?? null,
        targetUserId: a.targetUserId ?? null,
        details: (a.details as any) ?? undefined,
      },
    });
  } catch (err) {
    console.error("Couldn't write to the admin action log:", err);
  }
}
