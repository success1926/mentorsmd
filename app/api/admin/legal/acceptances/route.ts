import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { isLegalKind } from "@/lib/legalKinds";

export const dynamic = "force-dynamic";

// Acceptance records (#102): who accepted which version, when, from which
// IP and browser. ?kind=TERMS ?q=email-or-name ?format=csv ?before=<ISO>
export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const csv = sp.get("format") === "csv";
  const before = sp.get("before") ? new Date(sp.get("before")!) : null;

  const where: Prisma.LegalAcceptanceWhereInput = {
    ...(isLegalKind(kind) ? { kind } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }, { signerName: { contains: q, mode: "insensitive" } }] } : {}),
    ...(before && !isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
  };
  const take = csv ? 50_000 : 100;
  const rows = await prisma.legalAcceptance.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  if (!csv) return NextResponse.json({ rows, hasMore: rows.length === take });

  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Stop spreadsheet apps treating a value as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Accepted at (UTC)", "Document", "Version", "How", "Account name", "Account type", "Email", "Signed by", "IP address", "Browser", "Account id"];
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.kind,
      r.version === 0 ? "0 (built-in text)" : r.version,
      r.context,
      r.user?.name ?? "",
      r.user?.role === "SELLER" ? "mentor" : r.user?.role === "BUYER" ? "student" : r.user?.role ?? "",
      r.email,
      r.signerName ?? "",
      r.ip ?? "",
      r.userAgent ?? "",
      r.userId ?? "",
    ]
      .map(cell)
      .join(",")
  );
  const body = [header.map(cell).join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mentorsmd-acceptances-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
