import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { DEFAULT_TIME_ZONE, addDays, dayInZone, fmtDayLabel, isDayString, isValidTimeZone, weekdayOfDay, zonedToUtc } from "@/lib/tz";
import { FILTER_GROUPS, FORMATS, PRICE_BANDS, SCHOOL_TYPES, SERVICES, STAGES, TURNAROUNDS, isValue, labelFor } from "@/lib/options";
import { bookableGigWhere, searchableGigWhere } from "@/lib/mentor";
import { sourceLabel } from "@/lib/attribution";
import { csvCell } from "@/lib/csv";

// Admin -> Insights (#77-#86). Everything is worked out from the
// database on request (orders, accounts, messages, calls, reviews and the
// private activity log), so the numbers always match the rest of the site.
//
// Money rules:
//  - Sales: orders paid in the period (including ones refunded later).
//  - Refunds: orders refunded in the period.
//  - MentorsMD fee and Paid to mentors: orders whose payment was released
//    to the mentor in the period (the 20% fee is only earned on release).
//  - Orders from before Phase 6 have no payment date; their order date is used.
//
// Each tab returns stat cards, charts and tables. Every table (and chart)
// can be downloaded as CSV (#84): see toCsv() and /api/admin/insights.

export type ColKind = "text" | "money" | "count" | "percent" | "rating" | "date" | "hours";
export type Col = { key: string; label: string; kind?: ColKind; link?: string };
export type Row = Record<string, string | number | null>;
export type Table = { key: string; title: string; note?: string; columns: Col[]; rows: Row[]; sort?: { key: string; dir: "asc" | "desc" } };
export type Card = { key: string; label: string; value: number | null; kind: ColKind; hint?: string };
export type Chart = { key: string; title: string; kind: "money" | "count"; points: { label: string; value: number }[] };
export type FunnelStep = { label: string; value: number; unit: string };
export type InsightsResult = {
  cards?: Card[];
  charts?: Chart[];
  funnels?: { key: string; title: string; note?: string; steps: FunnelStep[] }[];
  tables: Table[];
  options?: Record<string, { value: string; label: string }[]>;
};

export const TABS = ["overview", "mentors", "breakdowns", "activity", "funnel", "demand", "students", "log"] as const;
export type Tab = (typeof TABS)[number];

const PAID: Prisma.OrderWhereInput["status"] = { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] };
const DAY_MS = 86400_000;
const BIG = 100_000; // safety cap on rows read for one report
const fee = (cents: number) => Math.round((cents * PLATFORM_FEE_PERCENT) / 100);
const pct = (n: number, d: number) => (d > 0 ? n / d : null);

// ---------------- Date range ----------------

export type Range = { from: string; to: string; tz: string; start: Date; end: Date; days: number; bucket: "day" | "week" | "month" };

export function parseRange(sp: URLSearchParams, now = new Date()): Range {
  const tz = isValidTimeZone(sp.get("tz")) ? (sp.get("tz") as string) : DEFAULT_TIME_ZONE;
  const today = dayInZone(now, tz);
  let to = isDayString(sp.get("to")) ? (sp.get("to") as string) : today;
  let from = isDayString(sp.get("from")) ? (sp.get("from") as string) : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -3 * 366)) from = addDays(to, -3 * 366); // at most ~3 years at once
  const start = zonedToUtc(from, "00:00", tz);
  const end = zonedToUtc(addDays(to, 1), "00:00", tz);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return { from, to, tz, start, end, days, bucket: days <= 62 ? "day" : days <= 370 ? "week" : "month" };
}

const inRange = (r: Range) => ({ gte: r.start, lt: r.end });

// Day keys in the admin's time zone, cached per hour (fast for big lists).
function dayKeyer(tz: string) {
  const cache = new Map<number, string>();
  return (d: Date) => {
    const h = Math.floor(d.getTime() / 3_600_000);
    let v = cache.get(h);
    if (!v) {
      v = dayInZone(new Date(h * 3_600_000 + 1_800_000), tz);
      cache.set(h, v);
    }
    return v;
  };
}

function bucketOf(day: string, bucket: Range["bucket"]) {
  if (bucket === "day") return day;
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  return addDays(day, -((weekdayOfDay(day) + 6) % 7)); // weeks start on Monday
}

function bucketLabel(key: string, bucket: Range["bucket"]) {
  if (bucket === "month") return fmtDayLabel(key, { month: "short", year: "numeric" });
  if (bucket === "week") return `Week of ${fmtDayLabel(key, { month: "short", day: "numeric" })}`;
  return fmtDayLabel(key, { month: "short", day: "numeric" });
}

// A chart with one bar per day/week/month in the range (empty ones included).
function series(r: Range, key: string, title: string, kind: Chart["kind"], items: { at: Date; value: number }[]): Chart {
  const dayKey = dayKeyer(r.tz);
  const sums = new Map<string, number>();
  for (const it of items) {
    const b = bucketOf(dayKey(it.at), r.bucket);
    sums.set(b, (sums.get(b) || 0) + it.value);
  }
  const points: Chart["points"] = [];
  const seen = new Set<string>();
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const b = bucketOf(d, r.bucket);
    if (seen.has(b)) continue;
    seen.add(b);
    points.push({ label: bucketLabel(b, r.bucket), value: sums.get(b) || 0 });
  }
  return { key, title, kind, points };
}

// ---------------- Shared lookups ----------------

const paidDate = (o: { paidAt: Date | null; createdAt: Date }) => o.paidAt ?? o.createdAt;
const refundDate = (o: { refundedAt: Date | null; disputeResolvedAt: Date | null; paidAt: Date | null; createdAt: Date }) =>
  o.refundedAt ?? o.disputeResolvedAt ?? o.paidAt ?? o.createdAt;

function paidInRange(r: Range): Prisma.OrderWhereInput {
  return { status: PAID, OR: [{ paidAt: inRange(r) }, { paidAt: null, createdAt: inRange(r) }] };
}
function refundedInRange(r: Range): Prisma.OrderWhereInput {
  return {
    status: "REFUNDED",
    OR: [
      { refundedAt: inRange(r) },
      { refundedAt: null, disputeResolvedAt: inRange(r) },
      { refundedAt: null, disputeResolvedAt: null, paidAt: inRange(r) },
      { refundedAt: null, disputeResolvedAt: null, paidAt: null, createdAt: inRange(r) },
    ],
  };
}
const releasedInRange = (r: Range): Prisma.OrderWhereInput => ({ status: "RELEASED", completedAt: inRange(r) });

// Who did something: the account if known, else the browser.
const actorOf = (e: { id: string; userId: string | null; visitorId: string | null }) => (e.userId ? `u:${e.userId}` : e.visitorId ? `v:${e.visitorId}` : `e:${e.id}`);

function priceBandOf(cents: number) {
  const b = PRICE_BANDS.find((p) => cents >= p.min && (p.max === null || cents < p.max));
  return b ? b.label : "Under $50";
}

const turnaroundLabel = (v: string | null | undefined) => (v ? labelFor(TURNAROUNDS, v) : "Not set");
const serviceGroupLabel = (v: string | null | undefined) => (v === "OTHER" ? "Other (custom)" : v ? labelFor(SERVICES, v) : "Not set");

