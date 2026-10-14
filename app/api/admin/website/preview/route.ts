import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { currentAdmin } from "@/lib/adminTeam";
import { SITE_PAGES, isSitePageKey } from "@/lib/siteContent";
import { PREVIEW_PAGE_COOKIE } from "@/lib/siteContentStore";

export const dynamic = "force-dynamic";

// Preview: turns on draft mode (a cookie signed by the server) for this
// admin's browser and opens the page showing the saved drafts.
export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = new URL(req.url).searchParams.get("page");
  if (!isSitePageKey(key)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  draftMode().enable();
  const res = NextResponse.redirect(new URL(SITE_PAGES[key].path, req.url));
  res.cookies.set(PREVIEW_PAGE_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return res;
}
