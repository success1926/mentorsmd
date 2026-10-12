import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin: the custom service names mentors typed for "Other" packages,
// grouped case-insensitively. Several mentors writing the same thing is
// the signal to add it as an official service.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const gigs = await prisma.gig.findMany({
    where: { active: true, service: "OTHER", serviceOther: { not: null } },
    select: { id: true, title: true, serviceOther: true, sellerId: true, seller: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const groups = new Map<string, { name: string; packages: number; mentors: Set<string>; examples: { id: string; title: string; sellerId: string; mentor: string }[] }>();
  for (const g of gigs) {
    const name = (g.serviceOther || "").trim();
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, packages: 0, mentors: new Set(), examples: [] });
    const grp = groups.get(key)!;
    grp.packages++;
    grp.mentors.add(g.sellerId);
    if (grp.examples.length < 5) grp.examples.push({ id: g.id, title: g.title, sellerId: g.sellerId, mentor: g.seller.name });
  }

  const services = Array.from(groups.values())
    .map((g) => ({ name: g.name, packages: g.packages, mentors: g.mentors.size, examples: g.examples }))
    .sort((a, b) => b.mentors - a.mentors || b.packages - a.packages);

  return NextResponse.json({ services });
}