// "Personal statement, MD" from a search's saved filters.
export function describeFilters(filters: unknown): string {
  if (!filters || typeof filters !== "object") return "";
  const parts: string[] = [];
  for (const [k, vals] of Object.entries(filters as Record<string, unknown>)) {
    if (!Array.isArray(vals)) continue;
    const g = FILTER_GROUPS.find((x) => x.key === k);
    for (const v of vals) parts.push(g ? g.options.find((o) => o.value === v)?.label || String(v) : String(v));
  }
  return parts.join(", ");
}

// ---------------- 77. Overview ----------------

async function overview(r: Range): Promise<InsightsResult> {
  const [paid, refunded, released, held, students, mentors] = await Promise.all([
    prisma.order.findMany({
      where: paidInRange(r),
      select: { id: true, amount: true, status: true, paidAt: true, createdAt: true, gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: BIG,
    }),
    prisma.order.findMany({ where: refundedInRange(r), select: { amount: true, refundedAt: true, disputeResolvedAt: true, paidAt: true, createdAt: true }, take: BIG }),
    prisma.order.findMany({ where: releasedInRange(r), select: { amount: true, completedAt: true }, take: BIG }),
    prisma.order.aggregate({ where: { status: { in: ["IN_ESCROW", "COMPLETED"] } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.user.findMany({ where: { role: "BUYER", createdAt: inRange(r) }, select: { createdAt: true }, take: BIG }),
    prisma.user.findMany({ where: { role: "SELLER", createdAt: inRange(r) }, select: { createdAt: true }, take: BIG }),
  ]);
  const sales = paid.reduce((s, o) => s + o.amount, 0);
  const refunds = refunded.reduce((s, o) => s + o.amount, 0);
  const releasedSum = released.reduce((s, o) => s + o.amount, 0);
  const feeSum = released.reduce((s, o) => s + fee(o.amount), 0);

  const cards: Card[] = [
    { key: "sales", label: "Sales", value: sales, kind: "money", hint: `${paid.length} paid order${paid.length === 1 ? "" : "s"}` },
    { key: "aov", label: "Average order", value: paid.length ? Math.round(sales / paid.length) : null, kind: "money" },
    { key: "fee", label: `MentorsMD fee (${PLATFORM_FEE_PERCENT}%)`, value: feeSum, kind: "money", hint: "On payments released in this period" },
    { key: "payouts", label: "Paid to mentors", value: releasedSum - feeSum, kind: "money", hint: `${released.length} order${released.length === 1 ? "" : "s"} released` },
    { key: "refunds", label: "Refunds", value: refunds, kind: "money", hint: `${refunded.length} order${refunded.length === 1 ? "" : "s"}` },
    { key: "net", label: "Sales after refunds", value: sales - refunds, kind: "money" },
    { key: "held", label: "Held right now", value: held._sum.amount || 0, kind: "money", hint: `${held._count._all} order${held._count._all === 1 ? "" : "s"}, waiting for approval` },
    { key: "orders", label: "Paid orders", value: paid.length, kind: "count" },
    { key: "students", label: "New students", value: students.length, kind: "count" },
    { key: "mentors", label: "New mentors", value: mentors.length, kind: "count" },
  ];

  return {
    cards,
    charts: [
      series(r, "chart-sales", "Sales", "money", paid.map((o) => ({ at: paidDate(o), value: o.amount }))),
      series(r, "chart-orders", "Paid orders", "count", paid.map((o) => ({ at: paidDate(o), value: 1 }))),
      series(r, "chart-students", "New students", "count", students.map((u) => ({ at: u.createdAt, value: 1 }))),
      series(r, "chart-refunds", "Refunds", "money", refunded.map((o) => ({ at: refundDate(o), value: o.amount }))),
    ],
    tables: [
      {
        key: "orders",
        title: "Paid orders in this period",
        columns: [
          { key: "paid", label: "Paid", kind: "date" },
          { key: "package", label: "Package" },
          { key: "student", label: "Student" },
          { key: "mentor", label: "Mentor" },
          { key: "amount", label: "Amount", kind: "money" },
          { key: "fee", label: "Fee (20%)", kind: "money" },
          { key: "status", label: "Status" },
        ],
        rows: paid.map((o) => ({
          id: o.id,
          href: `/orders/${o.id}`,
          paid: paidDate(o).toISOString(),
          package: o.gig.title,
          student: o.buyer.name,
          mentor: o.seller.name,
          amount: o.amount,
          fee: fee(o.amount),
          status: ORDER_STATUS[o.status] || o.status,
        })),
      },
    ],
  };
}

const ORDER_STATUS: Record<string, string> = {
  IN_ESCROW: "Paid, in progress",
  COMPLETED: "Delivered, waiting for approval",
  RELEASED: "Released to mentor",
  REFUNDED: "Refunded",
};

// ---------------- Mentor-level data shared by several tabs ----------------

type MentorFilter = { school?: string; type?: string; stage?: string; service?: string };

function mentorFilterFrom(sp: URLSearchParams): MentorFilter {
  return {
    school: (sp.get("school") || "").slice(0, 120) || undefined,
    type: isValue(SCHOOL_TYPES, sp.get("type")) ? (sp.get("type") as string) : undefined,
    stage: isValue(STAGES, sp.get("stage")) ? (sp.get("stage") as string) : undefined,
    service: isValue(SERVICES, sp.get("service")) ? (sp.get("service") as string) : undefined,
  };
}

async function mentorOptions() {
  const schools = await prisma.user.findMany({
    where: { role: "SELLER", medicalSchool: { not: null } },
    distinct: ["medicalSchool"],
    select: { medicalSchool: true },
    orderBy: { medicalSchool: "asc" },
  });
  return {
    school: schools.map((s) => ({ value: s.medicalSchool as string, label: s.medicalSchool as string })),
    type: SCHOOL_TYPES,
    stage: STAGES,
    service: SERVICES,
  };
}

async function profileViewsByMentor(r: Range, mentorIds?: string[]) {
  const events = await prisma.activityEvent.findMany({
    where: { kind: "PROFILE_VIEW", createdAt: inRange(r), ...(mentorIds ? { mentorId: { in: mentorIds } } : {}) },
    select: { id: true, mentorId: true, userId: true, visitorId: true },
    take: BIG * 2,
  });
  const views = new Map<string, number>();
  const viewers = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.mentorId) continue;
    views.set(e.mentorId, (views.get(e.mentorId) || 0) + 1);
    if (!viewers.has(e.mentorId)) viewers.set(e.mentorId, new Set());
    viewers.get(e.mentorId)!.add(actorOf(e));
  }
  return { views, viewers: new Map(Array.from(viewers, ([k, v]) => [k, v.size])) };
}

const STATUS_LABEL = (u: { profileStatus: string; safetyHoldAt: Date | null; removedByAdmin?: boolean }) =>
  u.safetyHoldAt ? "On hold" : u.profileStatus === "ACTIVE" ? "Active" : u.profileStatus === "PAUSED" ? "Paused" : "Removed";

// ---------------- 78. Mentor leaderboard ----------------

async function mentorsTab(r: Range, sp: URLSearchParams): Promise<InsightsResult> {
  const f = mentorFilterFrom(sp);
  const where: Prisma.UserWhereInput = {
    role: "SELLER",
    ...(f.school ? { medicalSchool: f.school } : {}),
    ...(f.type ? { schoolType: f.type } : {}),
    ...(f.stage ? { mentorStage: f.stage } : {}),
    ...(f.service ? { gigs: { some: { active: true, service: f.service } } } : {}),
  };
  const mentors = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, medicalSchool: true, schoolType: true, mentorStage: true, profileStatus: true, safetyHoldAt: true, lastActiveAt: true, createdAt: true },
    take: 5000,
  });
  const ids = mentors.map((m) => m.id);
  const sellerIn = { sellerId: { in: ids } };
  const [paid, refunded, released, ratings, reviewsInRange, convos, pv] = await Promise.all([
    prisma.order.findMany({ where: { AND: [paidInRange(r), sellerIn] }, select: { sellerId: true, amount: true, disputed: true }, take: BIG }),
    prisma.order.findMany({ where: { AND: [refundedInRange(r), sellerIn] }, select: { sellerId: true, amount: true }, take: BIG }),
    prisma.order.findMany({ where: { AND: [releasedInRange(r), sellerIn] }, select: { sellerId: true, amount: true }, take: BIG }),
    prisma.review.groupBy({ by: ["sellerId"], where: sellerIn, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ["sellerId"], where: { ...sellerIn, createdAt: inRange(r) }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ["sellerId"], where: { ...sellerIn, createdAt: inRange(r), messages: { some: {} } }, _count: { _all: true } }),
    profileViewsByMentor(r, ids),
  ]);
  type Acc = { sales: number; orders: number; disputes: number; refunds: number; refundCount: number; earned: number };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    if (!acc.has(id)) acc.set(id, { sales: 0, orders: 0, disputes: 0, refunds: 0, refundCount: 0, earned: 0 });
    return acc.get(id)!;
  };
  for (const o of paid) {
    const a = get(o.sellerId);
    a.sales += o.amount;
    a.orders++;
    if (o.disputed) a.disputes++;
  }
  for (const o of refunded) {
    const a = get(o.sellerId);
    a.refunds += o.amount;
    a.refundCount++;
  }
  for (const o of released) get(o.sellerId).earned += o.amount - fee(o.amount);
  const rating = new Map(ratings.map((x) => [x.sellerId, x]));
  const revIn = new Map(reviewsInRange.map((x) => [x.sellerId, x._count._all]));
  const conv = new Map(convos.map((x) => [x.sellerId, x._count._all]));

  const rows: Row[] = mentors.map((m) => {
    const a = get(m.id);
    const viewers = pv.viewers.get(m.id) || 0;
    return {
      id: m.id,
      href: `/mentors/${m.id}`,
      name: m.name,
      email: m.email,
      school: m.medicalSchool || "",
      type: labelFor(SCHOOL_TYPES, m.schoolType),
      stage: labelFor(STAGES, m.mentorStage),
      sales: a.sales,
      orders: a.orders,
      aov: a.orders ? Math.round(a.sales / a.orders) : null,
      earned: a.earned,
      refunds: a.refundCount,
      disputes: a.disputes,
      rating: rating.get(m.id)?._avg.rating ?? null,
      reviews: rating.get(m.id)?._count._all ?? 0,
      newReviews: revIn.get(m.id) || 0,
      views: pv.views.get(m.id) || 0,
      viewers,
      conversations: conv.get(m.id) || 0,
      conversion: pct(a.orders, viewers),
      lastActive: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
      status: STATUS_LABEL(m),
    };
  });

  return {
    options: await mentorOptions(),
    tables: [
      {
        key: "leaderboard",
        title: "Mentor leaderboard",
        note: "Click a column to sort. Money and orders are for the dates above; rating and reviews are all-time.",
        sort: { key: "sales", dir: "desc" },
        columns: [
          { key: "name", label: "Mentor", link: "href" },
          { key: "school", label: "Medical school" },
          { key: "type", label: "MD/DO" },
          { key: "stage", label: "Stage" },
          { key: "sales", label: "Sales", kind: "money" },
          { key: "orders", label: "Orders", kind: "count" },
          { key: "aov", label: "Avg order", kind: "money" },
          { key: "earned", label: "Paid to mentor", kind: "money" },
          { key: "refunds", label: "Refunds", kind: "count" },
          { key: "disputes", label: "Disputes", kind: "count" },
          { key: "rating", label: "Rating", kind: "rating" },
          { key: "reviews", label: "Reviews", kind: "count" },
          { key: "views", label: "Profile views", kind: "count" },
          { key: "viewers", label: "Unique viewers", kind: "count" },
          { key: "conversations", label: "Students who messaged", kind: "count" },
          { key: "conversion", label: "Viewer to order", kind: "percent" },
          { key: "lastActive", label: "Last active", kind: "date" },
          { key: "status", label: "Status" },
          { key: "email", label: "Email" },
        ],
        rows,
      },
    ],
  };
}

