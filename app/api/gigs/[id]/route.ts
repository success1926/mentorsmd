import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOffer } from "@/lib/offerInput";
import { offerPrice } from "@/lib/pricing";
import { bookableGigWhere } from "@/lib/mentor";
import { acceptedAgreement } from "@/lib/agreement";
import { mentorAgreementLabel } from "@/lib/legal";
import { checkText } from "@/lib/moderation";
import { createFlagsForFindings } from "@/lib/flags";

// Public: a single package, used by the checkout page (which previously
// downloaded every gig on the site just to find this one).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gig = await prisma.gig.findFirst({
    where: { id: params.id, ...bookableGigWhere },
    include: { seller: { select: { id: true, name: true, credential: true, photoUrl: true } } },
  });
  if (!gig) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  return NextResponse.json({ gig });
}

// Ownership check pattern: fetch the gig, confirm session.user.id === gig.sellerId,
// only then allow the mutation. This is what stops one coach from editing
// or deleting another coach's packages.
async function assertOwnsGig(gigId: string, userId: string) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig || gig.sellerId !== userId) return null;
  return gig;
}

// Edits an hour bundle or a specialized package. Its price follows from
// the new hours and rate; existing orders keep what they paid.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const gig = await assertOwnsGig(params.id, (session.user as any).id);
  if (!gig || !gig.active) return NextResponse.json({ error: "Package not found or not yours" }, { status: 404 });
  if (gig.kind !== "BUNDLE" && gig.kind !== "SPECIALIZED") {
    return NextResponse.json(
      { error: gig.kind === "HOURLY" ? "Change the Hourly offer on the Rates & packages page" : "Packages from before hourly pricing can't be edited. Remove it and add a new one." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (!acceptedAgreement(body.agreement)) {
    return NextResponse.json({ error: "Please tick the box to accept the mentor agreement before saving" }, { status: 400 });
  }
  const parsed = parseOffer(body, gig.sellerId, gig);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const mentor = await prisma.user.findUnique({ where: { id: gig.sellerId }, select: { hourlyRateCents: true } });
  if (!parsed.data.rateCents && !mentor?.hourlyRateCents) {
    return NextResponse.json({ error: "Set your hourly rate first" }, { status: 400 });
  }
  if (parsed.data.kind === "BUNDLE") {
    const same = await prisma.gig.findFirst({ where: { sellerId: gig.sellerId, kind: "BUNDLE", active: true, minutes: parsed.data.minutes, id: { not: gig.id } } });
    if (same) return NextResponse.json({ error: "You already have a bundle with that many hours" }, { status: 400 });
  }

  const agreementLabel = await mentorAgreementLabel();
  const updated = await prisma.gig.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      price: offerPrice(parsed.data, mentor?.hourlyRateCents) ?? 0,
      agreementVersion: agreementLabel,
      agreementAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: gig.sellerId },
    data: { mentorAgreementVersion: agreementLabel, mentorAgreementAt: new Date() },
  });
  if (updated.kind === "SPECIALIZED" && (updated.title !== gig.title || updated.description !== gig.description)) {
    await createFlagsForFindings(checkText(`${updated.title}\n${updated.description}`).findings, {
      evidence: `${updated.title}\n${updated.description}`,
      subjectUserId: gig.sellerId,
      gigId: gig.id,
      dedupeKey: `gig:${gig.id}:${updated.description.length}`,
    });
  }

  return NextResponse.json({ gig: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const gig = await assertOwnsGig(params.id, (session.user as any).id);
  if (!gig) return NextResponse.json({ error: "Package not found or not yours" }, { status: 404 });

  // The Hourly offer is switched off instead (Rate & offers page).
  if (gig.kind === "HOURLY") return NextResponse.json({ error: "Switch the Hourly offer off instead" }, { status: 400 });
  // Soft delete so past orders still reference a real row.
  await prisma.gig.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
