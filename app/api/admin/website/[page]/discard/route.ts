import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { SITE_PAGES, isSitePageKey } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// Discard draft: throw away unpublished changes (the live page is untouched).
export async function POST(_req: Request, { params }: { params: { page: string } }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = params.page;
  if (!isSitePageKey(key)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  const row = await prisma.siteContent.findUnique({ where: { key } });
  if (row && row.draft !== null) {
    await prisma.siteContent.update({ where: { key }, data: { draft: Prisma.DbNull, updatedById: admin.id } });
    await logAdminAction({ adminId: admin.id, action: "WEBSITE_DISCARD", summary: `Discarded unpublished changes to the ${SITE_PAGES[key].label} page` });
  }
  return NextResponse.json({ ok: true });
}
