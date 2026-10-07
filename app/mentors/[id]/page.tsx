import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bookableGigWhere, isMentorVisible } from "@/lib/mentor";
import { ProfileClient } from "./ProfileClient";

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
      backgrounds: true,
      profileStatus: true,
      pausedUntil: true,
      awayNote: true,
      acceptsMinors: true,
      gigs: {
        where: bookableGigWhere,
        orderBy: { price: "asc" },
        select: {
          id: true, title: true, description: true, price: true, duration: true,
          service: true, serviceOther: true, format: true, turnaround: true, callsIncluded: true, callLength: true,
        },
      },
    },
  });

  const session = await getServerSession(authOptions);
  const viewerRole = (session?.user as any)?.role;
  const viewerId = (session?.user as any)?.id;

  if (!seller || seller.role !== "SELLER") notFound();
  // Removed profiles are gone for everyone except admins and the mentor themselves.
  if (seller.profileStatus === "REMOVED" && viewerRole !== "ADMIN" && viewerId !== seller.id) notFound();

  const reviews = await prisma.review.findMany({
    where: { sellerId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, rating: true, comment: true, createdAt: true, buyer: { select: { name: true } } },
  });

  // A student under 18 looking at a mentor who works with 18+ only.
  const viewerIsMinor =
    viewerRole === "BUYER" && viewerId && !seller.acceptsMinors
      ? !!(await prisma.user.findUnique({ where: { id: viewerId }, select: { minorStatus: true } }))?.minorStatus
      : false;

  const { role, profileStatus, pausedUntil, acceptsMinors, ...publicSeller } = seller;
  const available = isMentorVisible({ profileStatus, pausedUntil });

  return (
    <ProfileClient
      seller={{
        ...publicSeller,
        available,
        status: profileStatus,
        pausedUntil: pausedUntil ? pausedUntil.toISOString() : null,
        adultsOnlyForViewer: viewerIsMinor,
      }}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        // first name + last initial only
        author: r.buyer.name.split(" ")[0] + (r.buyer.name.split(" ")[1] ? ` ${r.buyer.name.split(" ")[1][0]}.` : ""),
      }))}
    />
  );
}
