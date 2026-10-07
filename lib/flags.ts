import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import {
  SITE_URL,
  sendAccountPausedEmail,
  sendHighSeverityFlagEmail,
  sendSafetyWarningEmail,
} from "@/lib/email";
import type { FlagKind, Severity } from "@/lib/moderation";
import { involvesMinor } from "@/lib/minorCheck";

// Admin -> Flags: one queue for student/mentor reports, disputes and
// automatic flags. Severity 1 low, 2 medium, 3 high (high = instant email
// to every admin). An admin closes each flag with Dismiss, Warn, Pause or
// Remove; Warn/Pause/Remove count as "upheld". Three upheld flags about
// the same person within 90 days pauses their account automatically,
// pending review.

export const AUTO_PAUSE_UPHELD = 3;
export const AUTO_PAUSE_DAYS = 90;

export type FlagSource = "USER" | "AUTO" | "AI" | "CRON" | "SYSTEM";

export type NewFlag = {
  kind: FlagKind;
  source?: FlagSource;
  severity: Severity;
  reason: string;
  details?: string | null;
  evidence?: string | null;
  matches?: string[];
  subjectUserId?: string | null;
  reporterId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  orderId?: string | null;
  gigId?: string | null;
  // Same key within `dedupeDays` = don't raise it again.
  dedupeKey?: string | null;
  dedupeDays?: number;
};

const FLAGS_URL = `${SITE_URL}/admin#flags`;

export async function createFlag(f: NewFlag) {
  try {
    // Stricter for students under 18 (#111): any off-site contact
    // involving a minor is high severity (instant email to admins).
    if (f.kind === "OFF_SITE" && f.severity < 3 && (await involvesMinor(f))) {
      f = { ...f, severity: 3, reason: `${f.reason} (student under 18)` };
    }
    if (f.dedupeKey) {
      const since = new Date(Date.now() - (f.dedupeDays ?? 30) * 86400_000);
      const dup = await prisma.flag.findFirst({ where: { dedupeKey: f.dedupeKey, createdAt: { gte: since } }, select: { id: true } });
      if (dup) return null;
    }
    const flag = await prisma.flag.create({
      data: {
        kind: f.kind,
        source: f.source ?? "AUTO",
        severity: f.severity,
        reason: f.reason.slice(0, 200),
        details: f.details?.slice(0, 5000) ?? null,
        evidence: f.evidence?.slice(0, 5000) ?? null,
        matches: (f.matches || []).map((m) => m.slice(0, 100)).slice(0, 20),
        subjectUserId: f.subjectUserId ?? null,
        reporterId: f.reporterId ?? null,
        conversationId: f.conversationId ?? null,
        messageId: f.messageId ?? null,
        orderId: f.orderId ?? null,
        gigId: f.gigId ?? null,
        dedupeKey: f.dedupeKey ?? null,
      },
    });
    if (flag.severity >= 3) await emailAdminsAboutFlag(flag.id);
    return flag;
  } catch (err) {
    console.error("Couldn't save a safety flag:", err);
    return null;
  }
}

async function adminEmails() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", removedByAdmin: false, adminDisabledAt: null }, select: { email: true } });
  return admins.map((a) => a.email);
}

// Instant email for a high-severity flag (once per flag).
export async function emailAdminsAboutFlag(flagId: string) {
  const claim = await prisma.flag.updateMany({ where: { id: flagId, emailedAt: null }, data: { emailedAt: new Date() } });
  if (claim.count === 0) return;
  const flag = await prisma.flag.findUnique({ where: { id: flagId }, include: { subject: { select: { name: true } } } });
  if (!flag) return;
  const emails = await adminEmails();
  await Promise.all(
    emails.map((to) =>
      sendHighSeverityFlagEmail(to, { kind: flag.kind, reason: flag.reason, evidence: flag.evidence, details: flag.details, subjectName: flag.subject?.name }, FLAGS_URL).catch((err) =>
        console.error("Couldn't send the high-severity flag email:", err)
      )
    )
  );
}

// Several findings from one message (word filter, off-site, AI...).
export async function createFlagsForFindings(
  findings: { kind: FlagKind; severity: Severity; reason: string; matches: string[] }[],
  base: Omit<NewFlag, "kind" | "severity" | "reason" | "matches">
) {
  for (const f of findings) await createFlag({ ...base, kind: f.kind, severity: f.severity, reason: f.reason, matches: f.matches });
}

// ---------------- Holds ----------------

// Pause an account pending review. Mentors are hidden from search (and
// can't unpause themselves); students can't send messages.
export async function placeSafetyHold(userId: string, reason: string, adminId: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "ADMIN") return false;
  await prisma.user.update({
    where: { id: userId },
    data: {
      safetyHoldAt: user.safetyHoldAt ?? new Date(),
      safetyHoldReason: reason.slice(0, 500),
      ...(user.role === "SELLER" && user.profileStatus !== "REMOVED" ? { profileStatus: "PAUSED", pausedUntil: null } : {}),
    },
  });
  if (!user.safetyHoldAt) {
    await sendAccountPausedEmail(user.email, user.name, user.role === "SELLER").catch((err) => console.error("Couldn't send the paused email:", err));
  }
  return true;
}

export async function liftSafetyHold(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { safetyHoldAt: null, safetyHoldReason: null } });
}

