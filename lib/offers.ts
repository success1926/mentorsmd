// A mentor's offers since the Oct 2026 redesign (docs/redesign-2026-10.md
// section 3): one HOURLY offer, hour BUNDLEs and SPECIALIZED packages, all
// Gig rows. Server only.
import { prisma } from "@/lib/prisma";
import { offerPrice } from "@/lib/pricing";

export const HOURLY_TITLE = "Hourly";
export const HOURLY_DESCRIPTION = "One hour with your mentor, for a call, written feedback or both. No due date: book calls on their calendar, or send work to review.";

// The mentor's HOURLY offer, made the first time it's needed (switched on,
// calls + written). Pay-per-call orders point at it too.
export async function ensureHourlyOffer(mentorId: string) {
  const existing = await prisma.gig.findFirst({ where: { sellerId: mentorId, kind: "HOURLY" }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const mentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { hourlyRateCents: true } });
  return prisma.gig.create({
    data: {
      sellerId: mentorId,
      kind: "HOURLY",
      title: HOURLY_TITLE,
      description: HOURLY_DESCRIPTION,
      minutes: 60,
      format: "WRITTEN_CALL",
      price: mentor?.hourlyRateCents ?? 0,
      duration: "",
      category: "OTHER",
      active: true,
    },
  });
}

// Keeps every offer's stored price equal to hours x rate, after the
// mentor's hourly rate (or an offer) changes. The stored price is what
// browse filters on; orders keep the price and rate they paid.
export async function syncOfferPrices(mentorId: string) {
  const mentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { hourlyRateCents: true } });
  const gigs = await prisma.gig.findMany({ where: { sellerId: mentorId, kind: { not: null } }, select: { id: true, kind: true, minutes: true, rateCents: true, price: true } });
  for (const g of gigs) {
    const price = offerPrice(g, mentor?.hourlyRateCents) ?? 0;
    if (price !== g.price) await prisma.gig.update({ where: { id: g.id }, data: { price } });
  }
}

// Everything the "Rate & offers" page shows (onlyBookable false: the
// hourly offer even while it's switched off), or what students can buy on
// the public profile (onlyBookable true). Removed bundles and packages
// (active false) are never included.
export async function offersFor(mentorId: string, opts: { onlyBookable?: boolean } = {}) {
  const gigs = await prisma.gig.findMany({
    where: opts.onlyBookable
      ? { sellerId: mentorId, kind: { in: ["HOURLY", "BUNDLE", "SPECIALIZED"] }, active: true, price: { gt: 0 } }
      : { sellerId: mentorId, OR: [{ kind: "HOURLY" }, { kind: { in: ["BUNDLE", "SPECIALIZED"] }, active: true }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return {
    hourly: gigs.find((g) => g.kind === "HOURLY") ?? null,
    bundles: gigs.filter((g) => g.kind === "BUNDLE").sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0)),
    packages: gigs.filter((g) => g.kind === "SPECIALIZED"),
  };
}
