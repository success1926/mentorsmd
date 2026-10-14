import { NextResponse } from "next/server";
import { RESUME_MAX_BYTES, resumeExtension, HONEYPOT_FIELD } from "@/lib/applicationRules";
import { applicationLimitError, ipHashFor } from "@/lib/applications";
import { PRIVATE_BUCKET, newPath, safeFileName, uploadLinkResponse } from "@/lib/storage";

// Resume uploads for the public application form. The browser uploads the
// file straight to private storage (so a 5MB file isn't blocked by
// Vercel's 4.5MB request limit); this route only hands out a one-time
// upload link, and only for a PDF or Word file up to 5MB in "applications/".
// /api/applications checks the real size again once the form is sent.
// No login is needed (applicants don't have accounts), so the same
// per-IP limit as the form applies here too.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  // The honeypot value travels with the upload request too.
  if (body[HONEYPOT_FIELD]) return NextResponse.json({ error: "Upload refused" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name : "";
  const size = Number(body.size);
  if (!resumeExtension(name)) return NextResponse.json({ error: "Your resume must be a PDF or Word file" }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > RESUME_MAX_BYTES) {
    return NextResponse.json({ error: "Your resume must be 5MB or smaller." }, { status: 400 });
  }

  const limit = await applicationLimitError(ipHashFor(req));
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  return uploadLinkResponse(PRIVATE_BUCKET, newPath("applications", safeFileName(name, "resume.pdf")));
}
