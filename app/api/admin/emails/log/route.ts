import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { csvBody, csvResponse } from "@/lib/csv";
import { EMAILS } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

const PAGE = 100;
const CSV_MAX = 20000;

// Admin -> Email log: every send attempt, newest first (kept 90 days).
//   ?q=<part of an email address> &key=<email type> &status=SENT|FAILED
//   &page=1   or   &format=csv (everything matching, up to 20,000 rows)
export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 200);
  const key = sp.get("key") || "";
  const status = sp.get("status") || "";
  const where: Prisma.EmailLogWhereInput = {
    ...(q ? { toEmail: { contains: q, mode: "insensitive" } } : {}),
    ...(key ? { templateKey: key } : {}),
    ...(status === "SENT" || status === "FAILED" ? { status } : {}),
  };

  if (sp.get("format") === "csv") {
    const rows = await prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, take: CSV_MAX });
    const body = csvBody(
      ["Sent at (UTC)", "Email", "Email key", "To", "Subject", "Status", "Resend id", "Error"],
      rows.map((r) => [r.createdAt, EMAILS[r.templateKey]?.name ?? r.templateKey, r.templateKey, r.toEmail, r.subject, r.status === "SENT" ? "Sent" : "Failed", r.providerId, r.error])
    );
    return csvResponse(`mentorsmd-email-log-${new Date().toISOString().slice(0, 10)}.csv`, body);
  }

  const page = Math.max(1, Math.min(1000, parseInt(sp.get("page") || "1", 10) || 1));
  const [total, rows] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
  ]);
  return NextResponse.json({ total, page, pageSize: PAGE, rows }, { headers: { "Cache-Control": "no-store" } });
}
