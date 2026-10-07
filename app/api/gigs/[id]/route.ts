import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString, parsePriceToCents } from "@/lib/validate";
import { GIG_DESCRIPTION_MIN_WORDS, PRICE_RULE, countWords } from "@/lib/options";
import { parseGigSearchFields } from "@/lib/gigInput";
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const gig = await assertOwnsGig(params.id, (session.user as any).id);
  if (!gig) return NextResponse.json({ error: "Package not found or not yours" }, { status: 404 });

  const body = await req.json();
  if (!acceptedAgreement(body.agreement)) {
    return NextResponse.json({ error: "Please tick the box to accept the mentor agreement before saving" }, { status: 400 });
  }
  const agreementLabel = await mentorAgreementLabel();

  if (body.title !== undefined && !isNonEmptyString(body.title, LIMITS.gigTitle)) {
    return NextResponse.json({ error: `Title is required (max ${LIMITS.gigTitle} chars)` }, { status: 400 });
  }
  if (body.description !== undefined && !isNonEmptyString(body.description, LIMITS.gigDescription)) {
    return NextResponse.json({ error: `Description is required (max ${LIMITS.gigDescription} chars)` }, { status: 400 });
  }
  if (body.description !== undefined && countWords(body.description) < GIG_DESCRIPTION_MIN_WORDS) {
    return NextResponse.json({ error: `Describe the package in at least ${GIG_DESCRIPTION_MIN_WORDS} words` }, { status: 400 });
  }
  // Search answers are validated as a whole (e.g. switching the format to
  // "Written feedback" drops the call fields).
  const touchesSearch = ["service", "serviceOther", "format", "turnaround", "callsIncluded", "callLength"].some(
    (k) => body[k] !== undefined
  );
  let searchData = {};
  if (touchesSearch) {
    const parsed = parseGigSearchFields(body, gig);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    searchData = parsed.data;
  }
  let price = gig.price;
  if (body.price !== undefined) {
    const cents = parsePriceToCents(body.price);
    if (cents === null) return NextResponse.json({ error: PRICE_RULE }, { status: 400 });
    price = cents;
  }

  // Note: changing the price or turnaround never affects existing orders -
  // each order stores its own amount and turnaround at checkout.
  const updated = await prisma.gig.update({
    where: { id: params.id },
    data: {
      title: body.title?.trim() ?? gig.title,
      description: body.description?.trim() ?? gig.description,
      price,
      ...searchData,
      agreementVersion: agreementLabel,
      agreementAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: gig.sellerId },
    data: { mentorAgreementVersion: agreementLabel, mentorAgreementAt: new Date() },
  });
  if (body.title !== undefined || body.description !== undefined) {
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

  // Soft delete so past orders still reference a real row.
  await prisma.gig.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
