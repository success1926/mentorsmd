import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { EMAILS, validateTemplate } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

// Admin -> Emails -> one email: GET the saved and default wording, PUT to
// save new wording (checked first), DELETE to go back to the default.
export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const def = EMAILS[params.key];
  if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const saved = await prisma.emailTemplate.findUnique({ where: { key: def.key } });
  const editor = saved?.updatedById ? await prisma.user.findUnique({ where: { id: saved.updatedById }, select: { name: true } }) : null;
  // Reminder emails: on or off, and the timing (no row = off, standard timing).
  const sched = def.schedule ? await prisma.emailSchedule.findUnique({ where: { key: def.key } }) : null;
  const schedEditor = sched?.updatedById ? await prisma.user.findUnique({ where: { id: sched.updatedById }, select: { name: true } }) : null;
  return NextResponse.json({
    def,
    saved: saved ? { subject: saved.subject, body: saved.body, updatedAt: saved.updatedAt, updatedBy: editor?.name ?? null } : null,
    schedule: def.schedule
      ? { enabled: !!sched?.enabled, timing: sched?.timing || def.schedule.timing, updatedAt: sched?.updatedAt ?? null, updatedBy: schedEditor?.name ?? null }
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const def = EMAILS[params.key];
  if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = await req.json().catch(() => ({}));
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n?/g, "\n").trim() : "";
  const errors = validateTemplate(def, { subject, body });
  if (errors.length) return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });

  // Saving the default wording is the same as resetting.
  if (subject === def.subject && body === def.body) {
    await prisma.emailTemplate.deleteMany({ where: { key: def.key } });
  } else {
    await prisma.emailTemplate.upsert({
      where: { key: def.key },
      create: { key: def.key, subject, body, updatedById: admin.id },
      update: { subject, body, updatedById: admin.id },
    });
  }
  await logAdminAction({ adminId: admin.id, action: "EMAIL_TEMPLATE_SAVE", summary: `Edited the "${def.name}" email`, details: { key: def.key } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { key: string } }) {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const def = EMAILS[params.key];
  if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.emailTemplate.deleteMany({ where: { key: def.key } });
  await logAdminAction({ adminId: admin.id, action: "EMAIL_TEMPLATE_RESET", summary: `Reset the "${def.name}" email to the default wording`, details: { key: def.key } });
  return NextResponse.json({ ok: true });
}
