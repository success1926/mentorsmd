import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Public: anyone (even logged out) can browse gigs.
// Pass ?mine=true (with a seller session) to get only that seller's own
// packages - this is what the dashboard uses, so a coach never sees
// (or could accidentally edit) another coach's listings.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  let sellerId: string | undefined;
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

  const { title, description, price, duration, category } = await req.json();
  if (!title || !description || !price) {
    return NextResponse.json({ error: "Title, description, and price are required" }, { status: 400 });
  }

  const gig = await prisma.gig.create({
    data: {
      title,
      description,
      price: Math.round(Number(price) * 100), // dollars -> cents
      duration: duration || "",
      category: category || "OTHER",
      sellerId: (session.user as any).id,
    },
  });

  return NextResponse.json({ gig });
}
