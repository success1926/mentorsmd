import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const updated = await prisma.gig.update({
    where: { id: params.id },
    data: {
      title: body.title ?? gig.title,
      description: body.description ?? gig.description,
      duration: body.duration ?? gig.duration,
      category: body.category ?? gig.category,
      price: body.price !== undefined ? Math.round(Number(body.price) * 100) : gig.price,
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
