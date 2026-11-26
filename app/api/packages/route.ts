import { NextResponse } from "next/server";
import { packagesFor } from "@/lib/packageViews";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// The viewer's hours packages, for My packages and the dashboards.
export async function GET() {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const user = me;
  return NextResponse.json({ packages: await packagesFor(user.id, user.role) });
}
