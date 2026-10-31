import type { BrowseFilters } from "@/lib/mentorQueries";
import { isBotUserAgent, recordActivity } from "@/lib/activity";
import { runAfterResponse } from "@/lib/request";

// Student demand (#82): every search or filter on Find a Mentor (the
// website's /mentors and the phone app's /api/mentors) goes into the
// private activity log, with how many mentors matched. Sorting alone,
// bots, mentors and admins aren't logged. Written after the response is
// sent, so it never slows the page down.
export function logBrowseSearch(
  f: BrowseFilters,
  resultCount: number,
  who: { userId?: string | null; role?: string | null; visitorId?: string | null; userAgent?: string | null }
) {
  const picked: Record<string, string[]> = {};
  for (const k of ["service", "format", "price", "stage", "school", "best"] as const) {
    if (f[k].length) picked[k] = [...f[k]].sort();
  }
  if (f.rating !== null) picked.rating = [String(f.rating)];
  if (!f.q && Object.keys(picked).length === 0) return;
  if (isBotUserAgent(who.userAgent ?? null)) return;
  if (who.role && who.role !== "BUYER") return;
  // A first-time visitor (or the app) has no visitor id: still logged,
  // just not de-duplicated.
  runAfterResponse(() =>
    recordActivity({ kind: "SEARCH", visitorId: who.visitorId ?? null, userId: who.userId || null, query: f.q ? f.q.toLowerCase() : null, filters: picked, resultCount })
  );
}
