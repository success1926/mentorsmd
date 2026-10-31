import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseBrowseFilters, searchMentors } from "@/lib/mentorQueries";
import { logBrowseSearch } from "@/lib/searchLog";
import { FILTER_GROUPS, MENTOR_QUICK_LINKS } from "@/lib/options";

export const dynamic = "force-dynamic";

// Find a Mentor for the phone app: the same search and filters as the
// website's /mentors page (lib/mentorQueries.ts), as JSON.
//   GET /api/mentors?q=&service=MMI&service=SECONDARIES&format=&price=&stage=&school=&best=&rating=4.5&sort=rated
// (several values: repeat the key, or separate with commas). Answers
//   { mentors: MentorCardData[], filters: [{ key, title, sub, options, multi }], quickLinks: [{ label, qs }] }
// Open to everyone, like the website page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp: Record<string, string[]> = {};
  url.searchParams.forEach((v, k) => {
    (sp[k] ||= []).push(v);
  });
  const filters = parseBrowseFilters(sp);
  const mentors = await searchMentors(filters);

  const session = await getSession().catch(() => null);
  logBrowseSearch(filters, mentors.length, { userId: (session?.user as any)?.id, role: (session?.user as any)?.role, userAgent: req.headers.get("user-agent") });

  return NextResponse.json({
    mentors: mentors.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    filters: FILTER_GROUPS.map(({ key, title, sub, options, multi }) => ({ key, title, sub, multi, options: options.map((o: any) => ({ value: o.value, label: o.label })) })),
    quickLinks: MENTOR_QUICK_LINKS,
  });
}
