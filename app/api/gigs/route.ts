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

// Public: anyone (even logged out) can browse gigs.
//   ?mine=true      (mentor session) the mentor's own packages, including
//                   ones hidden because their price is out of range
//   ?sellerId=<id>  one mentor's bookable packages - message thread booking panel
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
    where: mine ? { active: true, sellerId } : { ...bookableGigWhere, ...(sellerId ? { sellerId } : {}) },
    include: { seller: { select: { id: true, name: true, credential: true, photoUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ gigs });
}

// Only a logged-in SELLER can create a gig, and it's always attached to
// their own account - there's no field for "sellerId" in the request body,
// so a buyer can't forge a gig under someone else's name.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentor accounts can create packages" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, price } = body;
  if (!isNonEmptyString(title, LIMITS.gigTitle) || !isNonEmptyString(description, LIMITS.gigDescription)) {
    return NextResponse.json(
      { error: `Title (max ${LIMITS.gigTitle} chars) and description (max ${LIMITS.gigDescription} chars) are required` },
      { status: 400 }
    );
  }
  if (countWords(description) < GIG_DESCRIPTION_MIN_WORDS) {
    return NextResponse.json({ error: `Describe the package in at least ${GIG_DESCRIPTION_MIN_WORDS} words` }, { status: 400 });
  }
  if (!acceptedAgreement(body.agreement)) {
    return NextResponse.json({ error: "Please tick the box to accept the mentor agreement before publishing" }, { status: 400 });
  }
  const agreementLabel = await mentorAgreementLabel();
  const priceCents = parsePriceToCents(price);
  if (priceCents === null) {
    return NextResponse.json({ error: PRICE_RULE }, { status: 400 });
  }
  // Every package must answer the search questions (service, format,
  // turnaround, and calls if it includes one) - see lib/gigInput.ts.
  const parsed = parseGigSearchFields(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const gig = await prisma.gig.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      price: priceCents,
      ...parsed.data,
      sellerId: (session.user as any).id,
      agreementVersion: agreementLabel,
      agreementAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { mentorAgreementVersion: agreementLabel, mentorAgreementAt: new Date() },
  });
  // Contact details or "pay me outside" in a package: flagged for review.
  await createFlagsForFindings(checkText(`${gig.title}\n${gig.description}`).findings, {
    evidence: `${gig.title}\n${gig.description}`,
    subjectUserId: gig.sellerId,
    gigId: gig.id,
  });

  return NextResponse.json({ gig });
}