// ---------------- 79. Breakdowns ----------------

async function breakdowns(r: Range): Promise<InsightsResult> {
  const [paid, refunded, mentors, gigs] = await Promise.all([
    prisma.order.findMany({
      where: paidInRange(r),
      select: {
        amount: true, turnaround: true,
        gig: { select: { service: true, format: true, turnaround: true } },
        seller: { select: { id: true, medicalSchool: true, schoolType: true, mentorStage: true } },
        review: { select: { rating: true } },
      },
      take: BIG,
    }),
    prisma.order.findMany({
      where: refundedInRange(r),
      select: { amount: true, turnaround: true, gig: { select: { service: true, format: true, turnaround: true } }, seller: { select: { medicalSchool: true, schoolType: true, mentorStage: true } } },
      take: BIG,
    }),
    prisma.user.findMany({ where: { role: "SELLER", profileStatus: { not: "REMOVED" } }, select: { id: true, medicalSchool: true, schoolType: true, mentorStage: true }, take: 5000 }),
    prisma.gig.findMany({
      where: { ...searchableGigWhere, seller: { role: "SELLER", profileStatus: { not: "REMOVED" } } },
      select: { price: true, service: true, format: true, turnaround: true, seller: { select: { id: true, medicalSchool: true, schoolType: true, mentorStage: true } } },
      take: BIG,
    }),
  ]);

  type O = { amount: number; turnaround: string | null; gig: { service: string | null; format: string | null; turnaround: string | null }; seller: { medicalSchool: string | null; schoolType: string | null; mentorStage: string | null } };
  type G = { price: number; service: string | null; format: string | null; turnaround: string | null; seller: { id: string; medicalSchool: string | null; schoolType: string | null; mentorStage: string | null } };
  type M = { id: string; medicalSchool: string | null; schoolType: string | null; mentorStage: string | null };
  const dims: { key: string; title: string; order: (o: O) => string; gig: (g: G) => string; mentor?: (m: M) => string }[] = [
    { key: "school", title: "By medical school", order: (o) => o.seller.medicalSchool || "Not set", gig: (g) => g.seller.medicalSchool || "Not set", mentor: (m) => m.medicalSchool || "Not set" },
    { key: "type", title: "By MD / DO", order: (o) => labelFor(SCHOOL_TYPES, o.seller.schoolType) || "Not set", gig: (g) => labelFor(SCHOOL_TYPES, g.seller.schoolType) || "Not set", mentor: (m) => labelFor(SCHOOL_TYPES, m.schoolType) || "Not set" },
    { key: "stage", title: "By mentor stage", order: (o) => labelFor(STAGES, o.seller.mentorStage) || "Not set", gig: (g) => labelFor(STAGES, g.seller.mentorStage) || "Not set", mentor: (m) => labelFor(STAGES, m.mentorStage) || "Not set" },
    { key: "service", title: "By service", order: (o) => serviceGroupLabel(o.gig.service), gig: (g) => serviceGroupLabel(g.service) },
    { key: "format", title: "By format", order: (o) => (o.gig.format ? labelFor(FORMATS, o.gig.format) : "Not set"), gig: (g) => (g.format ? labelFor(FORMATS, g.format) : "Not set") },
    { key: "price", title: "By price band", order: (o) => priceBandOf(o.amount), gig: (g) => priceBandOf(g.price) },
    { key: "turnaround", title: "By turnaround", order: (o) => turnaroundLabel(o.turnaround ?? o.gig.turnaround), gig: (g) => turnaroundLabel(g.turnaround) },
  ];
  const totalSales = paid.reduce((s, o) => s + o.amount, 0);

  const tables: Table[] = dims.map((d) => {
    type Acc = { orders: number; sales: number; refunds: number; ratingSum: number; ratingN: number; packages: number; mentors: Set<string> };
    const map = new Map<string, Acc>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { orders: 0, sales: 0, refunds: 0, ratingSum: 0, ratingN: 0, packages: 0, mentors: new Set() });
      return map.get(k)!;
    };
    for (const o of paid) {
      const a = get(d.order(o));
      a.orders++;
      a.sales += o.amount;
      if (o.review) {
        a.ratingSum += o.review.rating;
        a.ratingN++;
      }
    }
    for (const o of refunded) get(d.order(o)).refunds++;
    for (const g of gigs) {
      const a = get(d.gig(g));
      a.packages++;
      a.mentors.add(g.seller.id);
    }
    if (d.mentor) for (const m of mentors) get(d.mentor(m)).mentors.add(m.id);
    const rows: Row[] = Array.from(map, ([value, a]) => ({
      value,
      mentors: a.mentors.size,
      packages: a.packages,
      orders: a.orders,
      sales: a.sales,
      share: pct(a.sales, totalSales),
      aov: a.orders ? Math.round(a.sales / a.orders) : null,
      refunds: a.refunds,
      rating: a.ratingN ? a.ratingSum / a.ratingN : null,
    }));
    return {
      key: d.key,
      title: d.title,
      sort: { key: "sales", dir: "desc" },
      columns: [
        { key: "value", label: d.title.replace(/^By /, "").replace(/^./, (c) => c.toUpperCase()) },
        { key: "mentors", label: d.mentor ? "Mentors" : "Mentors offering", kind: "count" },
        { key: "packages", label: "Live packages", kind: "count" },
        { key: "orders", label: "Paid orders", kind: "count" },
        { key: "sales", label: "Sales", kind: "money" },
        { key: "share", label: "Share of sales", kind: "percent" },
        { key: "aov", label: "Avg order", kind: "money" },
        { key: "refunds", label: "Refunds", kind: "count" },
        { key: "rating", label: "Avg rating", kind: "rating" },
      ],
      rows,
    };
  });
  return { tables };
}

