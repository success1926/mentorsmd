import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSiteContent } from "@/lib/siteContentStore";

// The wording of the mentor Offer Guide pop-up (components/OfferGuide.tsx),
// as published in Admin -> Website -> Offer guide.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const role = (session?.user as any)?.role;
  if (role !== "SELLER" && role !== "ADMIN") return NextResponse.json({ error: "For mentor accounts" }, { status: 403 });
  return NextResponse.json({ guide: await getSiteContent("mentorGuide") });
}
