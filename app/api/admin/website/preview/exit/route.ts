import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { PREVIEW_PAGE_COOKIE } from "@/lib/siteContentStore";

export const dynamic = "force-dynamic";

// Exit preview: back to the live site (anyone may turn preview off).
export async function GET(req: Request) {
  draftMode().disable();
  const to = new URL(req.url).searchParams.get("to") || "/";
  const safe = to.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : "/";
  const res = NextResponse.redirect(new URL(safe, req.url));
  res.cookies.delete(PREVIEW_PAGE_COOKIE);
  return res;
}