// ---------------- 80. Activity ----------------

async function activity(r: Range, now = new Date()): Promise<InsightsResult> {
  const t = now.getTime();
  const [active1, active7, active30, messages, convos, bookings, cancelled] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["BUYER", "SELLER"] }, lastActiveAt: { gte: new Date(t - DAY_MS) } } }),
    prisma.user.count({ where: { role: { in: ["BUYER", "SELLER"] }, lastActiveAt: { gte: new Date(t - 7 * DAY_MS) } } }),
    prisma.user.count({ where: { role: { in: ["BUYER", "SELLER"] }, lastActiveAt: { gte: new Date(t - 30 * DAY_MS) } } }),
    prisma.message.findMany({
      where: { createdAt: inRange(r) },
      select: { createdAt: true, senderId: true, conversation: { select: { sellerId: true } } },
      take: BIG * 2,
    }),
    prisma.conversation.count({ where: { createdAt: inRange(r), messages: { some: {} } } }),
    prisma.callBooking.findMany({
      where: { startTime: inRange(r), endTime: { lt: now }, status: { not: "CANCELLED" } },
      select: {
        id: true, startTime: true, roomName: true,
        attendance: { select: { userId: true } },
        order: { select: { id: true, buyerId: true, sellerId: true, buyer: { select: { name: true } }, seller: { select: { name: true } }, gig: { select: { title: true } } } },
      },
      take: BIG,
    }),
    prisma.callBooking.count({ where: { startTime: inRange(r), status: "CANCELLED" } }),
  ]);

  let fromStudents = 0;
  let fromMentors = 0;
  const senders = new Set<string>();
  for (const m of messages) {
    senders.add(m.senderId);
    if (m.senderId === m.conversation.sellerId) fromMentors++;
    else fromStudents++;
  }

  // A call counts as held unless the attendance log shows someone missing.
  // No-shows are only counted when at least one person joined (if the
  // attendance webhook isn't connected, nobody is ever marked absent).
  let held = 0;
  const noShows: Row[] = [];
  let studentNoShows = 0;
  let mentorNoShows = 0;
  for (const b of bookings) {
    const joined = new Set(b.attendance.map((a) => a.userId).filter(Boolean) as string[]);
    const studentIn = joined.has(b.order.buyerId);
    const mentorIn = joined.has(b.order.sellerId);
    if (!b.roomName || joined.size === 0 || (studentIn && mentorIn)) {
      held++;
      continue;
    }
    if (!studentIn) studentNoShows++;
    if (!mentorIn) mentorNoShows++;
    noShows.push({
      id: b.id,
      href: `/orders/${b.order.id}`,
      when: b.startTime.toISOString(),
      package: b.order.gig.title,
      student: b.order.buyer.name,
      mentor: b.order.seller.name,
      missing: !studentIn && !mentorIn ? "Both" : !studentIn ? "Student" : "Mentor",
    });
  }

  // Quiet mentors: visible mentors with live packages who haven't logged in
  // for 14+ days, or haven't sent a message in 30 days.
  const d14 = new Date(t - 14 * DAY_MS);
  const d30 = new Date(t - 30 * DAY_MS);
  const live = await prisma.user.findMany({
    where: { role: "SELLER", profileStatus: "ACTIVE", safetyHoldAt: null, gigs: { some: bookableGigWhere } },
    select: { id: true, name: true, email: true, lastActiveAt: true, _count: { select: { gigs: { where: bookableGigWhere } } } },
    take: 5000,
  });
  const liveIds = live.map((m) => m.id);
  const [lastSent, recentOrders, waiting] = await Promise.all([
    prisma.message.groupBy({ by: ["senderId"], where: { senderId: { in: liveIds } }, _max: { createdAt: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: liveIds }, status: PAID, createdAt: { gte: new Date(t - 90 * DAY_MS) } }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ["sellerId"], where: { sellerId: { in: liveIds }, sellerUnread: { gt: 0 } }, _count: { _all: true } }),
  ]);
  const lastSentBy = new Map(lastSent.map((x) => [x.senderId, x._max.createdAt]));
  const orders90 = new Map(recentOrders.map((x) => [x.sellerId, x._count._all]));
  const unread = new Map(waiting.map((x) => [x.sellerId, x._count._all]));
  const quiet: Row[] = live
    .filter((m) => {
      const ls = lastSentBy.get(m.id);
      return !m.lastActiveAt || m.lastActiveAt < d14 || !ls || ls < d30;
    })
    .map((m) => {
      const ls = lastSentBy.get(m.id) || null;
      return {
        id: m.id,
        href: `/mentors/${m.id}`,
        name: m.name,
        email: m.email,
        lastActive: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
        lastMessage: ls ? ls.toISOString() : null,
        unread: unread.get(m.id) || 0,
        packages: m._count.gigs,
        orders90: orders90.get(m.id) || 0,
        reason: !m.lastActiveAt || m.lastActiveAt < d14 ? "No login in 14+ days" : "No messages sent in 30 days",
      };
    });

  return {
    cards: [
      { key: "active1", label: "Active today", value: active1, kind: "count", hint: "Students and mentors, last 24 hours" },
      { key: "active7", label: "Active this week", value: active7, kind: "count", hint: "Last 7 days" },
      { key: "active30", label: "Active this month", value: active30, kind: "count", hint: "Last 30 days" },
      { key: "senders", label: "People who sent messages", value: senders.size, kind: "count", hint: "In the dates above" },
      { key: "messages", label: "Messages sent", value: messages.length, kind: "count", hint: `${fromStudents} by students, ${fromMentors} by mentors` },
      { key: "convos", label: "New conversations", value: convos, kind: "count" },
      { key: "calls", label: "Calls held", value: held, kind: "count", hint: `${cancelled} cancelled` },
      { key: "noshowS", label: "Student no-shows", value: studentNoShows, kind: "count" },
      { key: "noshowM", label: "Mentor no-shows", value: mentorNoShows, kind: "count" },
      { key: "quiet", label: "Quiet mentors", value: quiet.length, kind: "count", hint: "Right now" },
    ],
    charts: [
      series(r, "chart-messages", "Messages sent", "count", messages.map((m) => ({ at: m.createdAt, value: 1 }))),
      series(r, "chart-calls", "Calls (not cancelled)", "count", bookings.map((b) => ({ at: b.startTime, value: 1 }))),
    ],
    tables: [
      {
        key: "quiet",
        title: "Quiet mentors",
        note: "Live mentors with no login in 14+ days or no messages sent in 30 days. Worth a check-in.",
        sort: { key: "lastActive", dir: "asc" },
        columns: [
          { key: "name", label: "Mentor", link: "href" },
          { key: "reason", label: "Why" },
          { key: "lastActive", label: "Last active", kind: "date" },
          { key: "lastMessage", label: "Last message sent", kind: "date" },
          { key: "unread", label: "Conversations waiting", kind: "count" },
          { key: "packages", label: "Live packages", kind: "count" },
          { key: "orders90", label: "Orders (90 days)", kind: "count" },
          { key: "email", label: "Email" },
        ],
        rows: quiet,
      },
      {
        key: "noshows",
        title: "Calls where someone didn't join",
        note: "From the video call attendance log. Only shown when at least one person joined.",
        sort: { key: "when", dir: "desc" },
        columns: [
          { key: "when", label: "Call time", kind: "date" },
          { key: "missing", label: "Who didn't join" },
          { key: "package", label: "Package", link: "href" },
          { key: "student", label: "Student" },
          { key: "mentor", label: "Mentor" },
        ],
        rows: noShows,
      },
    ],
  };
}

