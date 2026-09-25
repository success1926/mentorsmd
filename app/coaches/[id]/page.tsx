import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function CoachProfilePage({ params }: { params: { id: string } }) {
  // IMPORTANT: everything returned here is serialized into the page's HTML
  // and sent to the visitor's browser (ProfileClient is a client
  // component). Only select public fields - never passwordHash, email,
  // stripeAccountId, or lockout counters.
  const seller = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      role: true,
      credential: true,
      bio: true,
      photoUrl: true,
      gigs: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, price: true, duration: true, category: true },
      },
    },
  });

  if (!seller || seller.role !== "SELLER") notFound();

  const reviews = await prisma.review.findMany({
    where: { sellerId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, comment: true, createdAt: true },
  });

  return <ProfileClient seller={seller} reviews={reviews} />;
}
