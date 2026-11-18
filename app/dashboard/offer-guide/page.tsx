import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteContent } from "@/lib/siteContentStore";
import { OfferGuideStatic } from "@/components/OfferGuide";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Offer Guide", robots: { index: false } };
export const dynamic = "force-dynamic";

// The Offer Guide pop-up's contents as a page, for mentors and for Admin ->
// Website -> Offer guide's preview (admins have no Rates & packages page to
// open the pop-up from). In preview mode it shows the saved draft.
export default async function OfferGuidePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "SELLER" && role !== "ADMIN") redirect("/dashboard");
  const values = await getSiteContent("mentorGuide");
  // Mentors see example prices at their own rate, as in the pop-up; admins
  // previewing the page see the example rate.
  const me = role === "SELLER" ? await prisma.user.findUnique({ where: { id: (session?.user as any).id }, select: { hourlyRateCents: true } }) : null;
  return (
    <div className="page-mid">
      <OfferGuideStatic values={values} rateCents={me?.hourlyRateCents ?? null} />
    </div>
  );
}
