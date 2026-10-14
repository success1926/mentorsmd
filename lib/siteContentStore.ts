import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { isSitePageKey, resolveValues, type PageValues, type SitePageKey } from "@/lib/siteContent";

// Admin -> Website: loading the editable text and photos for the public
// pages (lib/siteContent.ts has the fields and their defaults).
//
//  - Visitors get the published ("live") values, cached for a few minutes
//    and refreshed the moment an admin publishes.
//  - An admin in preview mode (Admin -> Website -> Preview) sees the saved
//    drafts instead, with a bar at the top of the page. Preview mode is
//    Next.js draft mode (a cookie signed by the server) AND a logged-in
//    admin; either one alone shows the live site.
//  - If the database can't be read (or the SiteContent table doesn't exist
//    yet) the built-in defaults are shown, so the site never breaks.

export const SITE_CONTENT_TAG = "site-content";
export const PREVIEW_PAGE_COOKIE = "mmd_site_preview_page";

const liveRows = unstable_cache(
  async () => {
    const rows = await prisma.siteContent.findMany({ select: { key: true, live: true } });
    return Object.fromEntries(rows.map((r) => [r.key, r.live])) as Record<string, unknown>;
  },
  ["site-content-live-v1"],
  { tags: [SITE_CONTENT_TAG], revalidate: 600 },
);

// True only for a logged-in admin who opened Preview from the editor.
export const isSitePreview = cache(async (): Promise<boolean> => {
  try {
    if (!draftMode().isEnabled) return false;
    return !!(await currentAdmin("website"));
  } catch {
    return false;
  }
});

// The page being previewed (for the preview bar's Publish/Discard buttons).
export function previewPageKey(): SitePageKey | null {
  const k = cookies().get(PREVIEW_PAGE_COOKIE)?.value;
  return isSitePageKey(k) ? k : null;
}

const draftRows = cache(async () => {
  const rows = await prisma.siteContent.findMany({ select: { key: true, draft: true, live: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.draft ?? r.live])) as Record<string, unknown>;
});

export async function getSiteContent<K extends SitePageKey>(key: K): Promise<PageValues<K>> {
  try {
    const rows = (await isSitePreview()) ? await draftRows() : await liveRows();
    return resolveValues(key, rows[key]);
  } catch (err) {
    console.error(`Couldn't load the website content for "${key}" (showing the built-in text):`, err);
    return resolveValues(key, null);
  }
}

// After publishing: refresh the cached content and every page that shows it
// (the footer is on all pages).
export function refreshSiteContent() {
  revalidateTag(SITE_CONTENT_TAG);
  revalidatePath("/", "layout");
}
