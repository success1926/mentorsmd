import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { LEGAL_INFO, LEGAL_KINDS, isLegalKind } from "@/lib/legalKinds";
import { DEFAULT_LEGAL_TEXT } from "@/lib/legalDefaults";
import { logAdminAction } from "@/lib/adminLog";

export const dynamic = "force-dynamic";

// Admin -> Legal (#99): every version of each document, and how many
// people accepted each published version.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const [docs, counts] = await Promise.all([
    prisma.legalDocument.findMany({
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.legalAcceptance.groupBy({ by: ["kind", "version"], _count: { _all: true } }),
  ]);
  const accepted = new Map(counts.map((c) => [`${c.kind}:${c.version}`, c._count._all]));
  return NextResponse.json({
    kinds: LEGAL_KINDS.map((kind) => ({
      kind,
      ...LEGAL_INFO[kind],
      versions: docs
        .filter((d) => d.kind === kind)
        .map((d) => ({ ...d, acceptances: d.version ? accepted.get(`${kind}:${d.version}`) || 0 : 0 })),
      builtInAcceptances: accepted.get(`${kind}:0`) || 0,
    })),
  });
}

// Start a new draft of a document, copied from the latest version (or the
// built-in text). One draft per document at a time.
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { kind } = await req.json().catch(() => ({}));
  if (!isLegalKind(kind)) return NextResponse.json({ error: "Unknown document" }, { status: 400 });

  const existing = await prisma.legalDocument.findFirst({ where: { kind, status: "DRAFT" } });
  if (existing) return NextResponse.json({ draft: existing });
  const latest = await prisma.legalDocument.findFirst({ where: { kind, status: "PUBLISHED" }, orderBy: { version: "desc" } });
  const fallback = DEFAULT_LEGAL_TEXT[kind];
  const draft = await prisma.legalDocument.create({
    data: {
      kind,
      title: latest?.title || fallback?.title || LEGAL_INFO[kind].label,
      body: latest?.body || fallback?.body || "",
      changeType: "MAJOR",
      createdById: admin.id,
    },
  });
  await logAdminAction({ adminId: admin.id, action: "LEGAL_DRAFT", summary: `Started a draft of the ${LEGAL_INFO[kind].label}` });
  return NextResponse.json({ draft });
}
