import { NextResponse } from "next/server";
import { packagesFor } from "@/lib/packageViews";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The viewer's hours packages, for My packages and the dashboards.
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = session.user as any;
  return NextResponse.json({ packages: await packagesFor(user.id, user.role) });
}
