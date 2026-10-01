import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString, parsePriceToCents } from "@/lib/validate";
import { parseGigSearchFields } from "@/lib/gigInput";

// Public: anyone (even logged out) can browse gigs.
//   ?mine=true      (seller session) only that seller's own packages - the dashboard
//   ?sellerId=<id>  only one coach's packages - message thread booking panel
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  let sellerId: string | undefined = searchParams.get("sellerId") || undefined;
  if (mine) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "SELLER") {
      return NextResponse.json({ error: "Only seller accounts can view their own packages" }, { status: 403 });
    }
    sellerId = (session.user as any).id;
  }

  const gigs = await prisma.gig.findMany({
    where: { active: true, ...(sellerId ? { sellerId } : {}) },
    include: { seller: { select: { id: true, name: true, credential: true, photoUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ gigs });
}

// Only a logged-in SELLER can create a gig, and it's always attached to
// their own account - there's no field for "sellerId" in the request body,
// so a buyer can't forge a gig under someone else's name.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only seller accounts can create packages" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, price } = body;
  if (!isNonEmptyString(title, LIMITS.gigTitle) || !isNonEmptyString(description, LIMITS.gigDescription)) {
    return NextResponse.json(
      { error: `Title (max ${LIMITS.gigTitle} chars) and description (max ${LIMITS.gigDescription} chars) are required` },
      { status: 400 }
    );
  }
  const priceCents = parsePriceToCents(price);
  if (priceCents === null) {
    return NextResponse.json({ error: "Price must be between $5 and $10,000" }, { status: 400 });
  }
  // Every package must answer the search questions (service, format,
  // turnaround, and calls if it includes one) - see lib/gigInput.ts.
  const parsed = parseGigSearchFields(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const gig = await prisma.gig.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      price: priceCents,
      ...parsed.data,
      sellerId: (session.user as any).id,
    },
  });

  return NextResponse.json({ gig });
}
