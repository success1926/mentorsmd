import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FORMATS, RATE_RULE, isValue } from "@/lib/options";
import { parseRateDollars } from "@/lib/pricing";
import { ensureHourlyOffer, offersFor, syncOfferPrices } from "@/lib/offers";
import { syncProfileComplete } from "@/lib/profileSync";

// The mentor's "Rate & offers" page (docs/redesign-2026-10.md section 3).
//   GET                                    hourly rate + every offer
//   PATCH { rate }                         set the hourly rate (whole dollars, at least $50)
//   PATCH { hourly: { active, format } }   switch the Hourly offer on/off, and what it's for
// Bundles and specialized packages are saved through /api/gigs. Changing a
// rate re-prices the offers that use it; existing orders keep what they paid.
async function mentorId() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") return null;
  return (session.user as any).id as string;
}

async function payload(id: string) {
  const [user, offers] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { hourlyRateCents: true } }),
    offersFor(id),
  ]);
  return { hourlyRateCents: user?.hourlyRateCents ?? null, ...offers };
}

export async function GET() {
  const id = await mentorId();
  if (!id) return NextResponse.json({ error: "Only mentor accounts have offers" }, { status: 403 });
  return NextResponse.json(await payload(id));
}

export async function PATCH(req: Request) {
  const id = await mentorId();
  if (!id) return NextResponse.json({ error: "Only mentor accounts have offers" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.rate !== undefined) {
    const cents = parseRateDollars(body.rate);
    if (cents === null) return NextResponse.json({ error: RATE_RULE }, { status: 400 });
    await prisma.user.update({ where: { id }, data: { hourlyRateCents: cents } });
  }

  if (body.hourly !== undefined) {
    const h = body.hourly || {};
    if (h.active !== undefined && typeof h.active !== "boolean") return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
    if (h.format !== undefined && !isValue(FORMATS, h.format)) return NextResponse.json({ error: "Choose calls, written or both" }, { status: 400 });
    const hourly = await ensureHourlyOffer(id);
    await prisma.gig.update({
      where: { id: hourly.id },
      data: { ...(h.active !== undefined ? { active: h.active } : {}), ...(h.format !== undefined ? { format: h.format } : {}) },
    });
  } else if (body.rate !== undefined) {
    // The first rate also creates the Hourly offer (switched on).
    await ensureHourlyOffer(id);
  }

  await syncOfferPrices(id);
  await syncProfileComplete(id);
  return NextResponse.json(await payload(id));
}
