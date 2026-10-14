import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { EMAIL_LIST } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

// Admin -> Emails: every automatic email, and whether it's been edited.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const saved = await prisma.emailTemplate.findMany({ select: { key: true, updatedAt: true, updatedById: true } });
  const byKey = new Map(saved.map((s) => [s.key, s]));
  const editors = await prisma.user.findMany({
    where: { id: { in: saved.map((s) => s.updatedById).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(editors.map((u) => [u.id, u.name]));
  return NextResponse.json({
    emails: EMAIL_LIST.map((d) => {
      const s = byKey.get(d.key);
      return {
        key: d.key,
        name: d.name,
        description: d.description,
        group: d.group,
        locked: !!d.required?.length,
        edited: !!s,
        updatedAt: s?.updatedAt ?? null,
        updatedBy: s?.updatedById ? nameOf.get(s.updatedById) ?? null : null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
