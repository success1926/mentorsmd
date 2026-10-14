import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { SITE_PAGES, SITE_PAGE_KEYS } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// Admin -> Website: the editable pages and which have unpublished changes.
export async function GET() {
  const admin = await currentAdmin("website");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  let rows: { key: string; draft: unknown; updatedAt: Date; publishedAt: Date | null }[] = [];
  let setupNeeded = false;
  try {
    rows = await prisma.siteContent.findMany({ select: { key: true, draft: true, updatedAt: true, publishedAt: true } });
  } catch (err) {
    console.error("Couldn't read SiteContent:", err);
    setupNeeded = true;
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return NextResponse.json({
    setupNeeded,
    pages: SITE_PAGE_KEYS.map((key) => {
      const r = byKey.get(key);
      return {
        key,
        label: SITE_PAGES[key].label,
        path: SITE_PAGES[key].path,
        hasDraft: r ? r.draft !== null : false,
        updatedAt: r?.updatedAt ?? null,
        publishedAt: r?.publishedAt ?? null,
      };
    }),
  });
}
