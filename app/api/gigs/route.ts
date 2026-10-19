import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_BUNDLES, MAX_SPECIALIZED } from "@/lib/options";
import { parseOffer } from "@/lib/offerInput";
import { offerPrice } from "@/lib/pricing";
import { bookableGigWhere } from "@/lib/mentor";
import { acceptedAgreement } from "@/lib/agreement";
import { mentorAgreementLabel } from "@/lib/legal";
import { checkText } from "@/lib/moderation";
import { createFlagsForFindings } from "@/lib/flags";

// Public: anyone (even logged out) can browse gigs.
//   ?mine=true      (mentor session) the mentor's own offers, including the
//                   Hourly offer while it's switched off
//   ?sellerId=<id>  one mentor's bookable offers - message thread booking panel
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  let sellerId: string | undefined = searchParams.get("sellerId") || undefined;
  if (mine) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "SELLER") {
      return NextResponse.json({ error: "Only mentor accounts have packages" }, { status: 403 });
    }
    sellerId = (session.user as any).id;
  }

  const gigs = await prisma.gig.findMany({
    where: mine ? { sellerId, OR: [{ active: true }, { kind: "HOURLY" }] } : { ...bookableGigWhere, ...(sellerId ? { sellerId } : {}) },
    include: { seller: { select: { id: true, name: true, credential: true, photoUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ gigs });
}

// Only a logged-in SELLER can create an offer, and it's always attached to
// their own account - there's no field for "sellerId" in the request body,
// so a student can't forge one under someone else's name.
// Since the Oct 2026 redesign this creates an hour BUNDLE or a SPECIALIZED
// package (lib/offerInput.ts); its price is hours x rate. The Hourly offer
// itself is switched on/off on /api/offers.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentor accounts can create packages" }, { status: 403 });
  }
  const sellerId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  if (!acceptedAgreement(body.agreement)) {
    return NextResponse.json({ error: "Please tick the box to accept the mentor agreement before publishing" }, { status: 400 });
  }
  const parsed = parseOffer(body, sellerId);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const mentor = await prisma.user.findUnique({ where: { id: sellerId }, select: { hourlyRateCents: true } });
  if (!parsed.data.rateCents && !mentor?.hourlyRateCents) {
    return NextResponse.json({ error: "Set your hourly rate first" }, { status: 400 });
  }
  const count = await prisma.gig.count({ where: { sellerId, kind: parsed.data.kind, active: true } });
  const max = parsed.data.kind === "BUNDLE" ? MAX_BUNDLES : MAX_SPECIALIZED;
  if (count >= max) {
    return NextResponse.json({ error: `You can have up to ${max} ${parsed.data.kind === "BUNDLE" ? "hour bundles" : "specialized packages"}` }, { status: 400 });
  }
  if (parsed.data.kind === "BUNDLE") {
    const same = await prisma.gig.findFirst({ where: { sellerId, kind: "BUNDLE", active: true, minutes: parsed.data.minutes } });
    if (same) return NextResponse.json({ error: "You already have a bundle with that many hours" }, { status: 400 });
  }

  const agreementLabel = await mentorAgreementLabel();
  const gig = await prisma.gig.create({
    data: {
      ...parsed.data,
      price: offerPrice(parsed.data, mentor?.hourlyRateCents) ?? 0,
      sortOrder: count,
      sellerId,
      agreementVersion: agreementLabel,
      agreementAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: sellerId },
    data: { mentorAgreementVersion: agreementLabel, mentorAgreementAt: new Date() },
  });
  // Contact details or "pay me outside" in a package: flagged for review.
  if (gig.kind === "SPECIALIZED") {
    await createFlagsForFindings(checkText(`${gig.title}\n${gig.description}`).findings, {
      evidence: `${gig.title}\n${gig.description}`,
      subjectUserId: gig.sellerId,
      gigId: gig.id,
    });
  }

  return NextResponse.json({ gig });
}
