import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWaitlistRemoveSig } from "@/lib/leads";

// Public: the "Remove me from the waitlist" link in the waitlist email
// (the /waitlist/remove page calls this when they press the button).
// The link is signed, so only the person who got the email can use it.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; sig?: unknown } | null;
  if (!body || !checkWaitlistRemoveSig(body.id, body.sig)) {
    return NextResponse.json({ error: "This link isn't valid. Copy the whole link from the email and try again." }, { status: 400 });
  }
  // Already removed counts as done.
  await prisma.lead.deleteMany({ where: { id: body.id as string, kind: "WAITLIST" } });
  return NextResponse.json({ ok: true });
}
