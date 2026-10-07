import { NextResponse } from "next/server";
import { redeemVerificationToken } from "@/lib/emailVerification";
import { SITE_URL } from "@/lib/email";

// The link in the "Confirm your email" email.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const userId = await redeemVerificationToken(token);
  return NextResponse.redirect(`${SITE_URL}/verify-email?status=${userId ? "ok" : "invalid"}`);
}
