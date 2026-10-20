import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";

export const dynamic = "force-dynamic";

// For the public site's Edit buttons (components/website/SiteEditButtons.tsx):
// does this browser belong to an admin (2-step done) whose role includes
// Website? Says nothing else about the account.
export async function GET() {
  const admin = await currentAdmin("website").catch(() => null);
  return NextResponse.json({ website: !!admin }, { headers: { "Cache-Control": "private, no-store" } });
}
