import type { Prisma } from "@prisma/client";
import { isPriceInRange } from "@/lib/options";

// Who shows up in browse, on the homepage and can be booked.
//   ACTIVE                              -> visible
//   PAUSED with a return date in the past -> visible again (auto-resume)
//   PAUSED otherwise, or REMOVED         -> hidden
export function visibleMentorWhere(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    role: "SELLER",
    safetyHoldAt: null, // paused by MentorsMD pending a safety review
    OR: [{ profileStatus: "ACTIVE" }, { profileStatus: "PAUSED", pausedUntil: { lte: now } }],
  };
}

export function isMentorVisible(
  u: { profileStatus: string; pausedUntil: Date | null },
  now: Date = new Date()
) {
  if (u.profileStatus === "ACTIVE") return true;
  if (u.profileStatus === "PAUSED" && u.pausedUntil && u.pausedUntil <= now) return true;
  return false;
}

// Can students buy from this mentor right now? Visible, not on a safety
// hold, and every profile section filled in (lib/profileCompleteness.ts).
export function isMentorListed(
  u: { profileStatus: string; pausedUntil: Date | null; safetyHoldAt?: Date | null; profileCompleteAt: Date | null },
  now: Date = new Date()
) {
  return isMentorVisible(u, now) && !u.safetyHoldAt && !!u.profileCompleteAt;
}

// Offers students can see and buy (redesign Oct 2026): hourly, hour
// bundles and specialized packages that are switched on and have a price
// (the mentor has set a rate). Packages from before the redesign (no kind,
// typed-in price, due dates) are no longer shown.
export const OFFER_KIND_VALUES = ["HOURLY", "BUNDLE", "SPECIALIZED"];
export const bookableGigWhere: Prisma.GigWhereInput = {
  active: true,
  kind: { in: OFFER_KIND_VALUES },
  price: { gt: 0 },
};

// Offers that count for search (the same as bookable since the redesign:
// every offer is complete once it's saved).
export const searchableGigWhere: Prisma.GigWhereInput = bookableGigWhere;

// Old packages only: priced outside the old $50-$5,000 limits. Used by the
// old checkout, which the new hourly checkout replaces.
export function gigPriceOutOfRange(g: { price: number }) {
  return !isPriceInRange(g.price);
}
