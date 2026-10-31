import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { mentorProfileView } from "@/lib/mentorProfile";

export const dynamic = "force-dynamic";

// A mentor's profile for the phone app: exactly what the website's
// /mentors/[id] page shows (lib/mentorProfile.ts), as JSON:
//   { seller, previewState, offers: { hourly, bundles, packages }, reviews }
// Whether this student has unlocked the mentor's packages is
// /api/mentors/[id]/unlock, as on the website. 404 when the profile isn't
// shown to this viewer.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const view = await mentorProfileView(params.id, { id: (session?.user as any)?.id, role: (session?.user as any)?.role });
  if (!view) return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  return NextResponse.json(view);
}
