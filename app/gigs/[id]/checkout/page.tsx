import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The old checkout page (a package with a due date). Since the hourly
// redesign (Oct 2026) everything is bought from a pop-up on the mentor's
// profile, so this sends people there.
export default async function OldCheckoutPage({ params }: { params: { id: string } }) {
  const gig = await prisma.gig.findUnique({ where: { id: params.id }, select: { sellerId: true } }).catch(() => null);
  redirect(gig ? `/mentors/${gig.sellerId}` : "/mentors");
}
