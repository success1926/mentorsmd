import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function CoachProfilePage({ params }: { params: { id: string } }) {
  const seller = await prisma.user.findUnique({
    where: { id: params.id },
    include: { gigs: { where: { active: true }, orderBy: { createdAt: "desc" } } },
  });

  if (!seller || seller.role !== "SELLER") notFound();

  const reviews = await prisma.review.findMany({
    where: { sellerId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return <ProfileClient seller={seller} reviews={reviews} />;
}
