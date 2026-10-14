import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOTE_MAX } from "@/lib/leads";
import { leadsAdmin, parseKind } from "@/lib/leadQueries";

// Add an internal note to a lead or mentor application. Notes are only
// seen by the admin team, with who wrote them and when.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; body?: unknown };
  const kind = parseKind(body.kind);
  if (!kind) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const admin = await leadsAdmin(kind);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write a note first." }, { status: 400 });
  if (text.length > NOTE_MAX) return NextResponse.json({ error: `Notes can be at most ${NOTE_MAX.toLocaleString("en-US")} characters.` }, { status: 400 });

  const exists =
    kind === "APPLICATION"
      ? await prisma.mentorApplication.count({ where: { id: params.id } })
      : await prisma.lead.count({ where: { id: params.id, kind } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await prisma.leadNote.create({
    data: { body: text, authorId: admin.id, ...(kind === "APPLICATION" ? { applicationId: params.id } : { leadId: params.id }) },
    select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ note });
}
