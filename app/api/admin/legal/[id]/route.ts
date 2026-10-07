import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { LEGAL_INFO, isLegalKind } from "@/lib/legalKinds";
import { clearLegalCache } from "@/lib/legal";
import { logAdminAction } from "@/lib/adminLog";

const MAX_BODY = 100_000;

// Edit or publish a draft:
//   { title, body, changeType: "MAJOR" | "MINOR", changeNote }   save the draft
//   { ..., action: "publish" }                                    save and publish
// Published versions never change; publish a new version instead.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const doc = await prisma.legalDocument.findUnique({ where: { id: params.id } });
  if (!doc || !isLegalKind(doc.kind)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "DRAFT") return NextResponse.json({ error: "Published versions can't be changed. Start a new draft instead." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: { title?: string; body?: string; changeType?: string; changeNote?: string | null } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200) return NextResponse.json({ error: "Give the document a title" }, { status: 400 });
    data.title = body.title.trim();
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string" || body.body.length > MAX_BODY) return NextResponse.json({ error: "The text is too long" }, { status: 400 });
    data.body = body.body;
  }
  if (body.changeType !== undefined) {
    if (body.changeType !== "MAJOR" && body.changeType !== "MINOR") return NextResponse.json({ error: "Pick minor change or must re-accept" }, { status: 400 });
    data.changeType = body.changeType;
  }
  if (body.changeNote !== undefined) {
    if (body.changeNote !== null && (typeof body.changeNote !== "string" || body.changeNote.length > 2000)) return NextResponse.json({ error: "The change note is too long" }, { status: 400 });
    data.changeNote = body.changeNote?.trim() || null;
  }
  const saved = await prisma.legalDocument.update({ where: { id: doc.id }, data });

  if (body.action !== "publish") return NextResponse.json({ doc: saved });

  if (!saved.body.trim() || saved.body.trim().length < 50) return NextResponse.json({ error: "Add the document's text before publishing" }, { status: 400 });
  const label = LEGAL_INFO[doc.kind].label;
  try {
    const published = await prisma.$transaction(async (tx) => {
      const max = await tx.legalDocument.aggregate({ where: { kind: doc.kind, status: "PUBLISHED" }, _max: { version: true } });
      const version = (max._max.version || 0) + 1;
      return tx.legalDocument.update({
        where: { id: doc.id },
        data: {
          status: "PUBLISHED",
          version,
          // Version 1 always switches the requirement on (#103).
          changeType: version === 1 ? "MAJOR" : saved.changeType,
          publishedAt: new Date(),
          publishedById: admin.id,
        },
      });
    });
    clearLegalCache();
    const mustAccept = published.changeType === "MAJOR";
    await logAdminAction({
      adminId: admin.id,
      action: "LEGAL_PUBLISH",
      summary: `Published ${label} version ${published.version} (${mustAccept ? "everyone must accept it" : "minor change"})`,
      details: { kind: doc.kind, version: published.version, changeType: published.changeType, changeNote: published.changeNote || undefined },
    });
    return NextResponse.json({ doc: published });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Someone published a version at the same moment. Refresh and try again." }, { status: 409 });
    throw err;
  }
}

// Delete a draft (published versions are kept forever).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const doc = await prisma.legalDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "DRAFT") return NextResponse.json({ error: "Published versions are kept on record and can't be deleted." }, { status: 400 });
  await prisma.legalDocument.delete({ where: { id: doc.id } });
  return NextResponse.json({ ok: true });
}
