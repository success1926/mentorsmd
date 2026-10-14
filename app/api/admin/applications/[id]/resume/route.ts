import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { fileRedirect } from "@/lib/storage";

// Download a mentor applicant's résumé. Admins with Applications or Leads
// only (résumés are private files; see lib/storage.ts).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await currentAdmin(["applications", "leads"]))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const app = await prisma.mentorApplication.findUnique({ where: { id: params.id }, select: { resumeUrl: true, resumeName: true } });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return fileRedirect(app.resumeUrl, app.resumeName);
}