// 3 upheld flags in 90 days -> paused automatically, pending review.
export async function checkAutoPause(userId: string | null | undefined) {
  if (!userId) return false;
  const since = new Date(Date.now() - AUTO_PAUSE_DAYS * 86400_000);
  const upheld = await prisma.flag.count({ where: { subjectUserId: userId, status: "UPHELD", resolvedAt: { gte: since } } });
  if (upheld < AUTO_PAUSE_UPHELD) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, safetyHoldAt: true, role: true, profileStatus: true } });
  if (!user || user.safetyHoldAt || user.role === "ADMIN" || user.profileStatus === "REMOVED") return false;
  const reason = `${upheld} upheld flags in ${AUTO_PAUSE_DAYS} days`;
  await placeSafetyHold(userId, `Paused automatically: ${reason}`, null);
  await logAdminAction({
    adminId: null,
    action: "USER_AUTO_PAUSE",
    summary: `Paused ${user.name} automatically (${reason}), pending review`,
    targetType: "USER",
    targetId: userId,
    targetUserId: userId,
  });
  await createFlag({
    kind: "REPORT",
    source: "SYSTEM",
    severity: 3,
    reason: "Account paused automatically, pending review",
    details: `${user.name} reached ${reason}. Their account is paused until an admin reviews it (Admin -> People -> Unpause).`,
    subjectUserId: userId,
    dedupeKey: `autopause:${userId}`,
    dedupeDays: 7,
  });
  return true;
}

// ---------------- Resolving a flag ----------------

export type FlagAction = "DISMISS" | "WARN" | "PAUSE" | "REMOVE" | "REOPEN";

export async function resolveFlag(flagId: string, adminId: string, action: FlagAction, note: string | null) {
  const flag = await prisma.flag.findUnique({ where: { id: flagId }, include: { subject: true } });
  if (!flag) return { error: "Flag not found", status: 404 };
  const subject = flag.subject;

  if (action === "REOPEN") {
    await prisma.flag.update({ where: { id: flag.id }, data: { status: "OPEN", action: null, resolvedAt: null, resolvedById: null, resolutionNote: null } });
    await logAdminAction({ adminId, action: "FLAG_REOPEN", summary: `Reopened flag "${flag.reason}"`, targetType: "FLAG", targetId: flag.id, targetUserId: flag.subjectUserId });
    return { ok: true };
  }

  if (action !== "DISMISS") {
    if (!subject) return { error: "This flag isn't about a specific person, so it can only be dismissed.", status: 400 };
    if (subject.role === "ADMIN") return { error: "Admin accounts can't be warned, paused or removed here.", status: 400 };
  }
  if (action === "REMOVE" && !note?.trim()) return { error: "Add a reason for the removal - it's kept on record.", status: 400 };

  const status = action === "DISMISS" ? "DISMISSED" : "UPHELD";
  const claim = await prisma.flag.updateMany({
    where: { id: flag.id, status: "OPEN" },
    data: { status, action, resolutionNote: note?.slice(0, 2000) || null, resolvedAt: new Date(), resolvedById: adminId },
  });
  if (claim.count === 0) return { error: "Someone already handled this flag - refresh the page.", status: 409 };

  const who = subject?.name || "someone";
  let summary = `Dismissed flag "${flag.reason}"${subject ? ` about ${who}` : ""}`;

  if (action === "WARN" && subject) {
    await sendSafetyWarningEmail(subject.email, subject.name, flag.reason, note).catch((err) => console.error("Couldn't send the warning email:", err));
    summary = `Warned ${who}: ${flag.reason}`;
  } else if (action === "PAUSE" && subject) {
    await placeSafetyHold(subject.id, note?.trim() || flag.reason, adminId);
    summary = `Paused ${who} pending review: ${flag.reason}`;
  } else if (action === "REMOVE" && subject) {
    await prisma.user.update({
      where: { id: subject.id },
      data: { profileStatus: "REMOVED", removedAt: new Date(), removedReason: note!.trim().slice(0, 1000), removedByAdmin: true },
    });
    summary = `Removed ${who}: ${flag.reason}`;
  }

  await logAdminAction({
    adminId,
    action: `FLAG_${action}`,
    summary,
    targetType: "FLAG",
    targetId: flag.id,
    targetUserId: flag.subjectUserId,
    details: { kind: flag.kind, severity: flag.severity, note: note || undefined },
  });

  if (status === "UPHELD") await checkAutoPause(flag.subjectUserId);
  return { ok: true };
}

// Disputes appear in the Flags queue too. When the admin refunds or
// releases a disputed order, its flag closes with that outcome (a refund
// counts as upheld against the mentor).
export async function closeDisputeFlag(orderId: string, outcome: "REFUND" | "RELEASE", adminId: string | null) {
  try {
    const res = await prisma.flag.updateMany({
      where: { orderId, kind: "DISPUTE", status: "OPEN" },
      data: {
        status: outcome === "REFUND" ? "UPHELD" : "DISMISSED",
        action: outcome,
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
    });
    if (res.count && outcome === "REFUND") {
      const f = await prisma.flag.findFirst({ where: { orderId, kind: "DISPUTE" }, select: { subjectUserId: true } });
      await checkAutoPause(f?.subjectUserId);
    }
  } catch (err) {
    console.error("Couldn't close the dispute flag:", err);
  }
}
