import { prisma } from "@/lib/prisma";
import { createFlag, emailAdminsAboutFlag } from "@/lib/flags";
import { mentorMetrics, perfIssues } from "@/lib/health";
import { cleanupRateLimits } from "@/lib/rateLimit";
import { SITE_URL, sendSafetyDigestEmail, type DigestSummary } from "@/lib/email";

// The daily safety run (/api/cron/safety): performance flags, off-site
// patterns, the essay-with-no-draft check, missed alerts and (Mondays)
// the weekly digest. Every flag here uses a dedupe key, so running it
// again the same day or week doesn't raise duplicates.

const DAY = 86400_000;
const ESSAY_SERVICES = ["PERSONAL_STATEMENT", "SECONDARIES", "ACTIVITIES", "REAPPLICANT"];
export const QUIET_AFTER_CONTACT_DAYS = 3;

// #91 Performance flags (and #93 low conversion) for every visible mentor.
export async function runPerformanceChecks(now = new Date()) {
  const mentors = await prisma.user.findMany({
    where: { role: "SELLER", profileStatus: { not: "REMOVED" }, removedByAdmin: false },
    select: { id: true, name: true, profileStatus: true },
    take: 1000,
  });
  let flagged = 0;
  for (let i = 0; i < mentors.length; i += 5) {
    await Promise.all(
      mentors.slice(i, i + 5).map(async (m) => {
        try {
          const metrics = await mentorMetrics(m.id, now);
          for (const issue of perfIssues(metrics)) {
            // "No login" only matters while students can find them.
            if (issue.key === "INACTIVE" && m.profileStatus !== "ACTIVE") continue;
            const created = await createFlag({
              kind: issue.key === "LOW_CONVERSION" ? "OFF_SITE" : "PERFORMANCE",
              source: "CRON",
              severity: issue.severity,
              reason: issue.reason,
              details: issue.details,
              subjectUserId: m.id,
              conversationId: issue.key === "UNANSWERED" ? metrics.unanswered[0]?.conversationId : null,
              dedupeKey: `perf:${issue.key}:${m.id}`,
              dedupeDays: 30,
            });
            if (created) flagged++;
          }
        } catch (err) {
          console.error(`Performance check failed for mentor ${m.id}:`, err);
        }
      })
    );
  }
  return { mentors: mentors.length, flagged };
}

// #93 "Went quiet after exchanging contact info": contact details were
// flagged in a conversation 3-30 days ago, and since then there's been at
// most one more message and no order on MentorsMD.
export async function runQuietAfterContactCheck(now = new Date()) {
  const flags = await prisma.flag.findMany({
    where: {
      kind: "OFF_SITE",
      source: { in: ["AUTO", "AI"] },
      conversationId: { not: null },
      createdAt: { gte: new Date(now.getTime() - 30 * DAY), lte: new Date(now.getTime() - QUIET_AFTER_CONTACT_DAYS * DAY) },
    },
    orderBy: { createdAt: "asc" },
    select: { conversationId: true, createdAt: true, evidence: true },
    take: 500,
  });
  const firstPerConvo = new Map<string, { createdAt: Date; evidence: string | null }>();
  for (const f of flags) if (!firstPerConvo.has(f.conversationId!)) firstPerConvo.set(f.conversationId!, f);

  let flagged = 0;
  for (const [conversationId, f] of Array.from(firstPerConvo.entries())) {
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { buyerId: true, sellerId: true } });
    if (!convo) continue;
    const [after, orders] = await Promise.all([
      prisma.message.count({ where: { conversationId, createdAt: { gt: f.createdAt } } }),
      prisma.order.count({ where: { buyerId: convo.buyerId, sellerId: convo.sellerId, status: { not: "PENDING_PAYMENT" }, createdAt: { gt: f.createdAt } } }),
    ]);
    if (after > 1 || orders > 0) continue;
    const created = await createFlag({
      kind: "OFF_SITE",
      source: "CRON",
      severity: 2,
      reason: "Went quiet right after contact details were shared",
      details: `Contact details or another app came up in this conversation on ${f.createdAt.toDateString()}. Since then there's been ${after === 0 ? "no message" : "only one message"} and no order on MentorsMD, which can mean the deal moved off the site.`,
      evidence: f.evidence,
      subjectUserId: convo.sellerId,
      conversationId,
      dedupeKey: `quiet:${conversationId}`,
      dedupeDays: 365,
    });
    if (created) flagged++;
  }
  return { checked: firstPerConvo.size, flagged };
}

