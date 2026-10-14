import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { sendToSentry, sentryEnabled } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Owner only (Admin -> Team & roles): sends one test event to Sentry, so
// you can check error reports arrive. Says whether Sentry is switched on.
export async function POST() {
  const admin = await currentAdmin("team");
  if (!admin || admin.adminRole !== "OWNER") {
    return NextResponse.json({ error: "Only Owners can send a test error" }, { status: 403 });
  }
  const enabled = sentryEnabled();
  if (enabled) {
    await sendToSentry("error", "Test error from Admin -> Team & roles (safe to ignore)", new Error("MentorsMD Sentry test"), undefined, { test: "true" });
  }
  await logAdminAction({ adminId: admin.id, action: "SENTRY_TEST", summary: enabled ? "Sent a Sentry test error" : "Tried a Sentry test error (Sentry is off)" });
  return NextResponse.json({ ok: true, enabled });
}
