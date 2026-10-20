import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMentorListed, isMentorVisible } from "@/lib/mentor";
import { offersFor } from "@/lib/offers";
import { offerPrice, offerMinutes, offerRate } from "@/lib/pricing";
import { languagesOf, rolesOf } from "@/lib/profileCompleteness";
import { ProfileClient, type PublicOffer } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function MentorProfilePage({ params }: { params: { id: string } }) {
  // Everything returned here is sent to the browser (ProfileClient is a
  // client component). Public fields only - never email, passwordHash,
  // stripeAccountId, calendar addresses or lockout counters.
  const seller = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      role: true,
      credential: true,
      bio: true,
      photoUrl: true,
      mentorStage: true,
      schoolType: true,
      medicalSchool: true,
      profileStatus: true,
      pausedUntil: true,
      awayNote: true,
      acceptsMinors: true,
      safetyHoldAt: true,
      profileCompleteAt: true,
      // Profile sections (redesign Oct 2026)
      hasAdmissionsRoles: true,
      admissionsRoles: true,
      yearsAdvising: true,
      applicantsSupported: true,
      strongestStages: true,
      specialtyInterest: true,
      researchSummary: true,
      bestFor: true,
      bestForOther: true,
      highlights: true,
      knownFor: true,
      languages: true,
      funFact: true,
      hourlyRateCents: true,
    },
  });

  const session = await getServerSession(authOptions);
  const viewerRole = (session?.user as any)?.role;
  const viewerId = (session?.user as any)?.id;

  if (!seller || seller.role !== "SELLER") notFound();
  // Removed profiles are gone for everyone except admins and the mentor themselves.
  if (seller.profileStatus === "REMOVED" && viewerRole !== "ADMIN" && viewerId !== seller.id) notFound();

  // Preview (mentor area v2): the mentor looking at their own profile sees
  // it exactly as students do, even while it's hidden, plus offers students
  // can't see yet (the Hourly offer switched off, or no rate set), marked
  // "Not visible to students".
  const preview = viewerId === seller.id;

  const [offers, reviews] = await Promise.all([
    offersFor(seller.id, { onlyBookable: !preview }),
    prisma.review.findMany({
      where: { sellerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, rating: true, comment: true, createdAt: true,
        buyer: { select: { name: true } },
        order: { select: { packageTitle: true, gig: { select: { title: true } } } },
      },
    }),
  ]);

  // A student under 18 looking at a mentor who works with 18+ only.
  const viewerIsMinor =
    viewerRole === "BUYER" && viewerId && !seller.acceptsMinors
      ? !!(await prisma.user.findUnique({ where: { id: viewerId }, select: { minorStatus: true } }))?.minorStatus
      : false;

  const rate = seller.hourlyRateCents;
  const toOffer = (g: (typeof offers.packages)[number]): PublicOffer => ({
    id: g.id,
    kind: g.kind as PublicOffer["kind"],
    title: g.title,
    description: g.description,
    minutes: offerMinutes(g),
    rateCents: offerRate(g, rate) ?? 0,
    price: offerPrice(g, rate) ?? g.price,
    format: g.format,
    service: g.service,
    serviceOther: g.serviceOther,
    coverUrl: g.coverUrl,
    hiddenFromStudents: !(g.active && g.price > 0) || undefined,
  });

  const { role, profileStatus, pausedUntil, acceptsMinors, safetyHoldAt, profileCompleteAt, hasAdmissionsRoles, admissionsRoles, languages, ...publicSeller } = seller;
  const available = isMentorVisible({ profileStatus, pausedUntil });
  const listed = isMentorListed({ profileStatus, pausedUntil, safetyHoldAt, profileCompleteAt });
  // Why the profile is hidden, for the preview banner (the mentor only).
  const previewState = !preview
    ? null
    : listed
      ? "LIVE"
      : !profileCompleteAt
        ? "INCOMPLETE"
        : profileStatus === "REMOVED"
          ? "REMOVED"
          : safetyHoldAt
            ? "HOLD"
            : "PAUSED";

  return (
    <ProfileClient
      seller={{
        ...publicSeller,
        // Answered "No" to the admissions question: no roles on the profile.
        admissionsRoles: hasAdmissionsRoles === false ? [] : rolesOf(admissionsRoles),
        languages: languagesOf(languages),
        available,
        listed,
        status: profileStatus,
        pausedUntil: pausedUntil ? pausedUntil.toISOString() : null,
        adultsOnlyForViewer: viewerIsMinor,
      }}
      previewState={previewState}
      offers={{
        hourly: offers.hourly ? toOffer(offers.hourly) : null,
        bundles: offers.bundles.map(toOffer),
        packages: offers.packages.map(toOffer),
      }}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        // first name + last initial only
        author: r.buyer.name.split(" ")[0] + (r.buyer.name.split(" ")[1] ? ` ${r.buyer.name.split(" ")[1][0]}.` : ""),
        // which package was bought
        bought: r.order.packageTitle || r.order.gig.title,
      }))}
    />
  );
}
