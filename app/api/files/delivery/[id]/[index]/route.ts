import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCan } from "@/lib/adminTeam";
import { ORDER_VIEW_PERMISSIONS } from "@/lib/adminPermissions";
import { deliveryFiles } from "@/lib/deliveries";
import { fileRedirect } from "@/lib/storage";
import { getSession } from "@/lib/session";

// Download one file from a delivery (by its position in the delivery).
// Only the order's student and mentor, or an admin who can open orders
// (same rule as /api/orders/[id]), get the file.
export async function GET(_req: Request, { params }: { params: { id: string; index: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    select: { files: true, order: { select: { buyerId: true, sellerId: true } } },
  });
  const file = delivery ? deliveryFiles(delivery.files)[Number(params.index)] : undefined;
  if (!delivery || !file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const party = delivery.order.buyerId === userId || delivery.order.sellerId === userId;
  if (!party && !((session.user as any).role === "ADMIN" && (await adminCan(ORDER_VIEW_PERMISSIONS)))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return fileRedirect(file.url, file.name);
}
