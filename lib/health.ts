import { prisma } from "@/lib/prisma";

// Health scorecard (Admin -> People -> View) and the performance checks
// the daily safety cron turns into flags. All thresholds are here.
export const PERF = {
  slowReplyAvgHours: 24, // average first-reply time over 30 days
  unansweredHours: 48, // a student message with no reply for this long
  overdueCount: 2, // overdue orders in 60 days
  overdueGraceHours: 24, // delivered within a day of the due date isn't "late"
  noShowCount: 1, // mentor didn't join a call the student joined (60 days)
  lateCancelHours: 48, // a call the mentor cancelled less than this before it started
  lateCancelCount: 3, // late cancels in 60 days
  problemRate: 0.25, // revisions + disputes + refunds, share of orders in 90 days
  problemRateMinOrders: 4,
  minRating: 3.5,
  minRatingReviews: 3,
  inactiveDays: 14,
  lowConversionMinConversations: 15,
  lowConversionRate: 0.05,
};

const DAY = 86400_000;

export type MentorMetrics = {
  avgReplyHours: number | null;
  repliesMeasured: number;
  unanswered: { conversationId: string; since: string }[];
  overdue60: number;
  noShows60: number;
  lateCancels60: number;
  orders90: number;
  problemOrders90: number;
  problemRate: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  oneStar60: number;
  lastActiveAt: string | null;
  daysSinceActive: number | null;
  conversations60: number;
  convertedConversations60: number;
};