// ---------------- 81. Funnel ----------------

async function funnel(r: Range, sp: URLSearchParams): Promise<InsightsResult> {
  const mentorId = (sp.get("mentor") || "").slice(0, 40) || null;
  const [visits, searches, views, newStudents, convos, checkouts, paid, released] = await Promise.all([
    prisma.activityEvent.findMany({ where: { kind: "VISIT", createdAt: inRange(r) }, select: { id: true, userId: true, visitorId: true }, take: BIG * 2 }),
    prisma.activityEvent.findMany({ where: { kind: "SEARCH", createdAt: inRange(r) }, select: { id: true, userId: true, visitorId: true }, take: BIG * 2 }),
    prisma.activityEvent.findMany({ where: { kind: "PROFILE_VIEW", createdAt: inRange(r) }, select: { id: true, userId: true, visitorId: true, mentorId: true }, take: BIG * 2 }),
    prisma.user.count({ where: { role: "BUYER", createdAt: inRange(r) } }),
    prisma.conversation.findMany({ where: { createdAt: inRange(r), messages: { some: {} } }, select: { buyerId: true, sellerId: true }, take: BIG }),
    prisma.order.findMany({ where: { createdAt: inRange(r) }, select: { buyerId: true, sellerId: true }, take: BIG }),
    prisma.order.findMany({ where: paidInRange(r), select: { buyerId: true, sellerId: true }, take: BIG }),
    prisma.order.findMany({ where: releasedInRange(r), select: { buyerId: true, sellerId: true }, take: BIG }),
  ]);
  const distinct = (xs: { id: string; userId: string | null; visitorId: string | null }[]) => new Set(xs.map(actorOf)).size;
  const buyers = (xs: { buyerId: string }[]) => new Set(xs.map((x) => x.buyerId)).size;

  const site: FunnelStep[] = [
    { label: "Visited the site", value: distinct(visits), unit: "browsers" },
    { label: "Searched or filtered mentors", value: distinct(searches), unit: "browsers" },
    { label: "Viewed a mentor's profile", value: distinct(views), unit: "browsers" },
    { label: "Created a student account", value: newStudents, unit: "students" },
    { label: "Messaged a mentor", value: buyers(convos), unit: "students" },
    { label: "Started checkout", value: buyers(checkouts), unit: "students" },
    { label: "Paid", value: buyers(paid), unit: "students" },
    { label: "Approved the work (payment released)", value: buyers(released), unit: "students" },
  ];

  // Per mentor: same steps, from that mentor's profile onwards.
  const mentors = await prisma.user.findMany({ where: { role: "SELLER" }, select: { id: true, name: true, profileStatus: true }, orderBy: { name: "asc" }, take: 5000 });
  type Acc = { views: number; viewers: Set<string>; messaged: Set<string>; checkout: Set<string>; paid: number; released: number };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    if (!acc.has(id)) acc.set(id, { views: 0, viewers: new Set(), messaged: new Set(), checkout: new Set(), paid: 0, released: 0 });
    return acc.get(id)!;
  };
  for (const v of views) {
    if (!v.mentorId) continue;
    const a = get(v.mentorId);
    a.views++;
    a.viewers.add(actorOf(v));
  }
  for (const c of convos) get(c.sellerId).messaged.add(c.buyerId);
  for (const o of checkouts) get(o.sellerId).checkout.add(o.buyerId);
  for (const o of paid) get(o.sellerId).paid++;
  for (const o of released) get(o.sellerId).released++;

  const rows: Row[] = mentors.map((m) => {
    const a = get(m.id);
    return {
      id: m.id,
      href: `/mentors/${m.id}`,
      name: m.name,
      views: a.views,
      viewers: a.viewers.size,
      messaged: a.messaged.size,
      checkout: a.checkout.size,
      paid: a.paid,
      released: a.released,
      viewToMessage: pct(a.messaged.size, a.viewers.size),
      messageToPaid: pct(a.paid, a.messaged.size),
    };
  });

  let chosen: NonNullable<InsightsResult["funnels"]>[number] | null = null;
  if (mentorId) {
    const m = mentors.find((x) => x.id === mentorId);
    const row = rows.find((x) => x.id === mentorId);
    if (m && row) {
      chosen = {
        key: "funnel-mentor",
        title: `Funnel for ${m.name}`,
        steps: [
          { label: "Profile views", value: row.views as number, unit: "views" },
          { label: "Unique viewers", value: row.viewers as number, unit: "browsers" },
          { label: "Students who messaged", value: row.messaged as number, unit: "students" },
          { label: "Started checkout", value: row.checkout as number, unit: "students" },
          { label: "Paid orders", value: row.paid as number, unit: "orders" },
          { label: "Payment released", value: row.released as number, unit: "orders" },
        ],
      };
    }
  }

  return {
    funnels: [
      {
        key: "funnel-site",
        title: "Site-wide funnel",
        note: "The first three steps count browsers (one person on two devices counts twice); the rest count student accounts.",
        steps: site,
      },
      ...(chosen ? [chosen] : []),
    ],
    options: { mentor: mentors.map((m) => ({ value: m.id, label: m.profileStatus === "REMOVED" ? `${m.name} (removed)` : m.name })) },
    tables: [
      {
        key: "mentors",
        title: "Every mentor's funnel",
        sort: { key: "views", dir: "desc" },
        columns: [
          { key: "name", label: "Mentor", link: "href" },
          { key: "views", label: "Profile views", kind: "count" },
          { key: "viewers", label: "Unique viewers", kind: "count" },
          { key: "messaged", label: "Students who messaged", kind: "count" },
          { key: "checkout", label: "Started checkout", kind: "count" },
          { key: "paid", label: "Paid orders", kind: "count" },
          { key: "released", label: "Released", kind: "count" },
          { key: "viewToMessage", label: "Viewer to message", kind: "percent" },
          { key: "messageToPaid", label: "Message to order", kind: "percent" },
        ],
        rows,
      },
    ],
  };
}