// #92 "Essay with no draft": an essay-type order was delivered with files,
// but the student never shared a file of their own in the conversation.
// A hint, not proof (drafts can arrive other ways), so low severity.
export async function runEssayWithoutDraftCheck(now = new Date()) {
  const orders = await prisma.order.findMany({
    where: {
      gig: { service: { in: ESSAY_SERVICES } },
      deliveries: { some: { createdAt: { gte: new Date(now.getTime() - 14 * DAY) } } },
      status: { in: ["COMPLETED", "RELEASED", "IN_ESCROW"] },
    },
    select: {
      id: true, buyerId: true, sellerId: true, conversationId: true, createdAt: true,
      gig: { select: { title: true } },
      deliveries: { select: { files: true } },
    },
    take: 300,
  });
  let flagged = 0;
  for (const o of orders) {
    const deliveredFiles = o.deliveries.some((d) => Array.isArray(d.files) && (d.files as unknown[]).length > 0);
    if (!deliveredFiles) continue;
    const convo = o.conversationId
      ? { id: o.conversationId }
      : await prisma.conversation.findUnique({ where: { buyerId_sellerId: { buyerId: o.buyerId, sellerId: o.sellerId } }, select: { id: true } });
    const studentFiles = convo
      ? await prisma.message.count({ where: { conversationId: convo.id, senderId: o.buyerId, attachmentUrl: { not: null } } })
      : 0;
    if (studentFiles > 0) continue;
    const created = await createFlag({
      kind: "GHOSTWRITING",
      source: "CRON",
      severity: 1,
      reason: "Essay delivered, but the student never shared a draft",
      details: `"${o.gig.title}": the mentor delivered files, but the student didn't upload any draft in the conversation. Worth a look to make sure the mentor gave feedback rather than writing the essay.`,
      subjectUserId: o.sellerId,
      orderId: o.id,
      conversationId: convo?.id ?? null,
      dedupeKey: `nodraft:${o.id}`,
      dedupeDays: 365,
    });
    if (created) flagged++;
  }
  return { checked: orders.length, flagged };
}

// High-severity flags whose instant email didn't go out (e.g. email was down).
export async function resendMissedAlerts() {
  const missed = await prisma.flag.findMany({
    where: { status: "OPEN", severity: { gte: 3 }, emailedAt: null },
    select: { id: true },
    take: 50,
  });
  for (const f of missed) await emailAdminsAboutFlag(f.id);
  return missed.length;
}

// #88 Weekly digest, sent on Mondays (UTC) by the daily run.
export async function sendWeeklyDigest(now = new Date(), force = false) {
  if (!force && now.getUTCDay() !== 1) return { sent: false, reason: "not Monday" };
  const week = new Date(now.getTime() - 7 * DAY);
  const [open, newThisWeek, high, byKind, top, autoPaused, admins] = await Promise.all([
    prisma.flag.count({ where: { status: "OPEN" } }),
    prisma.flag.count({ where: { createdAt: { gte: week } } }),
    prisma.flag.count({ where: { status: "OPEN", severity: { gte: 3 } } }),
    prisma.flag.groupBy({ by: ["kind"], where: { createdAt: { gte: week } }, _count: { _all: true } }),
    prisma.flag.findMany({
      where: { status: "OPEN" },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: { reason: true, severity: true, subject: { select: { name: true } } },
    }),
    prisma.adminAction.findMany({ where: { action: "USER_AUTO_PAUSE", createdAt: { gte: week } }, select: { targetUser: { select: { name: true } } } }),
    prisma.user.findMany({ where: { role: "ADMIN", removedByAdmin: false }, select: { email: true } }),
  ]);
  const summary: DigestSummary = {
    open,
    newThisWeek,
    high,
    byKind: byKind.map((k) => ({ kind: k.kind, count: k._count._all })).sort((a, b) => b.count - a.count),
    autoPaused: autoPaused.map((a) => ({ name: a.targetUser?.name || "Someone" })),
    top: top.map((t) => ({ reason: t.reason, severity: t.severity, subjectName: t.subject?.name ?? null })),
  };
  let sent = 0;
  for (const a of admins) {
    try {
      await sendSafetyDigestEmail(a.email, summary, `${SITE_URL}/admin#flags`);
      sent++;
    } catch (err) {
      console.error("Couldn't send the safety digest:", err);
    }
  }
  return { sent: sent > 0, admins: sent, summary };
}

export async function runDailySafety(now = new Date()) {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (err: any) {
      console.error(`Safety step "${name}" failed:`, err);
      out[name] = { error: err?.message || String(err) };
    }
  };
  await step("rateLimitRowsDeleted", () => cleanupRateLimits());
  await step("performance", () => runPerformanceChecks(now));
  await step("quietAfterContact", () => runQuietAfterContactCheck(now));
  await step("essayWithoutDraft", () => runEssayWithoutDraftCheck(now));
  await step("missedAlerts", () => resendMissedAlerts());
  await step("digest", () => sendWeeklyDigest(now));
  return out;
}
