import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/email";
import { normalizeCalLink } from "@/lib/calls";

// Mentor-only: connect Cal.com. Two parts:
//   1. calLink - the booking page students are sent to ("Book a call")
//   2. a webhook (URL + signing secret) the mentor pastes into Cal.com, so
//      bookings show up on the order automatically.
async function requireSeller() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") return null;
  return (session.user as any).id as string;
}

function view(u: { id: string; calLink: string | null; calWebhookSecret: string | null }) {
  return {
    calLink: u.calLink,
    webhookUrl: `${SITE_URL}/api/webhooks/cal?mentor=${u.id}`,
    webhookSecret: u.calWebhookSecret,
  };
}

export async function GET() {
  const userId = await requireSeller();
  if (!userId) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, calLink: true, calWebhookSecret: true } });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view(u));
}

// Body: { calLink: string | null } to save/disconnect the link,
// or { newSecret: true } to create/replace the webhook secret.
export async function POST(req: Request) {
  const userId = await requireSeller();
  if (!userId) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const data: { calLink?: string | null; calWebhookSecret?: string } = {};
  if (body.calLink !== undefined) {
    if (body.calLink === null || body.calLink === "") {
      data.calLink = null;
    } else {
      const link = normalizeCalLink(body.calLink);
      if (!link) {
        return NextResponse.json({ error: "Enter your Cal.com link, like https://cal.com/your-name/30min" }, { status: 400 });
      }
      data.calLink = link;
    }
  }
  if (body.newSecret === true) data.calWebhookSecret = crypto.randomBytes(24).toString("hex");

  const u = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, calLink: true, calWebhookSecret: true },
  });
  return NextResponse.json(view(u));
}
