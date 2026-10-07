import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { RESUME_MAX_BYTES, RESUME_TYPES, resumeExtension, HONEYPOT_FIELD } from "@/lib/applicationRules";
import { applicationLimitError, ipHashFor } from "@/lib/applications";

// Resume uploads for the public application form. The browser uploads the
// file straight to Vercel Blob (so a 5MB file isn't blocked by Vercel's
// 4.5MB request limit); this route only hands out a short-lived upload
// permission, and only for a PDF or Word file up to 5MB in "applications/".
// No login is needed (applicants don't have accounts), so the same
// per-IP limit as the form applies here too.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("applications/") || pathname.includes("..")) throw new Error("Invalid file name");
        if (!resumeExtension(pathname)) throw new Error("Your resume must be a PDF or Word file");
        // The honeypot value travels with the upload request too.
        try {
          const payload = clientPayload ? JSON.parse(clientPayload) : {};
          if (payload?.[HONEYPOT_FIELD]) throw new Error("Upload refused");
        } catch (e) {
          if (e instanceof Error && e.message === "Upload refused") throw e;
        }
        const limit = await applicationLimitError(ipHashFor(req));
        if (limit) throw new Error(limit);
        return {
          allowedContentTypes: Object.values(RESUME_TYPES),
          maximumSizeInBytes: RESUME_MAX_BYTES,
          addRandomSuffix: true, // unguessable URL
        };
      },
      // Nothing to do here: the application itself is saved by
      // /api/applications once the form is submitted.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
