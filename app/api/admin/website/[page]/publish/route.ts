import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { SITE_PAGES, isSitePageKey } from "@/lib/siteContent";
import { refreshSiteContent } from "@/lib/siteContentStore";

export const dynamic = "force-dynamic";

// Publish: the saved draft becomes what visitors see.
export async function POST(_req: Request, { params }: { params: { page: string } }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = params.page;
  if (!isSitePageKey(key)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  const row = await prisma.siteContent.findUnique({ where: { key } });
  if (!row || row.draft === null) return NextResponse.json({ ok: true, nothingToPublish: true });
  await prisma.siteContent.update({
    where: { key },
    data: { live: row.draft as Prisma.InputJsonValue, draft: Prisma.DbNull, publishedAt: new Date(), publishedById: admin.id },
  });
  refreshSiteContent();
  await logAdminAction({ adminId: admin.id, action: "WEBSITE_PUBLISH", summary: `Published changes to the ${SITE_PAGES[key].label} page` });
  return NextResponse.json({ ok: true });
}
