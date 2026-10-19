import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { packagesFor } from "@/lib/packageViews";

export const dynamic = "force-dynamic";

// The viewer's hours packages, for My packages and the dashboards.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = session.user as any;
  return NextResponse.json({ packages: await packagesFor(user.id, user.role) });
}
