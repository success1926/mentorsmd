import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { sendWaitlistMentorsAvailableEmail, SITE_URL } from "@/lib/email";
import { waitlistRemoveSig } from "@/lib/leads";
import { leadsAdmin } from "@/lib/leadQueries";

export const maxDuration = 60;

// Admin -> Leads -> Waitlist -> "Email everyone on the waitlist".
//
// GET: how many signups haven't had the email yet (for the confirm step).
// POST: sends the next small batch and returns how many are left. The
// admin page keeps calling it until none are left, so no single request
// runs long, and stopping halfway (closing the tab) is safe: the rest
// simply haven't been emailed yet and the button picks them up next time.
//
// Each signup is claimed (notifiedAt set) before its email goes out, so
// two admins pressing the button at once never email anyone twice. If a
// send fails, the claim is undone so they can be tried again later.
// Emails go out about 2 a second, inside Resend's default rate limit.
const BATCH = 8;
const GAP_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function remaining() {
  return prisma.lead.count({ where: { kind: "WAITLIST", notifiedAt: null } });
}

export async function GET() {
  const admin = await leadsAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ remaining: await remaining() });
}

export async function POST(req: Request) {
  const admin = await leadsAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { after?: unknown };
  // Within one run, the page passes the last id it handled, so a signup
  // whose email failed isn't retried over and over in the same run.
  const after = typeof body.after === "string" && body.after ? body.after : undefined;

  const batch = await prisma.lead.findMany({
    where: { kind: "WAITLIST", notifiedAt: null, ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: "asc" },
    take: BATCH,
    select: { id: true, email: true },
  });

  let sent = 0;
  let failed = 0;
  for (const [i, lead] of batch.entries()) {
    const claim = await prisma.lead.updateMany({ where: { id: lead.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (claim.count === 0) continue; // someone else's run got it
    if (i > 0) await sleep(GAP_MS);
    const removeUrl = `${SITE_URL}/waitlist/remove?id=${encodeURIComponent(lead.id)}&sig=${waitlistRemoveSig(lead.id)}`;
    try {
      await sendWaitlistMentorsAvailableEmail(lead.email, removeUrl);
      sent++;
    } catch (err) {
      console.error("Waitlist email failed:", err);
      failed++;
      await prisma.lead.updateMany({ where: { id: lead.id }, data: { notifiedAt: null } }).catch(() => {});
    }
  }

  if (sent || failed) {
    await logAdminAction({
      adminId: admin.id,
      action: "WAITLIST_EMAILED",
      summary: `Emailed ${sent} waitlist signup${sent === 1 ? "" : "s"} that mentors are available${failed ? ` (${failed} failed)` : ""}`,
      targetType: "LEAD",
    });
  }
  const last = batch[batch.length - 1]?.id ?? after ?? null;
  const more = batch.length === BATCH;
  return NextResponse.json({ sent, failed, last, done: !more, remaining: await remaining() });
}
