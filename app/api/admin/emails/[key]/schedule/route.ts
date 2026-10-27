import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { EMAILS, parseTiming } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

// Admin -> Emails -> a reminder email: switch it on or off and set its
// timing ("After 1 day, then 3 days"). Used by the daily cron
// (lib/scheduledEmails.ts).
export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const def = EMAILS[params.key];
  if (!def?.schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = await req.json().catch(() => ({}));
  const enabled = input.enabled === true;
  const timing = typeof input.timing === "string" ? input.timing.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  const { error } = parseTiming(timing);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const before = await prisma.emailSchedule.findUnique({ where: { key: def.key } });
  await prisma.emailSchedule.upsert({
    where: { key: def.key },
    create: { key: def.key, enabled, timing, updatedById: admin.id },
    update: { enabled, timing, updatedById: admin.id },
  });
  const was = before?.enabled ? "on" : "off";
  const now = enabled ? "on" : "off";
  await logAdminAction({
    adminId: admin.id,
    action: "EMAIL_SCHEDULE_SAVE",
    summary: was !== now ? `Turned the "${def.name}" email ${now} (${timing})` : `Set the "${def.name}" email's timing: ${timing}`,
    details: { key: def.key, enabled, timing },
  });
  return NextResponse.json({ ok: true });
}
