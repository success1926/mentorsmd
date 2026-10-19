import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminCan } from "@/lib/adminTeam";
import { ORDER_VIEW_PERMISSIONS } from "@/lib/adminPermissions";
import { fileRedirect } from "@/lib/storage";

// Download the file on an hours-log entry (written work). Only the student
// and mentor on the package, or an admin who can open orders.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const entry = await prisma.hourEntry.findUnique({ where: { id: params.id }, select: { fileUrl: true, fileName: true, order: { select: { buyerId: true, sellerId: true } } } });
  if (!entry?.fileUrl) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const party = entry.order.buyerId === userId || entry.order.sellerId === userId;
  if (!party && !((session.user as any).role === "ADMIN" && (await adminCan(ORDER_VIEW_PERMISSIONS)))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return fileRedirect(entry.fileUrl, entry.fileName);
}
