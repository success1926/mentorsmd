import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { healthBadges, healthLabel } from "@/lib/health";
import { csvBody, csvResponse } from "@/lib/csv";
import { SCHOOL_TYPES, STAGES, labelFor } from "@/lib/options";

// Admin "People" list: mentors or students, with search.
//   ?role=SELLER|BUYER  (default SELLER)
//   ?q=text             name or email contains
//   ?status=ACTIVE|PAUSED|REMOVED  (optional)
//   ?format=csv          download the list (#84), up to 20,000 people
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const role = sp.get("role") === "BUYER" ? "BUYER" : "SELLER";
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const status = sp.get("status");
  const csv = sp.get("format") === "csv";

  const users = await prisma.user.findMany({
    where: {
      role,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(status === "ACTIVE" || status === "PAUSED" || status === "REMOVED" ? { profileStatus: status } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      credential: true,
      photoUrl: true,
      createdAt: true,
      profileStatus: true,
      pausedUntil: true,
      removedAt: true,
      removedReason: true,
      removedByAdmin: true,
      stripeAccountId: true,
      safetyHoldAt: true,
      minorStatus: true,
      acceptsMinors: true,
      lastActiveAt: true,
      medicalSchool: true,
      schoolType: true,
      mentorStage: true,
      signupSource: true,
      _count: { select: { gigs: { where: { active: true } }, buyerOrders: true, sellerOrders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: csv ? 20_000 : 200,
  });

  if (csv) {
    const label = (u: (typeof users)[number]) => (u.safetyHoldAt ? "On hold" : u.profileStatus === "ACTIVE" ? "Active" : u.profileStatus === "PAUSED" ? "Paused" : "Removed");
    const header =
      role === "SELLER"
        ? ["Name", "Email", "Joined (UTC)", "Status", "Medical school", "MD/DO", "Stage", "Live packages", "Orders", "Payouts connected", "Last active (UTC)", "Signup source", "Id"]
        : ["Name", "Email", "Joined (UTC)", "Status", "Under 18", "Orders", "Last active (UTC)", "Signup source", "Id"];
    const rows = users.map((u) =>
      role === "SELLER"
        ? [u.name, u.email, u.createdAt, label(u), u.medicalSchool, labelFor(SCHOOL_TYPES, u.schoolType), labelFor(STAGES, u.mentorStage), u._count.gigs, u._count.sellerOrders, u.stripeAccountId ? "yes" : "no", u.lastActiveAt, u.signupSource, u.id]
        : [u.name, u.email, u.createdAt, label(u), u.minorStatus ? "yes" : "no", u._count.buyerOrders, u.lastActiveAt, u.signupSource, u.id]
    );
    return csvResponse(`mentorsmd-${role === "SELLER" ? "mentors" : "students"}-${new Date().toISOString().slice(0, 10)}.csv`, csvBody(header, rows));
  }

  const [mentors, students] = await Promise.all([
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "BUYER" } }),
  ]);

  // Health badges: open / high-severity / upheld flags per person. (The
  // full scorecard with performance numbers is on each person's View.)
  const badges = await healthBadges(users.map((u) => u.id));

  return NextResponse.json({
    users: users.map(({ stripeAccountId, ...u }) => {
      const b = badges.get(u.id) || { openFlags: 0, highOpen: 0, upheld90: 0 };
      return {
        ...u,
        payoutsConnected: !!stripeAccountId,
        flags: b,
        health: healthLabel({ ...b, onHold: !!u.safetyHoldAt, issueCount: 0 }),
      };
    }),
    counts: { mentors, students },
  });
}
