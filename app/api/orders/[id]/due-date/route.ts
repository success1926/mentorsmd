import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDate } from "@/lib/validate";

// Seller-only, on purpose: a buyer moving their own deadline out would
// defeat the point of having one. This exists specifically for the case
// where the automatic 7-day extension after a revision request isn't
// enough time - the seller can push it to whatever date they actually need.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.sellerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Only the coach on this order can change the due date" }, { status: 403 });
  }
  if (!["IN_ESCROW", "COMPLETED"].includes(order.status)) {
    return NextResponse.json({ error: "Can't change the due date on a finished order" }, { status: 400 });
  }

  const { dueDate } = await req.json();
  const parsed = parseDate(dueDate);
  if (!parsed) return NextResponse.json({ error: "Pick a valid date between today and one year from now" }, { status: 400 });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { dueDate: parsed },
  });

  return NextResponse.json({ order: updated });
}