export async function mentorMetrics(sellerId: string, now = new Date()): Promise<MentorMetrics> {
  const t = now.getTime();
  const d30 = new Date(t - 30 * DAY);
  const d60 = new Date(t - 60 * DAY);
  const d90 = new Date(t - 90 * DAY);

  const [messages, dueOrders, bookings, cancels, recentOrders, rating, oneStar, user, convos] = await Promise.all([
    prisma.message.findMany({
      where: { conversation: { sellerId }, createdAt: { gte: d30 } },
      select: { conversationId: true, senderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.order.findMany({
      where: { sellerId, dueDate: { gte: d60, lte: now }, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] } },
      select: { status: true, dueDate: true, workCompletedAt: true, callHoldAt: true, deliveries: { orderBy: { number: "asc" }, take: 1, select: { createdAt: true } } },
    }),
    prisma.callBooking.findMany({
      where: { order: { sellerId }, startTime: { gte: d60 }, endTime: { lt: now }, status: { not: "CANCELLED" }, roomName: { not: null } },
      select: { order: { select: { buyerId: true } }, attendance: { select: { userId: true } } },
    }),
    prisma.callBooking.findMany({
      where: { order: { sellerId }, cancelledById: sellerId, cancelledAt: { gte: d60 } },
      select: { startTime: true, cancelledAt: true },
    }),
    prisma.order.findMany({
      where: { sellerId, createdAt: { gte: d90 }, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] } },
      select: { status: true, disputed: true, revisionRequested: true, _count: { select: { deliveries: true } } },
    }),
    prisma.review.aggregate({ where: { sellerId }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.count({ where: { sellerId, rating: 1, createdAt: { gte: d60 } } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { lastActiveAt: true } }),
    prisma.conversation.findMany({
      where: { sellerId, createdAt: { gte: d60 }, messages: { some: {} } },
      select: { buyerId: true, createdAt: true },
      take: 1000,
    }),
  ]);

  // Reply times: from the first unanswered student message to the
  // mentor's next message, per conversation.
  const waits: number[] = [];
  const pending = new Map<string, Date>();
  for (const m of messages) {
    if (m.senderId === sellerId) {
      const since = pending.get(m.conversationId);
      if (since) waits.push(m.createdAt.getTime() - since.getTime());
      pending.delete(m.conversationId);
    } else if (!pending.has(m.conversationId)) {
      pending.set(m.conversationId, m.createdAt);
    }
  }
  const unanswered = Array.from(pending.entries())
    .filter(([, since]) => t - since.getTime() > PERF.unansweredHours * 3600_000)
    .map(([conversationId, since]) => ({ conversationId, since: since.toISOString() }));

  const grace = PERF.overdueGraceHours * 3600_000;
  const overdue60 = dueOrders.filter((o) => {
    const due = o.dueDate!.getTime() + grace;
    const delivered = o.deliveries[0]?.createdAt ?? (o.status !== "IN_ESCROW" ? o.workCompletedAt : null);
    if (delivered) return delivered.getTime() > due;
    return o.status === "IN_ESCROW" && !o.callHoldAt && t > due;
  }).length;

  const noShows60 = bookings.filter((b) => {
    const ids = b.attendance.map((a) => a.userId);
    return ids.includes(b.order.buyerId) && !ids.includes(sellerId);
  }).length;

  const lateCancels60 = cancels.filter((c) => c.cancelledAt && c.startTime.getTime() - c.cancelledAt.getTime() < PERF.lateCancelHours * 3600_000).length;

  const problemOrders90 = recentOrders.filter((o) => o.disputed || o.revisionRequested || o._count.deliveries > 1 || o.status === "REFUNDED").length;

  // Conversations that led to an order.
  const buyerIds = Array.from(new Set(convos.map((c) => c.buyerId)));
  const buyersWhoOrdered = buyerIds.length
    ? await prisma.order.findMany({
        where: { sellerId, buyerId: { in: buyerIds }, status: { not: "PENDING_PAYMENT" } },
        select: { buyerId: true },
        distinct: ["buyerId"],
      })
    : [];

  const last = user?.lastActiveAt ?? null;
  return {
    avgReplyHours: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length / 3600_000 : null,
    repliesMeasured: waits.length,
    unanswered,
    overdue60,
    noShows60,
    lateCancels60,
    orders90: recentOrders.length,
    problemOrders90,
    problemRate: recentOrders.length ? problemOrders90 / recentOrders.length : null,
    ratingAvg: rating._avg.rating,
    ratingCount: rating._count._all,
    oneStar60: oneStar,
    lastActiveAt: last ? last.toISOString() : null,
    daysSinceActive: last ? Math.floor((t - last.getTime()) / DAY) : null,
    conversations60: convos.length,
    convertedConversations60: buyersWhoOrdered.length,
  };
}

// Plain-language problems, used for both the scorecard and the cron flags.
export type PerfIssue = { key: string; severity: 1 | 2 | 3; reason: string; details: string };

export function perfIssues(m: MentorMetrics): PerfIssue[] {
  const out: PerfIssue[] = [];
  if (m.avgReplyHours !== null && m.repliesMeasured >= 3 && m.avgReplyHours > PERF.slowReplyAvgHours) {
    out.push({ key: "SLOW_REPLY", severity: 1, reason: "Slow replies", details: `Average reply time over the last 30 days is ${Math.round(m.avgReplyHours)} hours (goal: under ${PERF.slowReplyAvgHours}).` });
  }
  if (m.unanswered.length) {
    out.push({ key: "UNANSWERED", severity: 1, reason: "Student message unanswered for 48+ hours", details: `${m.unanswered.length} conversation${m.unanswered.length === 1 ? " has" : "s have"} a student message with no reply for over ${PERF.unansweredHours} hours.` });
  }
  if (m.overdue60 >= PERF.overdueCount) {
    out.push({ key: "OVERDUE", severity: 2, reason: "Repeatedly late orders", details: `${m.overdue60} orders were delivered late or are overdue in the last 60 days.` });
  }
  if (m.noShows60 >= PERF.noShowCount) {
    out.push({ key: "NO_SHOW", severity: 2, reason: "Missed a call", details: `${m.noShows60} call${m.noShows60 === 1 ? "" : "s"} in the last 60 days where the student joined but the mentor didn't.` });
  }
  if (m.lateCancels60 >= PERF.lateCancelCount) {
    out.push({ key: "LATE_CANCEL", severity: 2, reason: "Repeated late call cancellations", details: `${m.lateCancels60} calls cancelled less than ${PERF.lateCancelHours} hours before the start in the last 60 days.` });
  }
  if (m.problemRate !== null && m.orders90 >= PERF.problemRateMinOrders && m.problemRate > PERF.problemRate) {
    out.push({ key: "PROBLEM_RATE", severity: 2, reason: "High revision / dispute / refund rate", details: `${m.problemOrders90} of ${m.orders90} orders in the last 90 days (${Math.round(m.problemRate * 100)}%) needed a revision, were disputed or were refunded.` });
  }
  if (m.ratingAvg !== null && m.ratingCount >= PERF.minRatingReviews && m.ratingAvg < PERF.minRating) {
    out.push({ key: "LOW_RATING", severity: 2, reason: "Low rating", details: `Average rating ${m.ratingAvg.toFixed(1)} from ${m.ratingCount} reviews (below ${PERF.minRating}).` });
  }
  if (m.oneStar60 > 0) {
    out.push({ key: "ONE_STAR", severity: 1, reason: "1-star review", details: `${m.oneStar60} one-star review${m.oneStar60 === 1 ? "" : "s"} in the last 60 days.` });
  }
  if (m.daysSinceActive !== null && m.daysSinceActive >= PERF.inactiveDays) {
    out.push({ key: "INACTIVE", severity: 1, reason: "No login for 14+ days", details: `Last active ${m.daysSinceActive} days ago, while visible to students.` });
  }
  if (m.conversations60 >= PERF.lowConversionMinConversations && m.convertedConversations60 / m.conversations60 < PERF.lowConversionRate) {
    out.push({ key: "LOW_CONVERSION", severity: 1, reason: "Many conversations, almost no orders", details: `${m.conversations60} new conversations in 60 days but only ${m.convertedConversations60} led to an order on MentorsMD. Worth checking for deals being moved off the site.` });
  }
  return out;
}

export type Health = {
  label: "Good" | "Watch" | "At risk";
  openFlags: number;
  upheld90: number;
  highOpen: number;
  onHold: boolean;
  issues: PerfIssue[];
  metrics: MentorMetrics | null;
};

export function healthLabel(h: { openFlags: number; upheld90: number; highOpen: number; onHold: boolean; issueCount: number }): Health["label"] {
  if (h.onHold || h.highOpen > 0 || h.upheld90 >= 2 || h.issueCount >= 3) return "At risk";
  if (h.openFlags > 0 || h.upheld90 > 0 || h.issueCount > 0) return "Watch";
  return "Good";
}

// Full scorecard for one person (Admin -> People -> View).
export async function healthFor(userId: string, role: string): Promise<Health> {
  const since90 = new Date(Date.now() - 90 * DAY);
  const [openFlags, highOpen, upheld90, user, metrics] = await Promise.all([
    prisma.flag.count({ where: { subjectUserId: userId, status: "OPEN" } }),
    prisma.flag.count({ where: { subjectUserId: userId, status: "OPEN", severity: { gte: 3 } } }),
    prisma.flag.count({ where: { subjectUserId: userId, status: "UPHELD", resolvedAt: { gte: since90 } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { safetyHoldAt: true } }),
    role === "SELLER" ? mentorMetrics(userId) : Promise.resolve(null),
  ]);
  const issues = metrics ? perfIssues(metrics) : [];
  const onHold = !!user?.safetyHoldAt;
  return { label: healthLabel({ openFlags, upheld90, highOpen, onHold, issueCount: issues.length }), openFlags, upheld90, highOpen, onHold, issues, metrics };
}

// Light version for the People list badges (no per-person metrics).
export async function healthBadges(userIds: string[]) {
  if (!userIds.length) return new Map<string, { openFlags: number; highOpen: number; upheld90: number }>();
  const since90 = new Date(Date.now() - 90 * DAY);
  const [open, high, upheld] = await Promise.all([
    prisma.flag.groupBy({ by: ["subjectUserId"], where: { subjectUserId: { in: userIds }, status: "OPEN" }, _count: { _all: true } }),
    prisma.flag.groupBy({ by: ["subjectUserId"], where: { subjectUserId: { in: userIds }, status: "OPEN", severity: { gte: 3 } }, _count: { _all: true } }),
    prisma.flag.groupBy({ by: ["subjectUserId"], where: { subjectUserId: { in: userIds }, status: "UPHELD", resolvedAt: { gte: since90 } }, _count: { _all: true } }),
  ]);
  const map = new Map<string, { openFlags: number; highOpen: number; upheld90: number }>();
  for (const id of userIds) map.set(id, { openFlags: 0, highOpen: 0, upheld90: 0 });
  for (const r of open) if (r.subjectUserId) map.get(r.subjectUserId)!.openFlags = r._count._all;
  for (const r of high) if (r.subjectUserId) map.get(r.subjectUserId)!.highOpen = r._count._all;
  for (const r of upheld) if (r.subjectUserId) map.get(r.subjectUserId)!.upheld90 = r._count._all;
  return map;
}
