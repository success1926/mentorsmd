import { NextResponse } from "next/server";
import { getSession, sessionUser } from "@/lib/session";
import { mentorProfileView } from "@/lib/mentorProfile";
import { schoolLogosFor } from "@/lib/schoolLogos";

export const dynamic = "force-dynamic";

// A mentor's profile for the phone app: exactly what the website's
// /mentors/[id] page shows (lib/mentorProfile.ts), as JSON:
//   { seller, previewState, offers: { hourly, bundles, packages }, reviews,
//     schoolLogos: { [school name]: logo address } }  (the mentor's schools that have a logo)
// Whether this student has unlocked the mentor's packages is
// /api/mentors/[id]/unlock, as on the website. 404 when the profile isn't
// shown to this viewer.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = sessionUser(await getSession());
  const view = await mentorProfileView(params.id, { id: me.id, role: me.role });
  if (!view) return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  const s: any = view.seller;
  const schoolLogos = await schoolLogosFor([s?.medicalSchool, s?.undergradSchool, ...(s?.clientSchools || [])]);
  return NextResponse.json({ ...view, schoolLogos });
}
