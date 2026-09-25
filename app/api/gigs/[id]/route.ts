import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GIG_CATEGORIES, LIMITS, isNonEmptyString, parsePriceToCents } from "@/lib/validate";

// Public: a single package, used by the checkout page (which previously
// downloaded every gig on the site just to find this one).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gig = await prisma.gig.findFirst({
    where: { id: params.id, active: true },
    include: { seller: { select: { id: true, name: true, credential: true, photoUrl: true } } },
  });
  if (!gig) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  return NextResponse.json({ gig });
}

// Ownership check pattern: fetch the gig, confirm session.user.id === gig.sellerId,
// only then allow the mutation. This is what stops one coach from editing
// or deleting another coach's packages.
async function assertOwnsGig(gigId: string, userId: string) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig || gig.sellerId !== userId) return null;
  return gig;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const gig = await assertOwnsGig(params.id, (session.user as any).id);
  if (!gig) return NextResponse.json({ error: "Package not found or not yours" }, { status: 404 });

  const body = await req.json();

  if (body.title !== undefined && !isNonEmptyString(body.title, LIMITS.gigTitle)) {
    return NextResponse.json({ error: `Title is required (max ${LIMITS.gigTitle} chars)` }, { status: 400 });
  }
  if (body.description !== undefined && !isNonEmptyString(body.description, LIMITS.gigDescription)) {
    return NextResponse.json({ error: `Description is required (max ${LIMITS.gigDescription} chars)` }, { status: 400 });
  }
  if (body.duration !== undefined && (typeof body.duration !== "string" || body.duration.length > LIMITS.gigDuration)) {
    return NextResponse.json({ error: "Turnaround text is too long" }, { status: 400 });
  }
  if (body.category !== undefined && !GIG_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  let price = gig.price;
  if (body.price !== undefined) {
    const cents = parsePriceToCents(body.price);
    if (cents === null) return NextResponse.json({ error: "Price must be between $5 and $10,000" }, { status: 400 });
    price = cents;
  }

  // Note: changing the price never affects existing orders - each order
  // stores its own snapshot of the amount at checkout.
  const updated = await prisma.gig.update({
    where: { id: params.id },
    data: {
      title: body.title?.trim() ?? gig.title,
      description: body.description?.trim() ?? gig.description,
      duration: body.duration ?? gig.duration,
      category: body.category ?? gig.category,
      price,
    },
  });

  return NextResponse.json({ gig: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const gig = await assertOwnsGig(params.id, (session.user as any).id);
  if (!gig) return NextResponse.json({ error: "Package not found or not yours" }, { status: 404 });

  // Soft delete so past orders still reference a real row.
  await prisma.gig.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
