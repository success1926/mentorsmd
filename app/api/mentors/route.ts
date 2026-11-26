import { NextResponse } from "next/server";
import { getSession, sessionUser } from "@/lib/session";
import { parseBrowseFilters, searchMentors } from "@/lib/mentorQueries";
import { logBrowseSearch } from "@/lib/searchLog";
import { FILTER_GROUPS, MENTOR_QUICK_LINKS } from "@/lib/options";
import { schoolLogosFor } from "@/lib/schoolLogos";

export const dynamic = "force-dynamic";

// Find a Mentor for the phone app: the same search and filters as the
// website's /mentors page (lib/mentorQueries.ts), as JSON.
//   GET /api/mentors?q=&service=MMI&service=SECONDARIES&format=&price=&stage=&school=&best=&rating=4.5&sort=rated
// (several values: repeat the key, or separate with commas). Answers
//   { mentors: MentorCardData[], filters: [{ key, title, sub, options, multi }], quickLinks: [{ label, qs }],
//     schoolLogos: { [school name]: logo address } }  (every school on these cards that has a logo)
// Open to everyone, like the website page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp: Record<string, string[]> = {};
  url.searchParams.forEach((v, k) => {
    (sp[k] ||= []).push(v);
  });
  const filters = parseBrowseFilters(sp);
  const mentors = await searchMentors(filters);

  const viewer = sessionUser(await getSession().catch(() => null));
  logBrowseSearch(filters, mentors.length, { userId: viewer?.id, role: viewer?.role, userAgent: req.headers.get("user-agent") });

  const schoolLogos = await schoolLogosFor(mentors.flatMap((m: any) => [m.medicalSchool, m.undergradSchool, ...(m.clientSchools || [])]));

  return NextResponse.json({
    schoolLogos,
    mentors: mentors.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    filters: FILTER_GROUPS.map(({ key, title, sub, options, multi }) => ({ key, title, sub, multi, options: options.map((o: any) => ({ value: o.value, label: o.label })) })),
    quickLinks: MENTOR_QUICK_LINKS,
  });
}
