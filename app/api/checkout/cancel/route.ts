import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelFromStripePage } from "@/lib/hourCheckout";
import { siteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

// Stripe's "back" link for hours checkouts (?orderId= or ?topUpId=): closes
// that Stripe page, cancels the unpaid order / top-up and gives the
// MentorsMD credit back (lib/hourCheckout.ts), then returns the student to
// the profile or package page. Only for the student's own checkout; if it
// was paid after all, nothing changes.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getServerSession(authOptions);
  const studentId = (session?.user as any)?.id;
  let back = "/orders";
  if (studentId) {
    back = await cancelFromStripePage(studentId, {
      orderId: url.searchParams.get("orderId") || undefined,
      topUpId: url.searchParams.get("topUpId") || undefined,
    }).catch((err) => {
      console.error("Cancelling a checkout failed", err);
      return "/orders";
    });
  }
  return NextResponse.redirect(`${siteUrl()}${back}`);
}
