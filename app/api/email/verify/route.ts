import { NextResponse } from "next/server";
import { redeemVerificationToken } from "@/lib/emailVerification";
import { SITE_URL } from "@/lib/email";
import { continuePage } from "@/lib/continuePage";

export const dynamic = "force-dynamic";

// The link in the "Confirm your email" email. Opening it only shows a
// "Confirm my email" button (lib/continuePage.ts), so a link preview or
// email scanner can't use the link up; pressing the button confirms.
export async function GET() {
  return continuePage({
    title: "Confirm your email",
    text: "Press the button to confirm this email address for your MentorsMD account.",
    button: "Confirm my email",
  });
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const userId = await redeemVerificationToken(token);
  // 303 so the browser follows with a normal GET.
  return NextResponse.redirect(`${SITE_URL}/verify-email?status=${userId ? "ok" : "invalid"}`, 303);
}