// ---------------- 82. Student demand ----------------

async function demand(r: Range): Promise<InsightsResult> {
  const [searches, gigs] = await Promise.all([
    prisma.activityEvent.findMany({ where: { kind: "SEARCH", createdAt: inRange(r) }, select: { id: true, createdAt: true, userId: true, visitorId: true, query: true, filters: true, resultCount: true }, take: BIG * 2 }),
    prisma.gig.findMany({ where: { ...searchableGigWhere, seller: { role: "SELLER", profileStatus: "ACTIVE", safetyHoldAt: null } }, select: { service: true, sellerId: true }, take: BIG }),
  ]);
  const zero = searches.filter((s) => s.resultCount === 0);

  type Q = { n: number; results: number; zero: number; last: Date };
  const words = new Map<string, Q>();
  const picks = new Map<string, { group: string; choice: string; n: number; zero: number }>();
  const zeroCombos = new Map<string, { words: string; filters: string; n: number; last: Date }>();
  for (const s of searches) {
    if (s.query) {
      const q = words.get(s.query) || { n: 0, results: 0, zero: 0, last: s.createdAt };
      q.n++;
      q.results += s.resultCount || 0;
      if (s.resultCount === 0) q.zero++;
      if (s.createdAt > q.last) q.last = s.createdAt;
      words.set(s.query, q);
    }
    if (s.filters && typeof s.filters === "object") {
      for (const [k, vals] of Object.entries(s.filters as Record<string, unknown>)) {
        if (!Array.isArray(vals)) continue;
        const g = FILTER_GROUPS.find((x) => x.key === k);
        for (const v of vals) {
          const id = `${k}:${v}`;
          const p = picks.get(id) || { group: g?.title || k, choice: g?.options.find((o) => o.value === v)?.label || String(v), n: 0, zero: 0 };
          p.n++;
          if (s.resultCount === 0) p.zero++;
          picks.set(id, p);
        }
      }
    }
    if (s.resultCount === 0) {
      const f = describeFilters(s.filters);
      const id = `${s.query || ""}|${f}`;
      const z = zeroCombos.get(id) || { words: s.query || "", filters: f, n: 0, last: s.createdAt };
      z.n++;
      if (s.createdAt > z.last) z.last = s.createdAt;
      zeroCombos.set(id, z);
    }
  }

  // Demand vs supply per service.
  const supply = new Map<string, { packages: number; mentors: Set<string> }>();
  for (const g of gigs) {
    const k = g.service || "";
    const s = supply.get(k) || { packages: 0, mentors: new Set<string>() };
    s.packages++;
    s.mentors.add(g.sellerId);
    supply.set(k, s);
  }
  const serviceRows: Row[] = SERVICES.map((o) => {
    const p = picks.get(`service:${o.value}`);
    const s = supply.get(o.value);
    return { service: o.label, searches: p?.n || 0, zero: p?.zero || 0, packages: s?.packages || 0, mentors: s?.mentors.size || 0 };
  });

  return {
    cards: [
      { key: "searches", label: "Searches", value: searches.length, kind: "count", hint: "Typed words or filters on Find a mentor" },
      { key: "searchers", label: "People searching", value: new Set(searches.map(actorOf)).size, kind: "count" },
      { key: "zero", label: "Searches with no results", value: zero.length, kind: "count", hint: searches.length ? `${Math.round((zero.length / searches.length) * 100)}% of searches` : undefined },
      { key: "typed", label: "Searches with typed words", value: searches.filter((s) => s.query).length, kind: "count" },
    ],
    charts: [series(r, "chart-searches", "Searches", "count", searches.map((s) => ({ at: s.createdAt, value: 1 })))],
    tables: [
      {
        key: "words",
        title: "Top searched words",
        sort: { key: "n", dir: "desc" },
        columns: [
          { key: "query", label: "Search words" },
          { key: "n", label: "Times searched", kind: "count" },
          { key: "avgResults", label: "Avg mentors found", kind: "count" },
          { key: "zero", label: "Times with no results", kind: "count" },
          { key: "last", label: "Last searched", kind: "date" },
        ],
        rows: Array.from(words, ([query, q]) => ({ query, n: q.n, avgResults: Math.round((q.results / q.n) * 10) / 10, zero: q.zero, last: q.last.toISOString() })),
      },
      {
        key: "filters",
        title: "Top filters",
        sort: { key: "n", dir: "desc" },
        columns: [
          { key: "group", label: "Filter" },
          { key: "choice", label: "Choice" },
          { key: "n", label: "Times used", kind: "count" },
          { key: "zero", label: "Times with no results", kind: "count" },
        ],
        rows: Array.from(picks.values()).map((p) => ({ ...p })),
      },
      {
        key: "zero",
        title: "Searches with no results",
        note: "What students looked for and didn't find. Good hints for new mentors or packages.",
        sort: { key: "n", dir: "desc" },
        columns: [
          { key: "words", label: "Search words" },
          { key: "filters", label: "Filters" },
          { key: "n", label: "Times", kind: "count" },
          { key: "last", label: "Last time", kind: "date" },
        ],
        rows: Array.from(zeroCombos.values()).map((z) => ({ words: z.words, filters: z.filters, n: z.n, last: z.last.toISOString() })),
      },
      {
        key: "services",
        title: "Service demand vs. supply",
        note: "How often each service filter was used, next to how many live packages offer it.",
        sort: { key: "searches", dir: "desc" },
        columns: [
          { key: "service", label: "Service" },
          { key: "searches", label: "Times filtered", kind: "count" },
          { key: "zero", label: "No results", kind: "count" },
          { key: "packages", label: "Live packages", kind: "count" },
          { key: "mentors", label: "Mentors offering", kind: "count" },
        ],
        rows: serviceRows,
      },
    ],
  };
}

// ---------------- 83. Students ----------------

async function students(r: Range): Promise<InsightsResult> {
  const [paid, refunded, newStudents] = await Promise.all([
    prisma.order.findMany({ where: paidInRange(r), select: { buyerId: true, amount: true }, take: BIG }),
    prisma.order.findMany({ where: refundedInRange(r), select: { buyerId: true, amount: true }, take: BIG }),
    prisma.user.findMany({ where: { role: "BUYER", createdAt: inRange(r) }, select: { id: true, signupSource: true }, take: BIG }),
  ]);
  const payers = Array.from(new Set(paid.map((o) => o.buyerId)));
  const newIds = newStudents.map((u) => u.id);
  const [lifetime, people, newPaid] = await Promise.all([
    prisma.order.groupBy({ by: ["buyerId"], where: { buyerId: { in: payers }, status: PAID }, _sum: { amount: true }, _count: { _all: true }, _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.user.findMany({ where: { id: { in: payers } }, select: { id: true, name: true, email: true, createdAt: true, signupSource: true } }),
    prisma.order.groupBy({ by: ["buyerId"], where: { buyerId: { in: newIds }, status: PAID }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const life = new Map(lifetime.map((x) => [x.buyerId, x]));
  const who = new Map(people.map((p) => [p.id, p]));
  const spend = new Map<string, { n: number; sum: number; refunds: number }>();
  for (const o of paid) {
    const s = spend.get(o.buyerId) || { n: 0, sum: 0, refunds: 0 };
    s.n++;
    s.sum += o.amount;
    spend.set(o.buyerId, s);
  }
  for (const o of refunded) {
    const s = spend.get(o.buyerId);
    if (s) s.refunds += o.amount;
  }
  const repeaters = payers.filter((id) => (life.get(id)?._count._all || 0) >= 2).length;
  const totalSpend = paid.reduce((s, o) => s + o.amount, 0);

  const dist = [0, 0, 0, 0];
  for (const id of payers) {
    const n = life.get(id)?._count._all || 0;
    dist[Math.min(Math.max(n, 1), 4) - 1]++;
  }

  const newPaidMap = new Map(newPaid.map((x) => [x.buyerId, x]));
  const sources = new Map<string, { n: number; paying: number; revenue: number }>();
  for (const u of newStudents) {
    const k = u.signupSource || "";
    const s = sources.get(k) || { n: 0, paying: 0, revenue: 0 };
    s.n++;
    const p = newPaidMap.get(u.id);
    if (p) {
      s.paying++;
      s.revenue += p._sum.amount || 0;
    }
    sources.set(k, s);
  }

  return {
    cards: [
      { key: "payers", label: "Students who paid", value: payers.length, kind: "count" },
      { key: "repeat", label: "Repeat rate", value: pct(repeaters, payers.length), kind: "percent", hint: "Of those, share with 2+ paid orders ever" },
      { key: "avgSpend", label: "Avg spend per student", value: payers.length ? Math.round(totalSpend / payers.length) : null, kind: "money" },
      { key: "new", label: "New students", value: newStudents.length, kind: "count" },
      { key: "newPaying", label: "New students who paid", value: newPaid.length, kind: "count", hint: newStudents.length ? `${Math.round((newPaid.length / newStudents.length) * 100)}% of new students` : undefined },
    ],
    tables: [
      {
        key: "spenders",
        title: "Top spenders",
        sort: { key: "spent", dir: "desc" },
        columns: [
          { key: "name", label: "Student" },
          { key: "orders", label: "Orders (dates above)", kind: "count" },
          { key: "spent", label: "Spent (dates above)", kind: "money" },
          { key: "refunds", label: "Refunded", kind: "money" },
          { key: "lifeOrders", label: "Orders ever", kind: "count" },
          { key: "lifeSpent", label: "Spent ever", kind: "money" },
          { key: "first", label: "First order", kind: "date" },
          { key: "last", label: "Latest order", kind: "date" },
          { key: "source", label: "Signup source" },
          { key: "joined", label: "Joined", kind: "date" },
          { key: "email", label: "Email" },
        ],
        rows: payers.map((id) => {
          const s = spend.get(id)!;
          const l = life.get(id);
          const p = who.get(id);
          return {
            id,
            name: p?.name || "(deleted)",
            email: p?.email || "",
            orders: s.n,
            spent: s.sum,
            refunds: s.refunds,
            lifeOrders: l?._count._all || 0,
            lifeSpent: l?._sum.amount || 0,
            first: l?._min.createdAt ? l._min.createdAt.toISOString() : null,
            last: l?._max.createdAt ? l._max.createdAt.toISOString() : null,
            source: sourceLabel(p?.signupSource),
            joined: p ? p.createdAt.toISOString() : null,
          };
        }),
      },
      {
        key: "sources",
        title: "Signup source (students who joined in these dates)",
        note: "Where each student first came from: a link's utm_source, the website that sent them, or direct.",
        sort: { key: "n", dir: "desc" },
        columns: [
          { key: "source", label: "Source" },
          { key: "n", label: "New students", kind: "count" },
          { key: "paying", label: "Became paying", kind: "count" },
          { key: "rate", label: "Conversion", kind: "percent" },
          { key: "revenue", label: "Their sales so far", kind: "money" },
        ],
        rows: Array.from(sources, ([k, s]) => ({ source: sourceLabel(k || null), n: s.n, paying: s.paying, rate: pct(s.paying, s.n), revenue: s.revenue })),
      },
      {
        key: "repeat",
        title: "How many orders paying students have placed",
        columns: [
          { key: "orders", label: "Paid orders ever" },
          { key: "students", label: "Students", kind: "count" },
          { key: "share", label: "Share", kind: "percent" },
        ],
        rows: ["1", "2", "3", "4 or more"].map((label, i) => ({ orders: label, students: dist[i], share: pct(dist[i], payers.length) })),
      },
    ],
  };
}

// ---------------- 86. Private activity log ----------------

const KIND_LABEL: Record<string, string> = { VISIT: "Visit", PROFILE_VIEW: "Profile view", SEARCH: "Search", SIGNUP: "Signup" };

async function activityLog(r: Range, sp: URLSearchParams, csv: boolean): Promise<InsightsResult> {
  const kind = ["VISIT", "PROFILE_VIEW", "SEARCH", "SIGNUP"].includes(sp.get("kind") || "") ? (sp.get("kind") as string) : null;
  const who = (sp.get("who") || "").trim().slice(0, 100);
  const where: Prisma.ActivityEventWhereInput = {
    createdAt: inRange(r),
    ...(kind ? { kind } : {}),
    ...(who ? { OR: [{ user: { OR: [{ name: { contains: who, mode: "insensitive" } }, { email: { contains: who, mode: "insensitive" } }] } }, { query: { contains: who.toLowerCase() } }, { visitorId: who }] } : {}),
  };
  const [events, counts] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: csv ? 50_000 : 500,
      select: { id: true, createdAt: true, kind: true, visitorId: true, mentorId: true, query: true, filters: true, resultCount: true, source: true, path: true, user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.activityEvent.groupBy({ by: ["kind"], where: { createdAt: inRange(r) }, _count: { _all: true } }),
  ]);
  const mentorIds = Array.from(new Set(events.map((e) => e.mentorId).filter(Boolean) as string[]));
  const mentors = new Map((await prisma.user.findMany({ where: { id: { in: mentorIds } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const count = (k: string) => counts.find((c) => c.kind === k)?._count._all || 0;

  return {
    cards: [
      { key: "visits", label: "Visits", value: count("VISIT"), kind: "count" },
      { key: "views", label: "Profile views", value: count("PROFILE_VIEW"), kind: "count" },
      { key: "searches", label: "Searches", value: count("SEARCH"), kind: "count" },
      { key: "signups", label: "Signups", value: count("SIGNUP"), kind: "count" },
    ],
    tables: [
      {
        key: "log",
        title: "Activity log",
        note: `Private: only admins can see this. Newest first${csv ? "" : ", up to 500 rows here (the CSV has up to 50,000)"}. Visitors without an account show as a short browser id.`,
        sort: { key: "at", dir: "desc" },
        columns: [
          { key: "at", label: "When", kind: "date" },
          { key: "kind", label: "What" },
          { key: "who", label: "Who" },
          { key: "role", label: "Account" },
          { key: "details", label: "Details" },
          { key: "source", label: "Source" },
          { key: "email", label: "Email" },
        ],
        rows: events.map((e) => {
          let details = "";
          if (e.kind === "PROFILE_VIEW") details = `Viewed ${mentors.get(e.mentorId || "") || "a mentor"}'s profile`;
          else if (e.kind === "SEARCH") {
            const f = describeFilters(e.filters);
            details = [e.query ? `"${e.query}"` : "", f].filter(Boolean).join(" · ") + ` → ${e.resultCount ?? "?"} mentor${e.resultCount === 1 ? "" : "s"}`;
          } else if (e.kind === "VISIT") details = e.path ? `Landed on ${e.path}` : "";
          else if (e.kind === "SIGNUP") details = "Created an account";
          return {
            id: e.id,
            at: e.createdAt.toISOString(),
            kind: KIND_LABEL[e.kind] || e.kind,
            who: e.user ? e.user.name : e.visitorId ? `Visitor ${e.visitorId.slice(0, 6)}` : "Visitor",
            role: e.user ? (e.user.role === "SELLER" ? "Mentor" : e.user.role === "BUYER" ? "Student" : "Admin") : "No account",
            details,
            source: e.source ? sourceLabel(e.source) : "",
            email: e.user?.email || "",
          };
        }),
      },
    ],
  };
}

// ---------------- Entry point + CSV ----------------

export async function runInsights(tab: Tab, sp: URLSearchParams, csv = false): Promise<{ range: Range; result: InsightsResult }> {
  const range = parseRange(sp);
  let result: InsightsResult;
  switch (tab) {
    case "mentors":
      result = await mentorsTab(range, sp);
      break;
    case "breakdowns":
      result = await breakdowns(range);
      break;
    case "activity":
      result = await activity(range);
      break;
    case "funnel":
      result = await funnel(range, sp);
      break;
    case "demand":
      result = await demand(range);
      break;
    case "students":
      result = await students(range);
      break;
    case "log":
      result = await activityLog(range, sp, csv);
      break;
    default:
      result = await overview(range);
  }
  return { range, result };
}

function csvValue(v: string | number | null, kind?: ColKind) {
  if (v === null || v === undefined) return "";
  if (kind === "money" && typeof v === "number") return (v / 100).toFixed(2);
  if (kind === "percent" && typeof v === "number") return (v * 100).toFixed(1);
  if (kind === "rating" && typeof v === "number") return v.toFixed(2);
  return v;
}

// One table (or chart, or the stat cards) as CSV. Money is in dollars,
// percentages are 0-100, dates are ISO (UTC).
export function toCsv(result: InsightsResult, key: string): string | null {
  let columns: Col[];
  let rows: Row[];
  const table = result.tables.find((t) => t.key === key);
  const chart = result.charts?.find((c) => c.key === key);
  if (table) {
    columns = table.columns.map((c) => ({ ...c, label: c.kind === "money" ? `${c.label} ($)` : c.kind === "percent" ? `${c.label} (%)` : c.label }));
    rows = table.rows;
  } else if (chart) {
    columns = [{ key: "label", label: "Period" }, { key: "value", label: chart.kind === "money" ? `${chart.title} ($)` : chart.title, kind: chart.kind === "money" ? "money" : "count" }];
    rows = chart.points;
  } else if (key === "summary" && result.cards) {
    return [
      ["Measure", "Value", "Note"].map(csvCell).join(","),
      ...result.cards.map((c) => [c.label + (c.kind === "money" ? " ($)" : c.kind === "percent" ? " (%)" : ""), csvValue(c.value, c.kind), c.hint || ""].map(csvCell).join(",")),
    ].join("\r\n");
  } else if (result.funnels?.some((f) => f.key === key)) {
    const steps = result.funnels.find((f) => f.key === key)!.steps;
    return [
      ["Step", "Count", "Counted as", "From previous step (%)", "From first step (%)"].map(csvCell).join(","),
      ...steps.map((s, i) =>
        [s.label, s.value, s.unit, i && steps[i - 1].value ? ((s.value / steps[i - 1].value) * 100).toFixed(1) : "", steps[0].value ? ((s.value / steps[0].value) * 100).toFixed(1) : ""].map(csvCell).join(",")
      ),
    ].join("\r\n");
  } else return null;
  return [columns.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => columns.map((c) => csvCell(csvValue(r[c.key] ?? null, c.kind))).join(","))].join("\r\n");
}
